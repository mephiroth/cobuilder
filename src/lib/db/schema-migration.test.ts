import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createBareTestDatabase } from './test-db';
import { runSchemaMigrationV2 } from './pipeline-db';

describe('schema migration v2', () => {
  let db: ReturnType<typeof createBareTestDatabase>;

  beforeEach(() => {
    db = createBareTestDatabase();
    const pid = crypto.randomUUID();
    const iid = crypto.randomUUID();
    db.prepare(
      'INSERT INTO projects (id, name, codebase_dir) VALUES (?, ?, ?)'
    ).run(pid, 'P', '/tmp');
    db.prepare(
      `INSERT INTO ideas (id, project_id, title, description, status) VALUES (?, ?, ?, ?, ?)`
    ).run(iid, pid, 'Old', 'desc', 'pending');
  });

  it('maps legacy status and is idempotent', () => {
    runSchemaMigrationV2(db);
    const idea = db.prepare('SELECT status FROM ideas LIMIT 1').get() as { status: string };
    assert.equal(idea.status, 'submitted');

    const count1 = db
      .prepare("SELECT COUNT(*) as c FROM audit_logs WHERE event_type = 'schema_migration_v2'")
      .get() as { c: number };
    assert.equal(Number(count1.c), 1);

    runSchemaMigrationV2(db);
    const count2 = db
      .prepare("SELECT COUNT(*) as c FROM audit_logs WHERE event_type = 'schema_migration_v2'")
      .get() as { c: number };
    assert.equal(Number(count2.c), 1);
  });
});
