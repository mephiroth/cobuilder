import type { DocumentType, LifecycleStatus, PRD, Idea, Project, RequirementDoc, PipelineRun } from './types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

export function writeAuditLog(
  db: Db,
  opts: {
    ideaId: string;
    actorId: 'admin' | 'system';
    eventType: string;
    from?: string;
    to?: string;
    reason?: string;
    metadata?: Record<string, unknown>;
  }
): void {
  db.prepare(
    `INSERT INTO audit_logs (id, idea_id, actor_id, event_type, from_status, to_status, reason, metadata)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    crypto.randomUUID(),
    opts.ideaId,
    opts.actorId,
    opts.eventType,
    opts.from ?? null,
    opts.to ?? null,
    opts.reason ?? null,
    opts.metadata ? JSON.stringify(opts.metadata) : null
  );
}

export function listAuditLogs(ideaId: string, limit = 50, db?: Db) {
  const d = db ?? getDbRef();
  return d
    .prepare('SELECT * FROM audit_logs WHERE idea_id = ? ORDER BY created_at DESC LIMIT ?')
    .all(ideaId, limit);
}

export function saveDocument(
  ideaId: string,
  type: DocumentType,
  content: object,
  generatedBy = 'mimo'
): RequirementDoc {
  const db = getDbRef();
  const last = db
    .prepare('SELECT MAX(version) as v FROM requirement_docs WHERE idea_id = ? AND type = ?')
    .get(ideaId, type) as { v: number | null };
  const version = (last?.v ?? 0) + 1;
  const id = crypto.randomUUID();
  db.prepare(
    `INSERT INTO requirement_docs (id, idea_id, version, content, generated_by, type)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, ideaId, version, JSON.stringify(content), generatedBy, type);
  return db.prepare('SELECT * FROM requirement_docs WHERE id = ?').get(id) as RequirementDoc;
}

export function getLatestDoc(ideaId: string, type: DocumentType): RequirementDoc | undefined {
  return getDbRef()
    .prepare(
      'SELECT * FROM requirement_docs WHERE idea_id = ? AND type = ? ORDER BY version DESC LIMIT 1'
    )
    .get(ideaId, type) as RequirementDoc | undefined;
}

export function listDocVersions(ideaId: string, type: DocumentType): RequirementDoc[] {
  return getDbRef()
    .prepare(
      'SELECT * FROM requirement_docs WHERE idea_id = ? AND type = ? ORDER BY version DESC'
    )
    .all(ideaId, type) as RequirementDoc[];
}

export function parseDocContent<T>(doc: RequirementDoc | undefined): T | null {
  if (!doc) return null;
  try {
    return JSON.parse(doc.content) as T;
  } catch {
    return null;
  }
}

export function listRecentDoneIdeas(projectId: string, limit: number): Idea[] {
  return getDbRef()
    .prepare(
      `SELECT id, title FROM ideas WHERE project_id = ? AND status = 'done'
       ORDER BY updated_at DESC LIMIT ?`
    )
    .all(projectId, limit) as Idea[];
}

export function listActiveProjects(): Pick<Project, 'id' | 'name' | 'description'>[] {
  return getDbRef()
    .prepare(
      `SELECT id, name, description FROM projects WHERE archived = 0 ORDER BY created_at ASC`
    )
    .all() as Pick<Project, 'id' | 'name' | 'description'>[];
}

export function getDefaultActiveProject(): Project | undefined {
  return getDbRef()
    .prepare('SELECT * FROM projects WHERE archived = 0 ORDER BY created_at ASC LIMIT 1')
    .get() as Project | undefined;
}

export function updateProjectExtended(
  id: string,
  updates: Partial<Pick<Project, 'name' | 'codebase_dir' | 'description' | 'enable_design_stage' | 'archived'>>
): void {
  const ALLOWED = ['name', 'codebase_dir', 'description', 'enable_design_stage', 'archived'];
  const fields = Object.keys(updates).filter(
    (k) => ALLOWED.includes(k) && (updates as Record<string, unknown>)[k] !== undefined
  );
  if (fields.length === 0) return;
  const sets = fields.map((f) => `${f} = ?`).join(', ');
  const values = fields.map((f) => {
    const v = (updates as Record<string, unknown>)[f];
    if (f === 'description' && v === '') return null;
    return v;
  });
  getDbRef().prepare(`UPDATE projects SET ${sets} WHERE id = ?`).run(...values, id);
}

export function countIdeasForProject(projectId: string): number {
  const row = getDbRef()
    .prepare('SELECT COUNT(*) as c FROM ideas WHERE project_id = ?')
    .get(projectId) as { c: number };
  return Number(row?.c ?? 0);
}

export function updateIdeaStatus(
  ideaId: string,
  status: LifecycleStatus,
  extra?: { defer_until?: string | null }
): void {
  getDbRef()
    .prepare(
      `UPDATE ideas SET status = ?, defer_until = COALESCE(?, defer_until), updated_at = datetime('now') WHERE id = ?`
    )
    .run(status, extra?.defer_until ?? null, ideaId);
}

export function transitionIdeaInTransaction(
  ideaId: string,
  from: LifecycleStatus,
  to: LifecycleStatus,
  actorId: 'admin' | 'system',
  opts?: { reason?: string; eventType?: string; metadata?: Record<string, unknown>; defer_until?: string | null }
): void {
  const db = getDbRef();
  db.exec('BEGIN IMMEDIATE');
  try {
    const idea = db.prepare('SELECT status FROM ideas WHERE id = ?').get(ideaId) as { status: string } | undefined;
    if (!idea) throw new Error('Idea not found');
    if (idea.status !== from) throw new Error(`状态已变更为 ${idea.status}`);
    db.prepare(
      `UPDATE ideas SET status = ?, defer_until = ?, updated_at = datetime('now') WHERE id = ?`
    ).run(to, opts?.defer_until ?? null, ideaId);
    writeAuditLog(db, {
      ideaId,
      actorId,
      eventType: opts?.eventType ?? 'status_change',
      from,
      to,
      reason: opts?.reason,
      metadata: opts?.metadata,
    });
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

export function recordPipelineRun(
  ideaId: string,
  stageName: string,
  agentId: string,
  usedFallback: boolean
): PipelineRun {
  const id = crypto.randomUUID();
  const db = getDbRef();
  db.prepare(
    `INSERT INTO pipeline_runs (id, idea_id, stage, stage_name, agent_id, status, used_fallback, started_at)
     VALUES (?, ?, ?, ?, ?, 'running', ?, datetime('now'))`
  ).run(id, ideaId, stageName, stageName, agentId, usedFallback ? 1 : 0);
  return db.prepare('SELECT * FROM pipeline_runs WHERE id = ?').get(id) as PipelineRun;
}

export function getRecentPipelineRuns(ideaId: string, limit = 5): PipelineRun[] {
  return getDbRef()
    .prepare('SELECT * FROM pipeline_runs WHERE idea_id = ? ORDER BY created_at DESC LIMIT ?')
    .all(ideaId, limit) as PipelineRun[];
}

export function getLatestStage3Run(ideaId: string): PipelineRun | undefined {
  return getDbRef()
    .prepare(
      `SELECT * FROM pipeline_runs WHERE idea_id = ? AND stage_name = 'stage3_dev'
       ORDER BY created_at DESC LIMIT 1`
    )
    .get(ideaId) as PipelineRun | undefined;
}

export function incrementDevRetryCount(ideaId: string, prdVersion: number): number {
  const db = getDbRef();
  const row = db
    .prepare('SELECT count, prd_version FROM dev_retry_counts WHERE idea_id = ?')
    .get(ideaId) as { count: number; prd_version: number } | undefined;
  let next = 1;
  if (row) {
    next = row.prd_version === prdVersion ? row.count + 1 : 1;
  }
  db.prepare(
    `INSERT INTO dev_retry_counts (idea_id, prd_version, count, updated_at)
     VALUES (?, ?, ?, datetime('now'))
     ON CONFLICT(idea_id) DO UPDATE SET
       prd_version = excluded.prd_version,
       count = excluded.count,
       updated_at = datetime('now')`
  ).run(ideaId, prdVersion, next);
  return next;
}

export function getDevRetryCount(ideaId: string): { count: number; prd_version: number } | undefined {
  return getDbRef()
    .prepare('SELECT count, prd_version FROM dev_retry_counts WHERE idea_id = ?')
    .get(ideaId) as { count: number; prd_version: number } | undefined;
}

export function resetDevRetryCount(ideaId: string): void {
  getDbRef().prepare('DELETE FROM dev_retry_counts WHERE idea_id = ?').run(ideaId);
}

export function upsertStagingFile(
  ideaId: string,
  relPath: string,
  modifyType: string,
  sizeBytes: number,
  truncated: boolean
): void {
  getDbRef()
    .prepare(
      `INSERT INTO staging_files (id, idea_id, rel_path, modify_type, size_bytes, truncated)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(idea_id, rel_path) DO UPDATE SET
         modify_type = excluded.modify_type,
         size_bytes = excluded.size_bytes,
         truncated = excluded.truncated`
    )
    .run(crypto.randomUUID(), ideaId, relPath, modifyType, sizeBytes, truncated ? 1 : 0);
}

export function clearStagingFiles(ideaId: string): void {
  getDbRef().prepare('DELETE FROM staging_files WHERE idea_id = ?').run(ideaId);
}

export function listStagingFiles(ideaId: string) {
  return getDbRef()
    .prepare('SELECT * FROM staging_files WHERE idea_id = ?')
    .all(ideaId);
}

export function getTruncatedStagingPaths(ideaId: string): string[] {
  return listStagingFiles(ideaId)
    .filter((f: { truncated: number }) => Number(f.truncated) !== 0)
    .map((f: { rel_path: string }) => f.rel_path);
}

export function listNotifications(
  clientId: string,
  opts: { unreadOnly?: boolean; limit?: number; offset?: number }
) {
  let sql = `SELECT n.*, i.title as idea_title FROM notifications n
    JOIN ideas i ON n.idea_id = i.id WHERE n.target_client_id = ?`;
  const params: unknown[] = [clientId];
  if (opts.unreadOnly) {
    sql += ' AND n.read = 0';
  }
  sql += ' ORDER BY n.created_at DESC LIMIT ? OFFSET ?';
  params.push(opts.limit ?? 50, opts.offset ?? 0);
  return getDbRef().prepare(sql).all(...params);
}

export function deleteDocumentsAfterPrd(ideaId: string, db?: Db): void {
  const d = db ?? getDbRef();
  d.prepare(
    `DELETE FROM requirement_docs WHERE idea_id = ? AND type IN ('ui_brief', 'dev_plan', 'test_doc')`
  ).run(ideaId);
}

let _getDbRef: () => Db;

export function setDbGetter(fn: () => Db) {
  _getDbRef = fn;
}

function getDbRef(): Db {
  if (!_getDbRef) throw new Error('DB getter not initialized');
  return _getDbRef();
}

export function runSchemaMigrationV2(db: Db): void {
  const done = db
    .prepare("SELECT id FROM audit_logs WHERE event_type = 'schema_migration_v2' LIMIT 1")
    .get();
  if (done) return;

  const mappings: Array<[string, string]> = [
    ['pending', 'submitted'],
    ['clarified', 'pending_prd'],
    ['in_progress', 'dev_pending'],
    ['published', 'done'],
    ['closed', 'rejected'],
  ];
  for (const [from, to] of mappings) {
    db.prepare('UPDATE ideas SET status = ? WHERE status = ?').run(to, from);
  }

  const first = db.prepare('SELECT id FROM ideas LIMIT 1').get() as { id: string } | undefined;
  if (first) {
    writeAuditLog(db, {
      ideaId: first.id,
      actorId: 'system',
      eventType: 'schema_migration_v2',
      metadata: { mappings },
    });
  }
}
