import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { resetTestDatabase, createProject, createIdea } from '@/lib/db';
import { createTestDatabase } from '@/lib/db/test-db';
import { upsertStagingFile } from '@/lib/db/pipeline-db';
import { generateDiff } from './diff';

describe('generateDiff', () => {
  let tmp: string;
  let ideaId: string;

  beforeEach(() => {
    createTestDatabase();
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cobuilder-diff-'));
    const project = createProject('Diff', tmp);
    const idea = createIdea({
      project_id: project.id,
      title: 'I',
      description: 'd'.repeat(20),
    });
    ideaId = idea.id;
  });

  afterEach(() => {
    resetTestDatabase();
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('returns empty for missing staging', async () => {
    const r = await generateDiff(ideaId, tmp);
    assert.equal(r.fileCount, 0);
    assert.equal(r.diff, '');
  });

  it('detects added file in staging', async () => {
    const stagingDir = path.join(tmp, '.cobuilder', 'staging', ideaId);
    fs.mkdirSync(stagingDir, { recursive: true });
    fs.writeFileSync(path.join(stagingDir, 'new.txt'), 'hello');
    upsertStagingFile(ideaId, 'new.txt', 'add', 5, false);
    const r = await generateDiff(ideaId, tmp);
    assert.ok(r.fileCount >= 1);
  });

  it('lists truncated staging paths', async () => {
    const { getDb } = await import('@/lib/db');
    const { listStagingFiles } = await import('@/lib/db/pipeline-db');
    getDb()
      .prepare(
        `INSERT INTO staging_files (id, idea_id, rel_path, modify_type, size_bytes, truncated)
         VALUES (?, ?, ?, ?, ?, 1)`
      )
      .run(crypto.randomUUID(), ideaId, 'big.ts', 'add', 100);
    const row = listStagingFiles(ideaId).find((f: { rel_path: string }) => f.rel_path === 'big.ts');
    assert.equal(row?.truncated, 1);
    const r = await generateDiff(ideaId, tmp);
    assert.deepEqual(r.truncatedFiles, ['big.ts']);
  });
});
