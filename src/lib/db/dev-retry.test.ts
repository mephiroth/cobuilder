import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createTestDatabase } from './test-db';
import { resetTestDatabase } from './index';
import {
  incrementDevRetryCount,
  resetDevRetryCount,
  getDevRetryCount,
  saveDocument,
} from './pipeline-db';
import { createProject, createIdea } from './index';
import { samplePRD } from '@/lib/pipeline/test-fixtures';

describe('dev retry count', () => {
  beforeEach(() => {
    createTestDatabase();
  });
  afterEach(() => {
    resetTestDatabase();
  });

  it('resets count when PRD version changes', () => {
    const project = createProject('T', '/tmp');
    const idea = createIdea({
      project_id: project.id,
      title: 'I',
      description: 'd'.repeat(20),
    });
    const d1 = saveDocument(idea.id, 'prd', samplePRD());
    assert.equal(incrementDevRetryCount(idea.id, d1.version), 1);
    assert.equal(incrementDevRetryCount(idea.id, d1.version), 2);

    const d2 = saveDocument(idea.id, 'prd', { ...samplePRD(), title: 'v2' });
    assert.equal(incrementDevRetryCount(idea.id, d2.version), 1);

    resetDevRetryCount(idea.id);
    assert.equal(getDevRetryCount(idea.id), undefined);
  });
});
