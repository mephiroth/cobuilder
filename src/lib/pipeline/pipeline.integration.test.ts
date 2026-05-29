import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { resetTestDatabase, createProject, createIdea, getIdea } from '@/lib/db';
import { createTestDatabase } from '@/lib/db/test-db';
import { setMimoTestHook } from '@/lib/ai/client';
import { setSelectBestAgentForTests } from '@/lib/agents/dispatcher';
import { mimoRouter } from './test-fixtures';
import { startPipeline, handleGate } from './index';
import { runStage1, runStage2, runStage3, runStage4 } from './orchestrator';
import { saveDocument } from '@/lib/db/pipeline-db';
import { samplePRD } from './test-fixtures';
import { incrementDevRetryCount } from '@/lib/db/pipeline-db';
import { updateProjectExtended } from '@/lib/db/pipeline-db';

describe('pipeline integration', () => {
  let tmp: string;

  beforeEach(() => {
    createTestDatabase();
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cobuilder-e2e-'));
    setMimoTestHook(async (prompt) => mimoRouter(prompt));
    setSelectBestAgentForTests(() => null);
  });

  afterEach(() => {
    setMimoTestHook(null);
    setSelectBestAgentForTests(undefined);
    resetTestDatabase();
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('submitted → analyzing → pending_prd via stage1', async () => {
    const project = createProject('E2E', tmp);
    const idea = createIdea({
      project_id: project.id,
      title: 'Flow',
      description: 'x'.repeat(30),
    });
    await startPipeline(idea.id, 'admin');
    assert.equal(getIdea(idea.id)?.status, 'analyzing');
    await runStage1(idea.id);
    assert.equal(getIdea(idea.id)?.status, 'pending_prd');
  });

  it('full flow without design stage to done', async () => {
    const project = createProject('E2E', tmp);
    const idea = createIdea({
      project_id: project.id,
      title: 'Full',
      description: 'x'.repeat(30),
    });

    await startPipeline(idea.id, 'admin');
    await runStage1(idea.id);

    await handleGate({
      ideaId: idea.id,
      gate: 'gate1',
      decision: 'approve',
      actorId: 'admin',
    });
    assert.equal(getIdea(idea.id)?.status, 'dev_pending');

    await runStage3(idea.id);
    assert.equal(getIdea(idea.id)?.status, 'testing');

    await runStage4(idea.id);
    assert.equal(getIdea(idea.id)?.status, 'pending_merge');

    const stagingDir = path.join(tmp, '.cobuilder', 'staging', idea.id);
    assert.ok(fs.existsSync(path.join(stagingDir, 'src/demo.ts')));

    await handleGate({
      ideaId: idea.id,
      gate: 'gate3',
      decision: 'approve',
      actorId: 'admin',
    });
    assert.equal(getIdea(idea.id)?.status, 'done');
    assert.ok(fs.existsSync(path.join(tmp, 'src/demo.ts')));
  });

  it('design stage path with gate2 approve', async () => {
    const project = createProject('Design', tmp);
    updateProjectExtended(project.id, { enable_design_stage: 1 });
    const idea = createIdea({
      project_id: project.id,
      title: 'Design flow',
      description: 'x'.repeat(30),
    });

    await startPipeline(idea.id, 'admin');
    await runStage1(idea.id);
    await handleGate({ ideaId: idea.id, gate: 'gate1', decision: 'approve', actorId: 'admin' });
    assert.equal(getIdea(idea.id)?.status, 'designing');

    await runStage2(idea.id);
    assert.equal(getIdea(idea.id)?.status, 'pending_design');

    await handleGate({ ideaId: idea.id, gate: 'gate2', decision: 'approve', actorId: 'admin' });
    assert.equal(getIdea(idea.id)?.status, 'dev_pending');
  });

  it('gate1 defer then restart', async () => {
    const project = createProject('Defer', tmp);
    const idea = createIdea({
      project_id: project.id,
      title: 'Defer',
      description: 'x'.repeat(30),
    });
    await startPipeline(idea.id, 'admin');
    await runStage1(idea.id);

    const future = new Date(Date.now() + 86400000).toISOString();
    await handleGate({
      ideaId: idea.id,
      gate: 'gate1',
      decision: 'defer',
      reason: '需要更多背景信息再决定',
      deferUntil: future,
      actorId: 'admin',
    });
    assert.equal(getIdea(idea.id)?.status, 'deferred');

    await startPipeline(idea.id, 'admin');
    assert.equal(getIdea(idea.id)?.status, 'analyzing');
  });

  it('blocks retry after 3 failures on same PRD version', async () => {
    const project = createProject('Retry', tmp);
    const idea = createIdea({
      project_id: project.id,
      title: 'Retry',
      description: 'x'.repeat(30),
    });
    const prd = saveDocument(idea.id, 'prd', samplePRD());
    const db = require('@/lib/db').getDb();
    db.prepare("UPDATE ideas SET status = 'dev_pending' WHERE id = ?").run(idea.id);
    incrementDevRetryCount(idea.id, prd.version);
    incrementDevRetryCount(idea.id, prd.version);
    incrementDevRetryCount(idea.id, prd.version);

    const { retryDev } = await import('./index');
    await assert.rejects(() => retryDev(idea.id, 'admin'), /请先修改 PRD/);
  });
});
