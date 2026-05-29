import { createNotification, getIdea } from '@/lib/db';
import { transitionIdeaInTransaction, writeAuditLog } from '@/lib/db/pipeline-db';
import { getDb } from '@/lib/db';
import type { LifecycleStatus } from '@/lib/db/types';
import { TimeoutError } from './errors';

export function revertOnTimeout(
  ideaId: string,
  from: LifecycleStatus,
  to: LifecycleStatus,
  reason: string
): void {
  const idea = getIdea(ideaId);
  if (!idea || idea.status !== from) return;
  transitionIdeaInTransaction(ideaId, from, to, 'system', {
    reason,
    eventType: 'stage_timeout',
  });
  createNotification(ideaId, 'admin', 'stage_failed');
}

export function recordStageTimeout(
  ideaId: string,
  atStatus: LifecycleStatus,
  reason: string
): void {
  const db = getDb();
  writeAuditLog(db, {
    ideaId,
    actorId: 'system',
    eventType: 'stage_timeout',
    from: atStatus,
    to: atStatus,
    reason,
  });
  createNotification(ideaId, 'admin', 'stage_failed');
}

export async function runWithTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number,
  onTimeout?: () => void
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutP = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      try {
        onTimeout?.();
      } catch {
        /* swallow */
      }
      reject(new TimeoutError(`执行超时（${timeoutMs / 1000}s）`));
    }, timeoutMs);
  });
  try {
    return await Promise.race([fn(), timeoutP]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
