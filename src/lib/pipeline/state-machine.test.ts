import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { assertValidTransition, TRANSITIONS } from './state-machine';
import { ValidationError } from './errors';
import type { LifecycleStatus } from '@/lib/db/types';

describe('state-machine', () => {
  for (const [from, targets] of Object.entries(TRANSITIONS) as [LifecycleStatus, LifecycleStatus[]][]) {
    for (const to of targets) {
      it(`allows ${from} → ${to}`, () => {
        assert.doesNotThrow(() => assertValidTransition(from, to));
      });
    }
  }

  it('rejects analyzing → dev_pending', () => {
    assert.throws(
      () => assertValidTransition('analyzing', 'dev_pending'),
      ValidationError
    );
  });

  it('rejects done → submitted', () => {
    assert.throws(() => assertValidTransition('done', 'submitted'), ValidationError);
  });

  const ALL: LifecycleStatus[] = [
    'submitted', 'analyzing', 'pending_prd', 'designing', 'pending_design',
    'dev_pending', 'testing', 'pending_merge', 'done', 'rejected', 'deferred',
  ];

  for (const from of ALL) {
    const illegal = ALL.filter((to) => !TRANSITIONS[from].includes(to));
    for (const to of illegal.slice(0, 2)) {
      it(`rejects ${from} → ${to}`, () => {
        assert.throws(() => assertValidTransition(from, to), ValidationError);
      });
    }
  }
});
