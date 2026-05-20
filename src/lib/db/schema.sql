-- CoBuilder Schema

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  codebase_dir TEXT NOT NULL,
  description TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ideas (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  votes INTEGER NOT NULL DEFAULT 0,
  author_name TEXT NOT NULL DEFAULT '匿名',
  author_contact TEXT,
  client_id TEXT,
  clarification_doc TEXT,
  version TEXT,
  screenshots TEXT DEFAULT '[]',
  source TEXT NOT NULL DEFAULT 'web',
  visible INTEGER NOT NULL DEFAULT 0,
  moderation_status TEXT DEFAULT 'pending',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  idea_id TEXT NOT NULL REFERENCES ideas(id),
  author_name TEXT NOT NULL DEFAULT '匿名',
  content TEXT NOT NULL,
  is_admin INTEGER NOT NULL DEFAULT 0,
  visible INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS votes (
  id TEXT PRIMARY KEY,
  idea_id TEXT NOT NULL REFERENCES ideas(id),
  voter_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(idea_id, voter_id)
);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  idea_id TEXT NOT NULL REFERENCES ideas(id),
  target_client_id TEXT NOT NULL,
  status TEXT NOT NULL,
  read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- MVP: 流水线 + 需求文档

CREATE TABLE IF NOT EXISTS pipeline_runs (
  id TEXT PRIMARY KEY,
  idea_id TEXT NOT NULL REFERENCES ideas(id),
  stage TEXT NOT NULL,
  agent_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  input_data TEXT,
  output_data TEXT,
  error TEXT,
  started_at TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS requirement_docs (
  id TEXT PRIMARY KEY,
  idea_id TEXT NOT NULL REFERENCES ideas(id),
  version INTEGER NOT NULL DEFAULT 1,
  content TEXT NOT NULL,
  generated_by TEXT,
  reviewed INTEGER NOT NULL DEFAULT 0,
  review_decision TEXT,
  review_comments TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_ideas_project ON ideas(project_id);
CREATE INDEX IF NOT EXISTS idx_ideas_status ON ideas(status);
CREATE INDEX IF NOT EXISTS idx_ideas_visible ON ideas(visible);
CREATE INDEX IF NOT EXISTS idx_ideas_votes ON ideas(votes DESC);
CREATE INDEX IF NOT EXISTS idx_comments_idea ON comments(idea_id);
CREATE INDEX IF NOT EXISTS idx_votes_idea ON votes(idea_id);
CREATE INDEX IF NOT EXISTS idx_notifications_client ON notifications(target_client_id, read);
CREATE INDEX IF NOT EXISTS idx_pipeline_idea ON pipeline_runs(idea_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_stage ON pipeline_runs(stage, status);
CREATE INDEX IF NOT EXISTS idx_requirement_idea ON requirement_docs(idea_id);
