// @ts-ignore - node:sqlite is built into Node.js 22+ but types may not be available
import { DatabaseSync } from 'node:sqlite';
import * as path from 'path';
import * as fs from 'fs';

const DB_PATH = path.join(process.cwd(), 'data', 'cobuilder.db');

let _db: any = null;

function getDb(): any {
  if (_db) return _db;

  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  _db = new DatabaseSync(DB_PATH);
  _db.exec('PRAGMA journal_mode = WAL');
  _db.exec('PRAGMA foreign_keys = ON');

  // Create tables
  const schema = fs.readFileSync(
    path.join(process.cwd(), 'src', 'lib', 'db', 'schema.sql'),
    'utf-8'
  );
  const statements = schema.split(';').map((s: string) => s.trim()).filter((s: string) => s.length > 0);
  for (const stmt of statements) {
    try {
      _db.exec(stmt);
    } catch {
      // Table already exists
    }
  }

  // Seed default project if empty
  const row = _db.prepare('SELECT COUNT(*) as c FROM projects').get();
  if (row.c === 0) {
    const codebaseDir = process.env.CODEBASE_DIR || '/Users/gouzh/work/alice';
    _db.prepare('INSERT INTO projects (id, name, codebase_dir, description) VALUES (?, ?, ?, ?)').run(
      crypto.randomUUID(), 'Alice', codebaseDir, 'Alice AI Butler 产品'
    );
  }

  return _db;
}

// ===== Types =====
export interface Project {
  id: string;
  name: string;
  codebase_dir: string;
  description?: string;
  created_at: string;
}

export interface Idea {
  id: string;
  project_id: string;
  title: string;
  description: string;
  status: string;
  votes: number;
  author_name: string;
  author_contact?: string;
  client_id?: string;
  clarification_doc?: string;
  version?: string;
  screenshots: string;
  source: string;
  visible: number;
  moderation_status: string;
  created_at: string;
  updated_at: string;
}

export interface Comment {
  id: string;
  idea_id: string;
  author_name: string;
  content: string;
  is_admin: number;
  visible: number;
  created_at: string;
}

export interface Notification {
  id: string;
  idea_id: string;
  target_client_id: string;
  status: string;
  read: number;
  created_at: string;
  idea_title?: string;
}

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
    VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?)
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
  if (filters?.offset) {
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
  const fields = Object.keys(updates).filter(k => k !== 'id' && k !== 'created_at');
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
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_count,
      SUM(CASE WHEN status = 'clarified' THEN 1 ELSE 0 END) as clarified_count,
      SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress_count,
      SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END) as published_count,
      SUM(CASE WHEN status = 'deferred' THEN 1 ELSE 0 END) as deferred_count,
      SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END) as closed_count
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
export interface PipelineRun {
  id: string;
  idea_id: string;
  stage: string;
  agent_id: string | null;
  status: string;
  input_data: string | null;
  output_data: string | null;
  error: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

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
  const fields = Object.keys(updates).filter(k => k !== 'id' && k !== 'created_at');
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

// ===== Requirement Docs =====
export interface RequirementDoc {
  id: string;
  idea_id: string;
  version: number;
  content: string;
  generated_by: string | null;
  reviewed: number;
  review_decision: string | null;
  review_comments: string | null;
  created_at: string;
}

export function createRequirementDoc(ideaId: string, content: string, generatedBy?: string): RequirementDoc {
  const id = crypto.randomUUID();
  // Get next version
  const last = getDb().prepare(
    'SELECT MAX(version) as v FROM requirement_docs WHERE idea_id = ?'
  ).get(ideaId) as any;
  const version = (last?.v || 0) + 1;

  getDb().prepare(
    'INSERT INTO requirement_docs (id, idea_id, version, content, generated_by) VALUES (?, ?, ?, ?, ?)'
  ).run(id, ideaId, version, content, generatedBy || null);
  return getDb().prepare('SELECT * FROM requirement_docs WHERE id = ?').get(id) as RequirementDoc;
}

export function getRequirementDocs(ideaId: string): RequirementDoc[] {
  return getDb().prepare(
    'SELECT * FROM requirement_docs WHERE idea_id = ? ORDER BY version DESC'
  ).all(ideaId) as RequirementDoc[];
}

export function getLatestRequirementDoc(ideaId: string): RequirementDoc | undefined {
  return getDb().prepare(
    'SELECT * FROM requirement_docs WHERE idea_id = ? ORDER BY version DESC LIMIT 1'
  ).get(ideaId) as RequirementDoc | undefined;
}

export function reviewRequirementDoc(id: string, decision: string, comments?: string): void {
  getDb().prepare(
    'UPDATE requirement_docs SET reviewed = 1, review_decision = ?, review_comments = ? WHERE id = ?'
  ).run(decision, comments || null, id);
}
