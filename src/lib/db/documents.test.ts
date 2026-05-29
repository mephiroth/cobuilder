import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createTestDatabase } from './test-db';
import { resetTestDatabase, createProject, createIdea } from './index';
import { saveDocument, getLatestDoc } from './pipeline-db';
import { samplePRD, sampleUIBrief } from '@/lib/pipeline/test-fixtures';

describe('document versioning', () => {
  beforeEach(() => createTestDatabase());
  afterEach(() => resetTestDatabase());

  it('increments version per document type independently', () => {
    const project = createProject('T', '/tmp');
    const idea = createIdea({
      project_id: project.id,
      title: 'I',
      description: 'd'.repeat(20),
    });
    const prd1 = saveDocument(idea.id, 'prd', samplePRD());
    const ui1 = saveDocument(idea.id, 'ui_brief', sampleUIBrief());
    const prd2 = saveDocument(idea.id, 'prd', samplePRD());

    assert.equal(prd1.version, 1);
    assert.equal(ui1.version, 1);
    assert.equal(prd2.version, 2);
    assert.equal(getLatestDoc(idea.id, 'prd')?.version, 2);
    assert.equal(getLatestDoc(idea.id, 'ui_brief')?.version, 1);
  });
});
