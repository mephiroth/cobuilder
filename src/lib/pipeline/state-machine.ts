import type { LifecycleStatus } from '@/lib/db/types';
import { ValidationError } from './errors';

export const TRANSITIONS: Record<LifecycleStatus, LifecycleStatus[]> = {
  submitted: ['analyzing', 'rejected'],
  analyzing: ['pending_prd', 'submitted'],
  pending_prd: ['designing', 'dev_pending', 'rejected', 'deferred'],
  designing: ['pending_design', 'pending_prd'],
  pending_design: ['dev_pending', 'designing', 'pending_prd'],
  dev_pending: ['testing', 'dev_pending'],
  testing: ['pending_merge'],
  pending_merge: ['done', 'rejected', 'dev_pending'],
  rejected: ['submitted'],
  deferred: ['submitted'],
  done: [],
};

export function assertValidTransition(from: LifecycleStatus, to: LifecycleStatus): void {
  if (!TRANSITIONS[from]?.includes(to)) {
    throw new ValidationError(`非法状态转移: ${from} → ${to}`);
  }
}
