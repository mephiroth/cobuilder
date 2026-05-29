import {
  getIdea,
  getProject,
  createNotification,
  updateIdea,
} from '@/lib/db';
import {
  transitionIdeaInTransaction,
  parseDocContent,
  getLatestDoc,
  getRecentPipelineRuns,
  getDevRetryCount,
  getLatestStage3Run,
  deleteDocumentsAfterPrd,
} from '@/lib/db/pipeline-db';
import type { LifecycleStatus, PRD, UIBrief, DevPlan, TestDoc } from '@/lib/db/types';
import { assertValidTransition } from './state-machine';
import { ValidationError, TooManyRetriesError } from './errors';
import { handleGate as handleGateInternal, type GateRequest, type GateResponse } from './gate-manager';
import {
  triggerNextStage,
  clearStagingForIdea,
  runStage3,
} from './orchestrator';

export type { GateRequest, GateResponse };

export async function startPipeline(
  ideaId: string,
  actorId: string
): Promise<{ status: LifecycleStatus }> {
  const idea = getIdea(ideaId);
  if (!idea) throw new ValidationError('Idea 不存在');
  let from = idea.status as LifecycleStatus;
  if (!['submitted', 'rejected', 'deferred'].includes(from)) {
    throw new ValidationError('当前状态不可启动流水线');
  }

  if (from === 'deferred') {
    transitionIdeaInTransaction(ideaId, 'deferred', 'submitted', actorId === 'admin' ? 'admin' : 'system', {
      eventType: 'pipeline_reopened',
    });
    from = 'submitted';
  }

  const dbStatus: LifecycleStatus = 'analyzing';
  assertValidTransition(from, dbStatus);

  transitionIdeaInTransaction(ideaId, from, dbStatus, actorId === 'admin' ? 'admin' : 'system', {
    eventType: 'pipeline_started',
  });

  if (from !== 'submitted') {
    deleteDocumentsAfterPrd(ideaId);
  }

  setImmediate(() => triggerNextStage(ideaId, 'analyzing').catch(console.error));

  return { status: dbStatus };
}

export async function rejectAtSubmission(
  ideaId: string,
  actorId: string,
  reason: string
): Promise<void> {
  if (!reason || reason.length < 10) {
    throw new ValidationError('拒绝原因不少于 10 字符');
  }
  const idea = getIdea(ideaId);
  if (!idea || idea.status !== 'submitted') {
    throw new ValidationError('仅 submitted 状态可驳回');
  }
  transitionIdeaInTransaction(ideaId, 'submitted', 'rejected', actorId === 'admin' ? 'admin' : 'system', {
    reason,
    eventType: 'gate_decision',
    metadata: { decision: 'reject' },
  });
}

export async function retryDev(ideaId: string, actorId: string): Promise<void> {
  const idea = getIdea(ideaId);
  if (!idea || idea.status !== 'dev_pending') {
    throw new ValidationError('当前状态不可重试开发');
  }
  const prdDoc = getLatestDoc(ideaId, 'prd');
  const version = prdDoc?.version ?? 1;
  const retry = getDevRetryCount(ideaId);
  if (retry && retry.prd_version === version && retry.count >= 3) {
    throw new TooManyRetriesError('请先修改 PRD');
  }

  const project = getProject(idea.project_id);
  if (project) clearStagingForIdea(ideaId, project.codebase_dir);

  transitionIdeaInTransaction(ideaId, 'dev_pending', 'dev_pending', actorId === 'admin' ? 'admin' : 'system', {
    eventType: 'retry_dev',
  });

  setImmediate(() => runStage3(ideaId).catch(console.error));
}

export function getPipelineState(ideaId: string) {
  const idea = getIdea(ideaId);
  if (!idea) return null;
  const project = getProject(idea.project_id);
  const prd = parseDocContent<PRD>(getLatestDoc(ideaId, 'prd'));
  const uiBrief = parseDocContent<UIBrief>(getLatestDoc(ideaId, 'ui_brief'));
  const devPlan = parseDocContent<DevPlan>(getLatestDoc(ideaId, 'dev_plan'));
  const testDoc = parseDocContent<TestDoc>(getLatestDoc(ideaId, 'test_doc'));
  const testDocRaw = getLatestDoc(ideaId, 'test_doc');

  const lowConfidenceWarning = (prd?.confidence ?? 100) < 60;
  const testDocGenerationFailed =
    testDocRaw?.content.includes('测试用例生成失败') ?? false;

  const stage3Run = getLatestStage3Run(ideaId);

  return {
    idea,
    project,
    prd,
    uiBrief,
    devPlan,
    testDoc,
    lowConfidenceWarning,
    testDocGenerationFailed,
    recentRuns: getRecentPipelineRuns(ideaId, 5),
    usedFallback: stage3Run?.used_fallback === 1,
  };
}

export async function handleGate(req: GateRequest): Promise<GateResponse> {
  return handleGateInternal(req);
}

export { triggerNextStage } from './orchestrator';
