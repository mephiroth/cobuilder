import { getDb, getIdea, getProject, createNotification } from '@/lib/db';
import {
  writeAuditLog,
  saveDocument,
  resetDevRetryCount,
  parseDocContent,
} from '@/lib/db/pipeline-db';
import type {
  GateDecision,
  GateName,
  LifecycleStatus,
  Project,
  DocumentType,
} from '@/lib/db/types';
import { assertValidTransition } from './state-machine';
import { ValidationError } from './errors';
import { mergeStagingToMain } from './merge';
import { triggerNextStage } from './orchestrator';

export interface GateRequest {
  ideaId: string;
  gate: GateName;
  decision: GateDecision;
  editedDoc?: Record<string, unknown>;
  reason?: string;
  deferUntil?: string;
  actorId: string;
}

export interface GateResponse {
  success: boolean;
  nextStatus: LifecycleStatus;
  error?: string;
}

const GATE_DECISIONS: Record<GateName, GateDecision[]> = {
  gate1: ['approve', 'approve_with_edit', 'reject', 'defer'],
  gate2: ['approve', 'approve_with_edit', 'regenerate', 'skip_design', 'reject_to_prd'],
  gate3: ['approve', 'approve_with_edit', 'reject', 'regenerate'],
};

export function assertGateDecisionValid(gate: GateName, decision: GateDecision): void {
  if (!GATE_DECISIONS[gate]?.includes(decision)) {
    throw new ValidationError(`Gate ${gate} 不支持决策 ${decision}`);
  }
}

export function docTypeOfGate(gate: GateName): DocumentType {
  if (gate === 'gate1') return 'prd';
  if (gate === 'gate2') return 'ui_brief';
  return 'test_doc';
}

export function shouldTriggerNextStage(decision: GateDecision): boolean {
  return [
    'approve',
    'approve_with_edit',
    'regenerate',
    'skip_design',
  ].includes(decision);
}

export function resolveNextStatus(
  gate: GateName,
  decision: GateDecision,
  project: Project
): LifecycleStatus {
  if (gate === 'gate1') {
    if (decision === 'approve' || decision === 'approve_with_edit') {
      return project.enable_design_stage ? 'designing' : 'dev_pending';
    }
    if (decision === 'reject') return 'rejected';
    if (decision === 'defer') return 'deferred';
  }
  if (gate === 'gate2') {
    if (decision === 'approve' || decision === 'approve_with_edit' || decision === 'skip_design') {
      return 'dev_pending';
    }
    if (decision === 'regenerate') return 'designing';
    if (decision === 'reject_to_prd') return 'pending_prd';
  }
  if (gate === 'gate3') {
    if (decision === 'approve' || decision === 'approve_with_edit') return 'done';
    if (decision === 'reject') return 'rejected';
    if (decision === 'regenerate') return 'dev_pending';
  }
  throw new ValidationError(`无法解析下一状态`);
}

export async function handleGate(req: GateRequest): Promise<GateResponse> {
  const { ideaId, gate, decision, reason, actorId, editedDoc, deferUntil } = req;

  assertGateDecisionValid(gate, decision);

  if (['reject', 'reject_to_prd', 'regenerate', 'defer'].includes(decision)) {
    if (!reason || reason.length < 10) {
      throw new ValidationError('原因不少于 10 字符');
    }
  }
  if (decision === 'defer') {
    if (!deferUntil || new Date(deferUntil) <= new Date()) {
      throw new ValidationError('搁置日期必须为未来日期');
    }
  }

  const idea = getIdea(ideaId);
  if (!idea) throw new ValidationError('Idea 不存在');
  const project = getProject(idea.project_id);
  if (!project) throw new ValidationError('Project 不存在');

  const fromStatus = idea.status as LifecycleStatus;

  if (gate === 'gate1' && !['pending_prd'].includes(fromStatus)) {
    throw new ValidationError('当前不在 Gate 1');
  }
  if (gate === 'gate2' && fromStatus !== 'pending_design') {
    throw new ValidationError('当前不在 Gate 2');
  }
  if (gate === 'gate3' && fromStatus !== 'pending_merge') {
    throw new ValidationError('当前不在 Gate 3');
  }

  const nextStatus = resolveNextStatus(gate, decision, project);

  if (gate === 'gate3' && (decision === 'approve' || decision === 'approve_with_edit')) {
    try {
      mergeStagingToMain(ideaId, project.codebase_dir, actorId === 'admin' ? 'admin' : 'system');
      if (editedDoc) saveDocument(ideaId, 'test_doc', editedDoc);
      return { success: true, nextStatus: 'done' };
    } catch (e) {
      return {
        success: false,
        nextStatus: fromStatus,
        error: e instanceof Error ? e.message : '合入失败',
      };
    }
  }

  const db = getDb();
  db.exec('BEGIN IMMEDIATE');
  try {
    assertValidTransition(fromStatus, nextStatus);
    db.prepare(
      `UPDATE ideas SET status = ?, defer_until = ?, updated_at = datetime('now') WHERE id = ?`
    ).run(nextStatus, decision === 'defer' ? deferUntil ?? null : null, ideaId);

    writeAuditLog(db, {
      ideaId,
      actorId: actorId === 'admin' ? 'admin' : 'system',
      eventType: 'gate_decision',
      from: fromStatus,
      to: nextStatus,
      reason,
      metadata: { gate, decision },
    });

    if (decision === 'approve_with_edit' && editedDoc) {
      const docType = docTypeOfGate(gate);
      saveDocument(ideaId, docType, editedDoc);
      if (docType === 'prd') resetDevRetryCount(ideaId);
    }

    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }

  notifyGateWaiting(gate, nextStatus, ideaId);

  if (shouldTriggerNextStage(decision)) {
    setImmediate(() => triggerNextStage(ideaId, nextStatus).catch(console.error));
  }

  return { success: true, nextStatus };
}

function notifyGateWaiting(gate: GateName, status: LifecycleStatus, ideaId: string) {
  if (status === 'pending_prd') createNotification(ideaId, 'admin', 'gate1_waiting');
  if (status === 'pending_design') createNotification(ideaId, 'admin', 'gate2_waiting');
  if (status === 'pending_merge') createNotification(ideaId, 'admin', 'gate3_waiting');
  if (status === 'dev_pending' && gate === 'gate1') {
    /* Stage 3 will run */
  }
}
