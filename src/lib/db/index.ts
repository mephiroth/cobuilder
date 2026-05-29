// @ts-ignore - node:sqlite is built into Node.js 22+ but types may not be available
import { DatabaseSync } from 'node:sqlite';
import * as path from 'path';
import * as fs from 'fs';
import type { Project, Idea, Comment, Notification, PipelineRun, RequirementDoc } from './types';
import { applySchemaToDb } from './embedded-schema';

const DB_PATH = path.join(process.cwd(), 'data', 'cobuilder.db');

let _db: any = null;

function wirePipelineDb(db: DatabaseSync, runMigration = true): void {
  const { setDbGetter, runSchemaMigrationV2 } = require('./pipeline-db') as typeof import('./pipeline-db');
  setDbGetter(() => db);
  if (runMigration) runSchemaMigrationV2(db);
}

/** 测试用：绑定内存库并应用 schema */
export function bindTestDatabase(db: DatabaseSync, options?: { runMigration?: boolean }): void {
  _db = db;
  db.exec('PRAGMA foreign_keys = ON');
  applySchemaToDb(db);
  wirePipelineDb(db, options?.runMigration !== false);
}

export function resetTestDatabase(): void {
  _db = null;
  try {
    const { setDbGetter } = require('./pipeline-db') as typeof import('./pipeline-db');
    setDbGetter(() => {
      throw new Error('Test database not bound');
    });
  } catch {
    /* pipeline-db not loaded */
  }
}

export { applySchemaToDb } from './embedded-schema';

export function getDb(): any {
  if (_db) return _db;

  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  _db = new DatabaseSync(DB_PATH);
  _db.exec('PRAGMA journal_mode = WAL');
  _db.exec('PRAGMA foreign_keys = ON');
  applySchemaToDb(_db);
  wirePipelineDb(_db);

  const row = _db.prepare('SELECT COUNT(*) as c FROM projects').get();
  if (row.c === 0) {
    const codebaseDir = process.env.CODEBASE_DIR || process.cwd();
    const name = process.env.DEFAULT_PROJECT_NAME || 'Default';
    _db.prepare('INSERT INTO projects (id, name, codebase_dir, description) VALUES (?, ?, ?, ?)').run(
      crypto.randomUUID(), name, codebaseDir, null
    );
  }

  return _db;
}

// Re-export types from types.ts
export type {
  Project,
  Idea,
  Comment,
  Notification,
  PipelineRun,
  RequirementDoc,
  LifecycleStatus,
  DocumentType,
  PRD,
  UIBrief,
  DevPlan,
  TestDoc,
} from './types';

export * from './pipeline-db';

// ===== Projects =====
export function listProjects(): Project[] {
  return getDb().prepare('SELECT * FROM projects ORDER BY created_at DESC').all() as Project[];
}

export function getProject(id: string): Project | undefined {
  return getDb().prepare('SELECT * FROM projects WHERE id = ?').get(id) as Project | undefined;
}

export function createProject(name: string, codebaseDir: string, description?: string): Project {
  const id = crypto.randomUUID();
  getDb().prepare('INSERT INTO projects (id, name, codebase_dir, description) VALUES (?, ?, ?, ?)').run(
    id, name, codebaseDir, description || null
  );
  return getProject(id)!;
}

export function updateProject(id: string, updates: { name?: string; codebase_dir?: string; description?: string }): void {
  const ALLOWED = ['name', 'codebase_dir', 'description'];
  const fields = Object.keys(updates).filter(k => ALLOWED.includes(k));
  if (fields.length === 0) return;
  const sets = fields.map(f => `${f} = ?`).join(', ');
  const values = fields.map(f => (updates as Record<string, any>)[f]);
  getDb().prepare(`UPDATE projects SET ${sets} WHERE id = ?`).run(...values, id);
}

// ===== Ideas =====
export function createIdea(idea: {
  project_id: string;
  title: string;
  description: string;
  author_name?: string;
  author_contact?: string;
  client_id?: string;
  screenshots?: string;
  source?: string;
}): Idea {
  const id = crypto.randomUUID();
  getDb().prepare(`
    INSERT INTO ideas (id, project_id, title, description, status, author_name, author_contact, client_id, screenshots, source)
    VALUES (?, ?, ?, ?, 'submitted', ?, ?, ?, ?, ?)
  `).run(
    id, idea.project_id, idea.title, idea.description,
    idea.author_name || '匿名', idea.author_contact || null,
    idea.client_id || null, idea.screenshots || '[]', idea.source || 'web'
  );
  return getIdea(id)!;
}

export function getIdea(id: string): Idea | undefined {
  return getDb().prepare('SELECT * FROM ideas WHERE id = ?').get(id) as Idea | undefined;
}

export function listIdeas(filters?: {
  project_id?: string;
  status?: string;
  visible?: boolean;
  limit?: number;
  offset?: number;
}): Idea[] {
  let sql = 'SELECT * FROM ideas WHERE 1=1';
  const params: any[] = [];

  if (filters?.project_id) {
    sql += ' AND project_id = ?';
    params.push(filters.project_id);
  }
  if (filters?.status) {
    sql += ' AND status = ?';
    params.push(filters.status);
  }
  if (filters?.visible !== undefined) {
    sql += ' AND visible = ?';
    params.push(filters.visible ? 1 : 0);
  }

  sql += ' ORDER BY votes DESC, created_at DESC';

  if (filters?.limit) {
    sql += ' LIMIT ?';
    params.push(filters.limit);
  }
  if (filters?.offset !== undefined) {
    sql += ' OFFSET ?';
    params.push(filters.offset);
  }

  return getDb().prepare(sql).all(...params) as Idea[];
}

export function countIdeas(projectId?: string, status?: string): number {
  let sql = 'SELECT COUNT(*) as c FROM ideas WHERE 1=1';
  const params: any[] = [];
  if (projectId) { sql += ' AND project_id = ?'; params.push(projectId); }
  if (status) { sql += ' AND status = ?'; params.push(status); }
  const row = getDb().prepare(sql).get(...params) as any;
  return Number(row?.c || 0);
}

export function updateIdea(id: string, updates: Partial<Idea>): void {
  const ALLOWED = ['title','description','status','votes','author_name','author_contact',
    'client_id','clarification_doc','version','screenshots','source','visible','moderation_status','defer_until'];
  const fields = Object.keys(updates).filter(k => ALLOWED.includes(k));
  if (fields.length === 0) return;
  const sets = fields.map(f => `${f} = ?`).join(', ');
  const values = fields.map(f => (updates as Record<string, any>)[f]);
  getDb().prepare(`UPDATE ideas SET ${sets}, updated_at = datetime('now') WHERE id = ?`).run(...values, id);
}

// ===== Votes =====
export function addVote(ideaId: string, voterId: string): boolean {
  try {
    getDb().prepare('INSERT INTO votes (id, idea_id, voter_id) VALUES (?, ?, ?)').run(
      crypto.randomUUID(), ideaId, voterId
    );
    getDb().prepare('UPDATE ideas SET votes = votes + 1 WHERE id = ?').run(ideaId);
    return true;
  } catch {
    return false;
  }
}

// ===== Comments =====
export function addComment(ideaId: string, authorName: string, content: string, isAdmin = false): Comment {
  const id = crypto.randomUUID();
  getDb().prepare('INSERT INTO comments (id, idea_id, author_name, content, is_admin) VALUES (?, ?, ?, ?, ?)').run(
    id, ideaId, authorName, content, isAdmin ? 1 : 0
  );
  return getDb().prepare('SELECT * FROM comments WHERE id = ?').get(id) as Comment;
}

export function listComments(ideaId: string): Comment[] {
  return getDb().prepare('SELECT * FROM comments WHERE idea_id = ? AND visible = 1 ORDER BY created_at ASC').all(ideaId) as Comment[];
}

export function countComments(ideaId: string): number {
  const row = getDb().prepare('SELECT COUNT(*) as c FROM comments WHERE idea_id = ? AND visible = 1').get(ideaId) as any;
  return Number(row?.c || 0);
}

export function deleteComment(id: string): void {
  getDb().prepare('DELETE FROM comments WHERE id = ?').run(id);
}

export function deleteIdeaCascade(id: string): void {
  const db = getDb();
  db.prepare('DELETE FROM comments WHERE idea_id = ?').run(id);
  db.prepare('DELETE FROM votes WHERE idea_id = ?').run(id);
  db.prepare('DELETE FROM notifications WHERE idea_id = ?').run(id);
  db.prepare('DELETE FROM ideas WHERE id = ?').run(id);
}

// ===== Notifications =====
export function createNotification(ideaId: string, clientId: string, status: string): void {
  const existing = getDb().prepare(
    'SELECT id FROM notifications WHERE idea_id = ? AND target_client_id = ? AND status = ?'
  ).get(ideaId, clientId, status);
  if (existing) return;

  getDb().prepare('INSERT INTO notifications (id, idea_id, target_client_id, status) VALUES (?, ?, ?, ?)').run(
    crypto.randomUUID(), ideaId, clientId, status
  );
}

export function getUnreadNotifications(clientId: string): Notification[] {
  return getDb().prepare(
    `SELECT n.*, i.title as idea_title FROM notifications n
     JOIN ideas i ON n.idea_id = i.id
     WHERE n.target_client_id = ? AND n.read = 0
     ORDER BY n.created_at DESC`
  ).all(clientId) as Notification[];
}

export function markNotificationRead(id: string): void {
  getDb().prepare('UPDATE notifications SET read = 1 WHERE id = ?').run(id);
}

// ===== Stats =====
export function getStats(projectId?: string) {
  let sql = `
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status = 'submitted' THEN 1 ELSE 0 END) as submitted_count,
      SUM(CASE WHEN status IN ('analyzing','pending_prd','designing','pending_design') THEN 1 ELSE 0 END) as review_count,
      SUM(CASE WHEN status IN ('dev_pending','testing','pending_merge') THEN 1 ELSE 0 END) as pipeline_count,
      SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) as done_count,
      SUM(CASE WHEN status = 'deferred' THEN 1 ELSE 0 END) as deferred_count,
      SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected_count
    FROM ideas
  `;
  const params: any[] = [];
  if (projectId) {
    sql += ' WHERE project_id = ?';
    params.push(projectId);
  }
  return getDb().prepare(sql).get(...params);
}

// ===== Pipeline Runs =====
export function createPipelineRun(ideaId: string, stage: string, agentId?: string): PipelineRun {
  const id = crypto.randomUUID();
  getDb().prepare(
    'INSERT INTO pipeline_runs (id, idea_id, stage, agent_id, status) VALUES (?, ?, ?, ?, ?)'
  ).run(id, ideaId, stage, agentId || null, 'pending');
  return getDb().prepare('SELECT * FROM pipeline_runs WHERE id = ?').get(id) as PipelineRun;
}

export function getPipelineRuns(ideaId: string): PipelineRun[] {
  return getDb().prepare(
    'SELECT * FROM pipeline_runs WHERE idea_id = ? ORDER BY created_at ASC'
  ).all(ideaId) as PipelineRun[];
}

export function updatePipelineRun(id: string, updates: Partial<PipelineRun>): void {
  const ALLOWED = ['stage','agent_id','status','input_data','output_data','error','started_at','completed_at','stage_name','used_fallback'];
  const fields = Object.keys(updates).filter(k => ALLOWED.includes(k));
  if (fields.length === 0) return;
  const sets = fields.map(f => `${f} = ?`).join(', ');
  const values = fields.map(f => (updates as Record<string, any>)[f]);
  getDb().prepare(`UPDATE pipeline_runs SET ${sets} WHERE id = ?`).run(...values, id);
}

export function getLatestPipelineRun(ideaId: string, stage: string): PipelineRun | undefined {
  return getDb().prepare(
    'SELECT * FROM pipeline_runs WHERE idea_id = ? AND stage = ? ORDER BY created_at DESC LIMIT 1'
  ).get(ideaId, stage) as PipelineRun | undefined;
}

// ===== Requirement Docs (legacy wrappers) =====
export function createRequirementDoc(ideaId: string, content: string, generatedBy?: string): RequirementDoc {
  const { saveDocument } = require('./pipeline-db') as typeof import('./pipeline-db');
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(content);
  } catch {
    parsed = { raw: content };
  }
  return saveDocument(ideaId, 'prd', parsed, generatedBy);
}

export function getRequirementDocs(ideaId: string): RequirementDoc[] {
  const { listDocVersions } = require('./pipeline-db') as typeof import('./pipeline-db');
  return listDocVersions(ideaId, 'prd');
}

export function getLatestRequirementDoc(ideaId: string): RequirementDoc | undefined {
  const { getLatestDoc } = require('./pipeline-db') as typeof import('./pipeline-db');
  return getLatestDoc(ideaId, 'prd');
}

export function reviewRequirementDoc(id: string, decision: string, comments?: string): void {
  getDb().prepare(
    'UPDATE requirement_docs SET reviewed = 1, review_decision = ?, review_comments = ? WHERE id = ?'
  ).run(decision, comments || null, id);
}
