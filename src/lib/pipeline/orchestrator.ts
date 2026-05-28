import * as fs from 'fs';
import * as path from 'path';
import {
  getIdea,
  getProject,
  createNotification,
  updateIdea,
} from '@/lib/db';
import { getDb } from '@/lib/db';
import {
  saveDocument,
  parseDocContent,
  getLatestDoc,
  transitionIdeaInTransaction,
  writeAuditLog,
  clearStagingFiles,
  deleteDocumentsAfterPrd,
} from '@/lib/db/pipeline-db';
import type { LifecycleStatus, PRD, UIBrief, DevPlan, TestDoc } from '@/lib/db/types';
import { stage1 } from './stage1-pm';
import { stage2 } from './stage2-design';
import { stage3 } from './stage3-dev';
import { stage4 } from './stage4-test';
import { runWithTimeout } from './runner';
import { TaskTooLargeError } from './errors';
import type { StageInput } from './stage-types';

function buildInput(ideaId: string): StageInput | null {
  const idea = getIdea(ideaId);
  if (!idea) return null;
  const project = getProject(idea.project_id);
  if (!project) return null;
  return {
    idea,
    project,
    previousDocs: {
      prd: parseDocContent<PRD>(getLatestDoc(ideaId, 'prd')) ?? undefined,
      uiBrief: parseDocContent<UIBrief>(getLatestDoc(ideaId, 'ui_brief')) ?? undefined,
      devPlan: parseDocContent<DevPlan>(getLatestDoc(ideaId, 'dev_plan')) ?? undefined,
    },
  };
}

function notifyAdmin(ideaId: string, status: string) {
  createNotification(ideaId, 'admin', status);
}

async function completeStage(
  ideaId: string,
  from: LifecycleStatus,
  to: LifecycleStatus,
  extra?: () => void
) {
  transitionIdeaInTransaction(ideaId, from, to, 'system', { eventType: 'stage_complete' });
  extra?.();
}

export async function runStage1(ideaId: string): Promise<void> {
  const input = buildInput(ideaId);
  if (!input || input.idea.status !== 'analyzing') return;

  try {
    const result = await runWithTimeout(
      () => stage1.run(input),
      stage1.timeoutSeconds * 1000
    );
    saveDocument(ideaId, result.docType, result.doc);
    await completeStage(ideaId, 'analyzing', 'pending_prd', () =>
      notifyAdmin(ideaId, 'gate1_waiting')
    );
  } catch {
    transitionIdeaInTransaction(ideaId, 'analyzing', 'submitted', 'system', {
      reason: 'AI 服务暂时不可用，请稍后重试',
      eventType: 'stage_failed',
    });
    notifyAdmin(ideaId, 'stage_failed');
  }
}

export async function runStage2(ideaId: string): Promise<void> {
  const input = buildInput(ideaId);
  if (!input || input.idea.status !== 'designing') return;

  try {
    const result = await runWithTimeout(
      () => stage2.run(input),
      stage2.timeoutSeconds * 1000
    );
    saveDocument(ideaId, result.docType, result.doc);
    await completeStage(ideaId, 'designing', 'pending_design', () =>
      notifyAdmin(ideaId, 'gate2_waiting')
    );
  } catch {
    if (getIdea(ideaId)?.status === 'designing') {
      transitionIdeaInTransaction(ideaId, 'designing', 'pending_prd', 'system', {
        eventType: 'stage_failed',
      });
      notifyAdmin(ideaId, 'stage_failed');
    }
  }
}

export async function runStage3(ideaId: string): Promise<void> {
  const input = buildInput(ideaId);
  if (!input || input.idea.status !== 'dev_pending') return;

  try {
    const { logBus } = await import('./log-bus');
    const { killRunningAgent } = await import('@/lib/agents/dispatcher');
    const result = await runWithTimeout(
      () => stage3.run(input, (chunk) => logBus.publish(ideaId, chunk)),
      stage3.timeoutSeconds * 1000,
      () => killRunningAgent(ideaId)
    );
    saveDocument(ideaId, result.docType, result.doc);
    await completeStage(ideaId, 'dev_pending', 'testing');
    setImmediate(() => runStage4(ideaId).catch(console.error));
  } catch (e) {
    if (e instanceof TaskTooLargeError) {
      transitionIdeaInTransaction(ideaId, 'dev_pending', 'pending_prd', 'system', {
        reason: e.message,
        eventType: 'stage_failed',
      });
      notifyAdmin(ideaId, 'stage_failed');
      return;
    }
    notifyAdmin(ideaId, 'stage_failed');
  }
}

export async function runStage4(ideaId: string): Promise<void> {
  const input = buildInput(ideaId);
  if (!input || input.idea.status !== 'testing') return;

  let meta: Record<string, unknown> | undefined;
  try {
    const result = await runWithTimeout(
      () => stage4.run(input),
      stage4.timeoutSeconds * 1000
    );
    saveDocument(ideaId, result.docType, result.doc);
    meta = result.meta;
  } catch {
    saveDocument(ideaId, 'test_doc', {
      test_cases: [],
      coverage_note: '测试用例生成失败，请人工补充',
    });
    meta = { generationFailed: true };
  }

  const db = getDb();
  db.exec('BEGIN IMMEDIATE');
  try {
    const idea = getIdea(ideaId)!;
    writeAuditLog(db, {
      ideaId,
      actorId: 'system',
      eventType: 'stage_complete',
      from: 'testing',
      to: 'pending_merge',
      metadata: meta,
    });
    updateIdea(ideaId, { status: 'pending_merge' });
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
  notifyAdmin(ideaId, 'gate3_waiting');
}

export async function triggerNextStage(ideaId: string, status: LifecycleStatus): Promise<void> {
  switch (status) {
    case 'analyzing':
      await runStage1(ideaId);
      break;
    case 'designing':
      await runStage2(ideaId);
      break;
    case 'dev_pending':
      await runStage3(ideaId);
      break;
    case 'testing':
      await runStage4(ideaId);
      break;
    default:
      break;
  }
}

export function clearStagingForIdea(ideaId: string, codebaseDir: string): void {
  const stagingDir = path.join(codebaseDir, '.cobuilder', 'staging', ideaId);
  if (fs.existsSync(stagingDir)) fs.rmSync(stagingDir, { recursive: true, force: true });
  clearStagingFiles(ideaId);
}

export { deleteDocumentsAfterPrd };
