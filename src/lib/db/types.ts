export type LifecycleStatus =
  | 'submitted'
  | 'analyzing'
  | 'pending_prd'
  | 'designing'
  | 'pending_design'
  | 'dev_pending'
  | 'testing'
  | 'pending_merge'
  | 'done'
  | 'rejected'
  | 'deferred';

export type DocumentType = 'prd' | 'ui_brief' | 'dev_plan' | 'test_doc';

export type GateName = 'gate1' | 'gate2' | 'gate3';

export type GateDecision =
  | 'approve'
  | 'approve_with_edit'
  | 'reject'
  | 'defer'
  | 'regenerate'
  | 'skip_design'
  | 'reject_to_prd';

export interface PRD {
  title: string;
  background: string;
  goal: string;
  user_value: string;
  out_of_scope: string;
  acceptance_criteria: string[];
  feasibility: { level: 'high' | 'medium' | 'low'; note: string };
  priority: 'P0' | 'P1' | 'P2' | 'P3';
  priority_reason: string;
  effort_days: number;
  confidence: number;
}

export interface UIBrief {
  pages: Array<{
    name: string;
    layout_description: string;
    key_interactions: Array<{ element: string; behavior: string }>;
  }>;
  style_notes: string;
}

export interface DevPlan {
  affected_files: Array<{
    path: string;
    modify_type: 'add' | 'modify' | 'delete';
    brief_reason: string;
  }>;
  steps: string[];
  api_changes: Array<{ method: string; path: string; description: string }>;
  risks: string[];
  codebase_scanned: boolean;
  scan_note: string;
}

export interface TestDoc {
  test_cases: Array<{
    id: string;
    title: string;
    preconditions: string;
    steps: string[];
    expected_result: string;
    criteria_ref: number;
  }>;
  coverage_note: string;
}

export interface Project {
  id: string;
  name: string;
  codebase_dir: string;
  description?: string;
  enable_design_stage: number;
  archived: number;
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
  defer_until?: string;
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
  stage_name: string | null;
  used_fallback: number;
  created_at: string;
}

export interface RequirementDoc {
  id: string;
  idea_id: string;
  version: number;
  content: string;
  generated_by: string | null;
  reviewed: number;
  review_decision: string | null;
  review_comments: string | null;
  type: string;
  created_at: string;
}

export interface AuditLog {
  id: string;
  idea_id: string;
  actor_id: string;
  event_type: string;
  from_status: string | null;
  to_status: string | null;
  reason: string | null;
  metadata: string | null;
  created_at: string;
}

export interface StagingFile {
  id: string;
  idea_id: string;
  rel_path: string;
  modify_type: string;
  size_bytes: number;
  truncated: number;
  created_at: string;
}
