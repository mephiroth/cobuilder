import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { resetTestDatabase, createProject, createIdea, getIdea } from '@/lib/db';
import { createTestDatabase } from '@/lib/db/test-db';
import { upsertStagingFile } from '@/lib/db/pipeline-db';
import { mergeStagingToMain } from './merge';

describe('mergeStagingToMain', () => {
  let tmp: string;
  let ideaId: string;

  beforeEach(() => {
    createTestDatabase();
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cobuilder-merge-'));
    const project = createProject('Merge', tmp);
    const idea = createIdea({
      project_id: project.id,
      title: 'I',
      description: 'd'.repeat(20),
    });
    ideaId = idea.id;
    const db = require('@/lib/db').getDb();
    db.prepare("UPDATE ideas SET status = 'pending_merge' WHERE id = ?").run(ideaId);
  });

  afterEach(() => {
    resetTestDatabase();
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('copies staging files into codebase', () => {
    const stagingDir = path.join(tmp, '.cobuilder', 'staging', ideaId);
    fs.mkdirSync(stagingDir, { recursive: true });
    fs.writeFileSync(path.join(stagingDir, 'out.txt'), 'merged');
    upsertStagingFile(ideaId, 'out.txt', 'add', 6, false);
    fs.writeFileSync(
      path.join(stagingDir, 'manifest.json'),
      JSON.stringify({ deletes: [] })
    );

    mergeStagingToMain(ideaId, tmp, 'admin');
    assert.equal(fs.readFileSync(path.join(tmp, 'out.txt'), 'utf-8'), 'merged');
    assert.equal(getIdea(ideaId)?.status, 'done');
  });

  it('rejects path traversal', () => {
    upsertStagingFile(ideaId, '../../../etc/passwd', 'add', 1, false);
    const stagingDir = path.join(tmp, '.cobuilder', 'staging', ideaId);
    fs.mkdirSync(path.join(stagingDir, '../../../etc'), { recursive: true });
    fs.writeFileSync(path.join(stagingDir, '../../../etc/passwd'), 'x');

    assert.throws(() => mergeStagingToMain(ideaId, tmp, 'admin'), /非法路径越界/);
    assert.equal(getIdea(ideaId)?.status, 'pending_merge');
  });
});
