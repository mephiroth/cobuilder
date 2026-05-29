# Design Document — CoBuilder AI 协作链路

## Overview

本文档描述 CoBuilder 小团队协作链路的技术设计，对应 `requirements.md` 的 10 个需求（需求 0–9）。

**技术栈约束（不引入新框架）：**
- Runtime：Node.js 22+，使用内置的 `node:sqlite` 模块（`DatabaseSync`），不依赖 `better-sqlite3`（package.json 中残留的依赖将在清理任务中移除）
- Web 框架：Next.js 16.2 App Router（已有，注意 Next 16 的 `params` 是 Promise）
- AI 调用：OpenAI SDK → MiMo API（`src/lib/ai/client.ts` 已有）
- CLI Agent 调度：`src/lib/agents/dispatcher.ts` + `registry.ts` 已有，扩展即可
- 样式：Tailwind CSS v4（已有）
- 后台任务启动：`instrumentation.ts`（Next 16 标准入口）
- 无 ORM、无消息队列、无 Redis

**部署假设：** v1 仅支持**单进程部署**（`next dev` 或 `next start` 默认配置），SSE 和后台 worker 都依赖进程内状态。多进程/集群部署是 v2+ 范畴。

**v1 身份模型：** 所有 Gate 决策、写操作通过 `verifyAdmin()`（`src/lib/auth.ts` 已有）校验 `Authorization: Bearer <ADMIN_TOKEN>`。后续的 actor_id 在所有 audit log 中统一记 `"admin"`，系统自动转移记 `"system"`。

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  Browser                                            │
│  Next.js Pages  ←→  SSE（Stage 3 实时日志）          │
└──────────────────┬──────────────────────────────────┘
                   │ HTTP / SSE
┌──────────────────▼──────────────────────────────────┐
│  Next.js API Routes  (src/app/api/)                 │
│  /ideas  /admin/ideas  /admin/projects  /agents     │
│  /notifications                                     │
└──────────────────┬──────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────┐
│  Pipeline Engine  (src/lib/pipeline/)               │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────┐  │
│  │ stage1-pm   │  │ stage2-design│  │ stage3-dev│  │
│  │ stage4-test │  │ gate-manager │  │ runner    │  │
│  │ state-machine  │  log-bus      │  merge      │  │
│  └─────────────┘  └──────────────┘  └───────────┘  │
└──────────────────┬──────────────────────────────────┘
                   │
       ┌───────────┴───────────┐
       ▼                       ▼
┌─────────────┐      ┌─────────────────────┐
│ Agent Layer │      │ AI Layer            │
│ dispatcher  │      │ MiMo API (fallback) │
│ registry    │      │ src/lib/ai/         │
└─────────────┘      └─────────────────────┘
       │
┌──────▼──────────────────────────────────────────────┐
│  Data Layer  (src/lib/db/)                          │
│  node:sqlite (DatabaseSync) → data/cobuilder.db     │
│  WAL mode + foreign_keys                            │
└─────────────────────────────────────────────────────┘
```

**关键设计决策：**

- Pipeline Engine 是无状态模块，所有状态存 SQLite。Stage 内部调度通过 `triggerNextStage` 异步进行，不阻塞 HTTP 响应。
- Stage 3 的 CLI Agent 子进程通过 SSE 推送实时日志，其余 Stage 在后台同步执行后写库。
- Staging 区是 `<codebase_dir>/.cobuilder/staging/<idea_id>/` 目录，Gate 3 通过后才合入主区。
- Stage 2（AI-设计师）由 Project.`enable_design_stage` 字段控制，在 Gate 1 通过的瞬间读取并锁定。
- 后台 worker（通知重试、Gate 超时提醒）通过 `instrumentation.ts` 的 `register()` hook 启动，仅在 `runtime === 'nodejs'` 时启动。

---

## 现有代码清理范围

新设计与旧版 spec 的实现不兼容，以下文件**直接删除**，由 Pipeline Engine 替代：

| 文件 | 原职责 | 替代方案 |
|---|---|---|
| `src/app/api/pipeline/start/route.ts` | 启动旧流水线 | `POST /api/ideas/:id/pipeline` (新) |
| `src/app/api/pipeline/advance/route.ts` | 推进旧状态 | `POST /api/ideas/:id/gate` (新) |
| `src/app/api/pipeline/gate/route.ts` | 旧 Gate 决策 | `POST /api/ideas/:id/gate` (新) |
| `src/app/api/pipeline/[ideaId]/route.ts` | 旧 pipeline 状态查询 | `GET /api/admin/ideas/:id` (合并) |
| `src/app/api/admin/ideas/[id]/clarify/route.ts` | 旧澄清接口 | Stage 1 自动执行，无外部入口 |
| `src/app/api/ai/clarify/route.ts` | 旧 AI 澄清接口 | 内部化为 stage1-pm.ts |
| `src/app/api/ai/batch-clarify/route.ts` | 批量澄清 | v1 不再支持，删除 |
| `src/lib/ai/clarifier.ts` | 旧 PRD 生成逻辑 | `src/lib/pipeline/stage1-pm.ts` |
| `src/lib/ai/scanner.ts` | 旧代码扫描 | `src/lib/pipeline/stage3-dev.ts` 内部函数 |

**保留并扩展**：
- `src/lib/ai/client.ts`（MiMo 客户端，新增模型常量）
- `src/lib/ai/moderator.ts`（内容审核，与流水线正交，保留）
- `src/lib/agents/dispatcher.ts` + `registry.ts`（扩展，不重写）
- `src/lib/auth.ts`（v1 仅扩展 actor 来源识别）
- `src/lib/db/index.ts`（追加新表 + 数据迁移）

---

## 数据迁移

### 字段重命名 + 数据回填

旧 `ideas.status` 字段值为 `pending|clarified|in_progress|published|deferred|closed`，与新的 `lifecycle_status` 不兼容。迁移策略：

**保留 `status` 字段名，重新解释其含义**，避免破坏外键和索引。在数据库初始化时执行一次性迁移：

```sql
-- 在 schema 应用后执行（幂等：通过 audit_logs 是否存在判断是否已迁移）
-- 旧值 → 新值映射
UPDATE ideas SET status = 'submitted'   WHERE status = 'pending';
UPDATE ideas SET status = 'pending_prd' WHERE status = 'clarified';
UPDATE ideas SET status = 'dev_pending' WHERE status = 'in_progress';
UPDATE ideas SET status = 'done'        WHERE status = 'published';
UPDATE ideas SET status = 'deferred'    WHERE status = 'deferred';   -- 同名保留
UPDATE ideas SET status = 'rejected'    WHERE status = 'closed';     -- closed 视为驳回
```

**迁移幂等性**：在 `getDb()` 初始化逻辑中，先 `SELECT COUNT(*) FROM audit_logs`；为 0 时执行映射 + 写一条 `event_type='schema_migration_v2'` 的 audit log，之后不再重复执行。

### Schema 变更（追加字段，不破坏现有列）

```sql
-- projects 表
ALTER TABLE projects ADD COLUMN enable_design_stage INTEGER NOT NULL DEFAULT 0;
ALTER TABLE projects ADD COLUMN archived INTEGER NOT NULL DEFAULT 0;

-- ideas 表
ALTER TABLE ideas ADD COLUMN defer_until TEXT;  -- ISO 8601，搁置时的重新评估日期

-- requirement_docs 表
ALTER TABLE requirement_docs ADD COLUMN type TEXT NOT NULL DEFAULT 'prd';
-- 枚举：prd | ui_brief | dev_plan | test_doc

-- pipeline_runs 表
ALTER TABLE pipeline_runs ADD COLUMN stage_name TEXT;
-- 枚举：stage1_pm | stage2_design | stage3_dev | stage4_test
ALTER TABLE pipeline_runs ADD COLUMN used_fallback INTEGER NOT NULL DEFAULT 0;
```

**version 字段语义变更**：原 `requirement_docs.version` 是 idea 维度递增；新设计改为 **(idea_id, type) 维度**独立递增。`createRequirementDoc` 改为 `createDocument(ideaId, type, content)`，内部按 `(idea_id, type)` 取 max+1。

### 新增表

```sql
-- 审计日志（不可删除）
CREATE TABLE IF NOT EXISTS audit_logs (
  id          TEXT PRIMARY KEY,
  idea_id     TEXT NOT NULL REFERENCES ideas(id),
  actor_id    TEXT NOT NULL,              -- "admin" 或 "system"
  event_type  TEXT NOT NULL,              -- status_change | gate_decision | stage_timeout | schema_migration_v2 ...
  from_status TEXT,
  to_status   TEXT,
  reason      TEXT,
  metadata    TEXT,                       -- JSON 字符串，存额外上下文
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_audit_idea ON audit_logs(idea_id, created_at DESC);

-- staging 区文件记录（与文件系统同步，单一事实源 = 文件系统，DB 为索引）
CREATE TABLE IF NOT EXISTS staging_files (
  id          TEXT PRIMARY KEY,
  idea_id     TEXT NOT NULL REFERENCES ideas(id),
  rel_path    TEXT NOT NULL,
  modify_type TEXT NOT NULL,              -- add | modify | delete
  size_bytes  INTEGER NOT NULL DEFAULT 0,
  truncated   INTEGER NOT NULL DEFAULT 0, -- 1 = 因 50KB 上限被截断
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(idea_id, rel_path)
);
CREATE INDEX IF NOT EXISTS idx_staging_idea ON staging_files(idea_id);

-- Stage 3 重试计数（重试次数随 PRD 修改清零）
CREATE TABLE IF NOT EXISTS dev_retry_counts (
  idea_id      TEXT PRIMARY KEY REFERENCES ideas(id),
  prd_version  INTEGER NOT NULL,           -- 当前对应的 PRD version
  count        INTEGER NOT NULL DEFAULT 0,
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Gate 超时提醒计数
CREATE TABLE IF NOT EXISTS gate_overdue_reminders (
  idea_id          TEXT PRIMARY KEY REFERENCES ideas(id),
  reminder_count   INTEGER NOT NULL DEFAULT 0,
  last_sent_at     TEXT
);
```

---

## Data Models

### TypeScript 类型

```typescript
// src/lib/db/types.ts

export type LifecycleStatus =
  | 'submitted' | 'analyzing' | 'pending_prd'
  | 'designing' | 'pending_design'
  | 'dev_pending' | 'testing'
  | 'pending_merge' | 'done' | 'rejected' | 'deferred';

export type DocumentType = 'prd' | 'ui_brief' | 'dev_plan' | 'test_doc';

export type GateName = 'gate1' | 'gate2' | 'gate3';

export type GateDecision =
  | 'approve'           // 全 Gate 通用
  | 'approve_with_edit' // 全 Gate 通用，需 editedDoc
  | 'reject'            // Gate 1/3，需 reason
  | 'defer'             // Gate 1，需 reason + deferUntil
  | 'regenerate'        // Gate 2/3
  | 'skip_design'       // Gate 2 专属
  | 'reject_to_prd';    // Gate 2 专属，需 reason

// PRD 结构
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
```

---

## Components and Interfaces

### Pipeline Engine 对外接口

```typescript
// src/lib/pipeline/index.ts

export async function startPipeline(
  ideaId: string,
  actorId: string
): Promise<{ status: LifecycleStatus }>;

export async function rejectAtSubmission(
  ideaId: string,
  actorId: string,
  reason: string
): Promise<void>;

export async function handleGate(req: GateRequest): Promise<GateResponse>;

export async function retryDev(
  ideaId: string,
  actorId: string
): Promise<void>;

export function getPipelineState(ideaId: string): PipelineState;

export interface GateRequest {
  ideaId: string;
  gate: GateName;
  decision: GateDecision;
  editedDoc?: Record<string, unknown>;
  reason?: string;
  deferUntil?: string;
  actorId: string;
}

export interface GateResponse {
  success: boolean;
  nextStatus: LifecycleStatus;
  error?: string;
}

export interface PipelineState {
  idea: Idea;
  project: Project;
  prd: PRD | null;
  uiBrief: UIBrief | null;
  devPlan: DevPlan | null;
  testDoc: TestDoc | null;
  testDocFailed: boolean;
  lowConfidenceWarning: boolean;
  recentRuns: PipelineRun[];
}
```

### Stage 模块统一接口

```typescript
// src/lib/pipeline/stage-types.ts

export interface StageInput {
  idea: Idea;
  project: Project;
  previousDocs: {
    prd?: PRD;
    uiBrief?: UIBrief;
    devPlan?: DevPlan;
  };
}

export interface StageModule<TOut = Record<string, unknown>> {
  name: 'stage1_pm' | 'stage2_design' | 'stage3_dev' | 'stage4_test';
  timeoutSeconds: number;
  run(
    input: StageInput,
    onLog?: (chunk: string) => void
  ): Promise<{ doc: TOut; docType: DocumentType; meta?: Record<string, unknown> }>;
}
```

### Agent Dispatcher 扩展

```typescript
// src/lib/agents/dispatcher.ts 扩展

/** 按需求 8.2 优先级选择可用 Agent，无 Agent 时返回 null（触发 Fallback_AI） */
export function selectBestAgent(): AgentDef | null;

/** 终止指定 ideaId 对应的运行中子进程 */
export function killRunningAgent(ideaId: string): void;
```

---

## Pipeline Engine 详细设计

### 状态转移实现

```typescript
// src/lib/pipeline/state-machine.ts

const TRANSITIONS: Record<LifecycleStatus, LifecycleStatus[]> = {
  submitted:      ['analyzing', 'rejected'],
  analyzing:      ['pending_prd', 'submitted'],
  pending_prd:    ['designing', 'dev_pending', 'rejected', 'deferred'],
  designing:      ['pending_design', 'pending_prd'],
  pending_design: ['dev_pending', 'designing', 'pending_prd'],
  dev_pending:    ['testing', 'dev_pending'],
  testing:        ['pending_merge'],
  pending_merge:  ['done', 'rejected', 'dev_pending'],
  rejected:       ['submitted'],
  deferred:       ['submitted'],
  done:           [],
};

export function assertValidTransition(
  from: LifecycleStatus,
  to: LifecycleStatus
): void {
  if (!TRANSITIONS[from]?.includes(to)) {
    throw new ValidationError(`非法状态转移: ${from} → ${to}`);
  }
}
```

### startPipeline 执行流程

```
1. 校验 idea.status === 'submitted' || 'rejected' || 'deferred'
2. BEGIN IMMEDIATE 事务
   - status → 'analyzing'
   - 写 audit_logs (event_type='pipeline_started')
   - 清理可能存在的旧 PRD 之外的下游文档（deferred/rejected 重启时）
   COMMIT
3. setImmediate(() => stage1.run(...).then(handleStage1Result))
   - 不阻塞响应，调用方拿到 { status: 'analyzing' } 立即返回
4. handleStage1Result：
   - 成功 → BEGIN 事务，写 PRD doc + status='pending_prd' + audit log + 通知 admin
   - 失败 → status='submitted' + 错误 audit log + 通知 admin
   - 超时 → 同失败路径
```

### Stage 1（AI-PM）执行流程

```typescript
// src/lib/pipeline/stage1-pm.ts

export const stage1: StageModule<PRD> = {
  name: 'stage1_pm',
  timeoutSeconds: 120,

  async run(input) {
    const { idea, project } = input;

    const recentDone = listRecentDoneIdeas(project.id, 10);
    const context = buildPRDContext(project, recentDone);

    // 重试 2 次（指数退避 1s/3s），主超时由外层 runWithTimeout 控制
    const raw = await callMimoWithRetry({
      prompt: buildPRDPrompt(idea.description, context),
      retries: 2,
      backoffMs: [1000, 3000],
    });

    const prd = validatePRD(JSON.parse(raw)); // 抛出 ValidationError 触发外层处理
    return { doc: prd, docType: 'prd' };
  }
};
```

**Prompt 设计原则（统一适用于 Stage 1/2/3-A/4）：**
- System prompt 明确角色（"产品经理"/"UI 设计师"/"高级工程师"/"测试工程师"）
- 用结构化标签包裹外部输入（`<user_input>...</user_input>`、`<prd>...</prd>`），防止 prompt injection
- 要求严格 JSON 输出，字段名与 TS 接口完全对应
- 在 prompt 中嵌入 JSON Schema 让模型自校验
- `response_format: { type: 'json_object' }`

### Stage 3（AI-程序员）执行流程

```typescript
// src/lib/pipeline/stage3-dev.ts

export const stage3: StageModule<DevPlan> = {
  name: 'stage3_dev',
  timeoutSeconds: 300, // = 60(planA) + 240(planB)

  async run(input, onLog) {
    // 子步骤 A: Dev_Plan（≤60s）
    const devPlan = await runWithTimeout(
      () => generateDevPlan(input),
      60_000,
      () => { /* 标记 codebase_scanned=false */ }
    );

    // 检查 affected_files 数量（需求 5.8）
    if (devPlan.affected_files.length > 20) {
      throw new TaskTooLargeError(
        '受影响文件数超过 20，请人工拆分需求'
      );
    }

    // Dev_Plan 先存库（即使 B 失败也保留 A 产物）
    saveDocument(input.idea.id, 'dev_plan', devPlan);

    // 子步骤 B: 代码实现（≤240s）
    await runWithTimeout(
      () => executeCodeGen(input, devPlan, onLog),
      240_000,
      () => killRunningAgent(input.idea.id)
    );

    return { doc: devPlan, docType: 'dev_plan' };
  }
};

async function executeCodeGen(
  input: StageInput,
  devPlan: DevPlan,
  onLog?: (chunk: string) => void
): Promise<void> {
  const stagingDir = path.join(
    input.project.codebase_dir,
    '.cobuilder', 'staging', input.idea.id
  );
  fs.mkdirSync(stagingDir, { recursive: true });

  const agent = selectBestAgent();
  recordPipelineRun(input.idea.id, 'stage3_dev', agent?.id ?? 'mimo_fallback', !agent);

  if (agent) {
    onLog?.(`[agent] 使用 ${agent.label}\n`);
    await dispatchCodingAgent(agent, input, devPlan, stagingDir, onLog);
  } else {
    onLog?.('[fallback] 本地无可用 CLI Agent，使用 MiMo API 生成代码\n');
    await generateWithFallback(input, devPlan, stagingDir, onLog);
  }
}

async function generateWithFallback(
  input: StageInput,
  devPlan: DevPlan,
  stagingDir: string,
  onLog?: (chunk: string) => void
): Promise<void> {
  const MAX_BYTES = 50 * 1024;

  for (const file of devPlan.affected_files) {
    if (file.modify_type === 'delete') {
      upsertStagingFile(input.idea.id, file.path, '', 'delete', false);
      onLog?.(`[delete] ${file.path}\n`);
      continue;
    }

    const existing = readExistingFile(input.project.codebase_dir, file.path);
    const prompt = buildCodeGenPrompt(file, devPlan, input, existing);
    const content = await callMimoWithTimeout(prompt, 60_000);

    let truncated = false;
    let final = content;
    if (Buffer.byteLength(content, 'utf-8') > MAX_BYTES) {
      final = content.slice(0, MAX_BYTES); // 简单按字符截断（容忍多字节边界）
      truncated = true;
    }

    const dest = path.join(stagingDir, file.path);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, final, 'utf-8');
    upsertStagingFile(
      input.idea.id, file.path, final, file.modify_type, truncated
    );
    onLog?.(`[${file.modify_type}] ${file.path}${truncated ? ' (truncated)' : ''}\n`);
  }
}
```

### Gate Manager

```typescript
// src/lib/pipeline/gate-manager.ts

export async function handleGate(req: GateRequest): Promise<GateResponse> {
  const { ideaId, gate, decision, reason, actorId, editedDoc, deferUntil } = req;

  // 1. 决策合法性
  assertGateDecisionValid(gate, decision); // 见下方映射表

  // 2. reason / deferUntil 必填校验
  if (['reject', 'reject_to_prd', 'regenerate', 'defer'].includes(decision)) {
    if (!reason || reason.length < 10) {
      throw new ValidationError('原因不少于 10 字符');
    }
  }
  if (decision === 'defer') {
    if (!deferUntil || new Date(deferUntil) <= new Date()) {
      throw new ValidationError('搁置日期必须为未来日期');
    }
  }

  // 3. 计算目标状态（含 enable_design_stage 分流）
  const idea = getIdea(ideaId)!;
  const project = getProject(idea.project_id)!;
  const nextStatus = resolveNextStatus(gate, decision, project);

  // 4. 单事务：状态变更 + edited doc + audit log
  const db = getDb();
  db.exec('BEGIN IMMEDIATE');
  try {
    assertValidTransition(idea.status as LifecycleStatus, nextStatus);
    db.prepare('UPDATE ideas SET status = ?, defer_until = ?, updated_at = datetime(\'now\') WHERE id = ?')
      .run(nextStatus, deferUntil ?? null, ideaId);
    writeAuditLog(db, {
      ideaId, actorId, eventType: 'gate_decision',
      from: idea.status, to: nextStatus, reason,
      metadata: { gate, decision }
    });

    if (decision === 'approve_with_edit' && editedDoc) {
      const docType = docTypeOfGate(gate); // gate1=prd, gate2=ui_brief, gate3=test_doc
      saveDocument(ideaId, docType, editedDoc);
      // PRD 修改时清零 dev 重试计数
      if (docType === 'prd') resetDevRetryCount(ideaId);
    }

    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }

  // 5. 触发下一 Stage（异步，不阻塞响应）
  if (shouldTriggerNextStage(decision)) {
    setImmediate(() => triggerNextStage(ideaId, nextStatus).catch(logError));
  }

  return { success: true, nextStatus };
}

function resolveNextStatus(
  gate: GateName,
  decision: GateDecision,
  project: Project
): LifecycleStatus {
  if (gate === 'gate1') {
    if (decision === 'approve' || decision === 'approve_with_edit') {
      return project.enable_design_stage ? 'designing' : 'dev_pending';
    }
    if (decision === 'reject') return 'rejected';
    if (decision === 'defer')  return 'deferred';
  }
  if (gate === 'gate2') {
    if (decision === 'approve' || decision === 'approve_with_edit') return 'dev_pending';
    if (decision === 'skip_design')  return 'dev_pending';
    if (decision === 'regenerate')   return 'designing';
    if (decision === 'reject_to_prd') return 'pending_prd';
  }
  if (gate === 'gate3') {
    if (decision === 'approve' || decision === 'approve_with_edit') return 'done';
    if (decision === 'reject')     return 'rejected';
    if (decision === 'regenerate') return 'dev_pending';
  }
  throw new ValidationError(`Gate ${gate} 不支持决策 ${decision}`);
}
```

**Gate × 合法决策 × 下一状态**

| Gate | 合法决策 | 下一状态 | 触发后续 Stage |
|---|---|---|---|
| gate1 | approve / approve_with_edit | designing 或 dev_pending（按 enable_design_stage） | Stage 2 或 Stage 3 |
| gate1 | reject | rejected | 否 |
| gate1 | defer | deferred | 否 |
| gate2 | approve / approve_with_edit | dev_pending | Stage 3 |
| gate2 | skip_design | dev_pending | Stage 3 |
| gate2 | regenerate | designing | Stage 2 |
| gate2 | reject_to_prd | pending_prd | 否（等 admin 在 Gate 1 重新决策） |
| gate3 | approve / approve_with_edit | done | mergeStagingToMain |
| gate3 | reject | rejected | 否 |
| gate3 | regenerate | dev_pending | Stage 3 |

### 超时控制

不引入独立 cron。每个 Stage 的执行入口包一层 `runWithTimeout`：

```typescript
// src/lib/pipeline/runner.ts

export async function runWithTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number,
  onTimeout: () => void
): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeoutP = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      try { onTimeout(); } catch { /* swallow */ }
      reject(new TimeoutError(`执行超时（${timeoutMs / 1000}s）`));
    }, timeoutMs);
  });
  try {
    return await Promise.race([fn(), timeoutP]);
  } finally {
    clearTimeout(timer!);
  }
}
```

超时回退路径（统一在 `triggerNextStage` 调用方处理）：

| 来源状态 | 超时事件 | 回退至 |
|---|---|---|
| analyzing | Stage 1 超时 | submitted |
| designing | Stage 2 超时 | pending_prd |
| dev_pending（子步骤 A） | Dev_Plan 生成超时 | 不回退，标 codebase_scanned=false 继续 B |
| dev_pending（子步骤 B） | 代码实现超时 | dev_pending（停留，等待重试） |
| testing | Stage 4 超时 | pending_merge（不回退，标 test_doc_generation_failed=true） |

---

## SSE 实时日志流（Stage 3 专属）

### API Route

```typescript
// src/app/api/ideas/[id]/pipeline/stream/route.ts

import { logBus } from '@/lib/pipeline/log-bus';

export const dynamic = 'force-dynamic';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const send = (data: object) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));

      // 推送已缓存的历史日志（避免连接前的日志丢失）
      logBus.getBuffered(id).forEach(chunk => send({ chunk }));

      const unsub = logBus.subscribe(id, (chunk) => send({ chunk }));

      // Heartbeat 保持连接（每 15s 一次注释行）
      const hb = setInterval(() => {
        controller.enqueue(encoder.encode(`: heartbeat\n\n`));
      }, 15_000);

      req.signal.addEventListener('abort', () => {
        clearInterval(hb);
        unsub();
        try { controller.close(); } catch { /* already closed */ }
      });
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    }
  });
}
```

### 进程内事件总线 + 滚动缓冲

```typescript
// src/lib/pipeline/log-bus.ts
// 仅在单进程部署下工作；多进程部署时需替换为 SQLite 轮询方案

const subs = new Map<string, Set<(chunk: string) => void>>();
const buffers = new Map<string, string[]>(); // 每个 idea 最多缓存最近 200 行
const MAX_BUFFER = 200;

export const logBus = {
  publish(ideaId: string, chunk: string) {
    const buf = buffers.get(ideaId) ?? [];
    buf.push(chunk);
    if (buf.length > MAX_BUFFER) buf.splice(0, buf.length - MAX_BUFFER);
    buffers.set(ideaId, buf);

    subs.get(ideaId)?.forEach(fn => fn(chunk));
  },
  subscribe(ideaId: string, fn: (chunk: string) => void): () => void {
    if (!subs.has(ideaId)) subs.set(ideaId, new Set());
    subs.get(ideaId)!.add(fn);
    return () => subs.get(ideaId)?.delete(fn);
  },
  getBuffered(ideaId: string): string[] {
    return [...(buffers.get(ideaId) ?? [])];
  },
  clear(ideaId: string) {
    subs.delete(ideaId);
    buffers.delete(ideaId);
  }
};
```

---

## Staging 区与代码合入

### 目录结构

```
<codebase_dir>/
  .cobuilder/
    staging/
      <idea_id>/
        src/components/NewFeature.tsx
        src/app/api/new-route/route.ts
        manifest.json                   ← { deletes: [...], created_at, used_fallback }
  src/                                  ← 主代码库
```

### Diff 生成

```typescript
// src/lib/pipeline/diff.ts
import { execFile } from 'child_process';
import { promisify } from 'util';
const execFileAsync = promisify(execFile);

export async function generateDiff(
  ideaId: string,
  codebaseDir: string
): Promise<{ diff: string; fileCount: number }> {
  const stagingDir = path.join(codebaseDir, '.cobuilder', 'staging', ideaId);
  if (!fs.existsSync(stagingDir)) return { diff: '', fileCount: 0 };

  // 用 execFile 而非 execSync，避免 shell 注入；diff 退出码 1 表示有差异（视为成功）
  let stdout = '';
  try {
    const result = await execFileAsync('diff', [
      '-rN', '--unified=3',
      codebaseDir, stagingDir,
    ], { maxBuffer: 10 * 1024 * 1024 });
    stdout = result.stdout;
  } catch (e: unknown) {
    const err = e as { code?: number; stdout?: string };
    if (err.code === 1 && err.stdout) stdout = err.stdout;
    else throw e;
  }

  const fileCount = countStagingFiles(ideaId);
  return { diff: stdout, fileCount };
}
```

### Gate 3 合入逻辑

```typescript
// src/lib/pipeline/merge.ts

export function mergeStagingToMain(
  ideaId: string,
  codebaseDir: string,
  actorId: string
): void {
  const stagingDir = path.join(codebaseDir, '.cobuilder', 'staging', ideaId);
  const manifestPath = path.join(stagingDir, 'manifest.json');
  const manifest = fs.existsSync(manifestPath)
    ? JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as { deletes?: string[] }
    : { deletes: [] };

  const db = getDb();
  db.exec('BEGIN IMMEDIATE');
  try {
    // 1. 复制 add/modify 文件
    const files = db.prepare(
      'SELECT rel_path, modify_type FROM staging_files WHERE idea_id = ? AND modify_type != ?'
    ).all(ideaId, 'delete') as Array<{ rel_path: string; modify_type: string }>;

    for (const file of files) {
      const src = path.join(stagingDir, file.rel_path);
      const dest = path.join(codebaseDir, file.rel_path);
      // 路径越界检查
      if (!path.resolve(dest).startsWith(path.resolve(codebaseDir))) {
        throw new Error(`非法路径越界: ${file.rel_path}`);
      }
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(src, dest);
    }

    // 2. 删除 delete 操作的文件
    for (const delPath of manifest.deletes ?? []) {
      const target = path.join(codebaseDir, delPath);
      if (!path.resolve(target).startsWith(path.resolve(codebaseDir))) {
        throw new Error(`非法路径越界: ${delPath}`);
      }
      if (fs.existsSync(target)) fs.unlinkSync(target);
    }

    // 3. 清理 staging 区
    fs.rmSync(stagingDir, { recursive: true, force: true });
    db.prepare('DELETE FROM staging_files WHERE idea_id = ?').run(ideaId);

    // 4. 状态推进
    db.prepare(
      'UPDATE ideas SET status = ?, updated_at = datetime(\'now\') WHERE id = ?'
    ).run('done', ideaId);

    // 5. audit log
    writeAuditLog(db, {
      ideaId, actorId, eventType: 'gate_decision',
      from: 'pending_merge', to: 'done',
      metadata: { gate: 'gate3', decision: 'approve' }
    });

    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }

  // 6. 通知（事务外执行，失败不回滚状态）
  const idea = getIdea(ideaId)!;
  if (idea.client_id) {
    createNotification(ideaId, idea.client_id, 'published');
  }
  if (idea.author_contact) {
    createNotification(ideaId, idea.client_id ?? 'external', 'external_pending');
  }
  logBus.clear(ideaId);
}
```

---

## API Routes 设计

```
src/app/api/
  projects/
    route.ts                    # GET（公开列表，仅 archived=0）
  ideas/
    route.ts                    # POST（提交需求） / GET（公开列表，仅 visible=1）
    [id]/
      pipeline/
        route.ts                # POST（启动/拒绝/重试）
        stream/route.ts         # GET（SSE 日志流）
      gate/route.ts             # POST（Gate 决策）
  agents/
    route.ts                    # GET（已有，扩展 detected_at）
  notifications/
    route.ts                    # GET（按 client_id 查询）
    [id]/read/route.ts          # POST（标记已读）
  admin/
    projects/
      route.ts                  # POST（创建）
      [id]/route.ts             # PATCH（修改）
    ideas/
      route.ts                  # GET（管理员列表，含 submitted）
      [id]/
        route.ts                # GET（详情，含 PRD/UI_Brief/Dev_Plan/Test_Doc + low_confidence_warning + test_doc_generation_failed）
        documents/route.ts      # GET ?type=...&all=1（取所有版本）
        diff/route.ts           # GET（staging 区 diff）
```

**关键接口示例：**

```http
POST /api/ideas/:id/pipeline
Authorization: Bearer <ADMIN_TOKEN>
Body: { "action": "start" | "reject" | "retry_dev", "reason"?: string }
→ 200 { status: "analyzing" | "rejected" | "dev_pending" }

POST /api/ideas/:id/gate
Authorization: Bearer <ADMIN_TOKEN>
Body: {
  "gate": "gate1" | "gate2" | "gate3",
  "decision": "approve" | "approve_with_edit" | "reject" | "defer" | "regenerate" | "skip_design" | "reject_to_prd",
  "reason"?: string,
  "editedDoc"?: object,
  "deferUntil"?: string  // ISO 8601
}
→ 200 { nextStatus: LifecycleStatus }

GET /api/admin/ideas/:id
→ 200 {
  idea, project, prd, uiBrief, devPlan, testDoc,
  lowConfidenceWarning: boolean,
  testDocGenerationFailed: boolean,
  recentRuns: PipelineRun[]
}

GET /api/admin/ideas/:id/diff
→ 200 {
  diff: string,
  fileCount: number,
  usedFallback: boolean,
  truncatedFiles: string[]
}
```

**Next.js 16 路由参数注意事项：**

所有 `[id]` 路由的 `params` 必须用 `Promise<{ id: string }>` 类型并 `await`：

```typescript
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  // ...
}
```

---

## 通知与后台 Worker

### 启动入口（Next.js 16 instrumentation）

```typescript
// instrumentation.ts (项目根目录)

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startNotificationWorker } = await import('./src/lib/notifications/worker');
    const { startGateOverdueWorker } = await import('./src/lib/notifications/gate-overdue-worker');
    startNotificationWorker();
    startGateOverdueWorker();
  }
}
```

### Gate 超时提醒 Worker

```typescript
// src/lib/notifications/gate-overdue-worker.ts

const CHECK_INTERVAL_MS = 60 * 60 * 1000; // 每小时检查一次
const REMINDER_INTERVAL_HOURS = 24;
const MAX_REMINDERS = 3;

export function startGateOverdueWorker(): void {
  const tick = () => {
    const overdue = getDb().prepare(`
      SELECT i.id, i.title, COALESCE(g.reminder_count, 0) AS sent_count,
             COALESCE(g.last_sent_at, i.updated_at) AS last_event_at
      FROM ideas i
      LEFT JOIN gate_overdue_reminders g ON g.idea_id = i.id
      WHERE i.status IN ('pending_prd', 'pending_design', 'pending_merge')
        AND datetime(COALESCE(g.last_sent_at, i.updated_at), '+${REMINDER_INTERVAL_HOURS} hours') < datetime('now')
        AND COALESCE(g.reminder_count, 0) < ${MAX_REMINDERS}
    `).all() as Array<{ id: string; sent_count: number }>;

    for (const idea of overdue) {
      createNotification(idea.id, 'admin', 'gate_overdue');
      getDb().prepare(`
        INSERT INTO gate_overdue_reminders (idea_id, reminder_count, last_sent_at)
        VALUES (?, 1, datetime('now'))
        ON CONFLICT(idea_id) DO UPDATE SET
          reminder_count = reminder_count + 1,
          last_sent_at   = datetime('now')
      `).run(idea.id);
    }
  };
  setInterval(tick, CHECK_INTERVAL_MS);
  tick(); // 启动时立即跑一次
}
```

### 通知 Worker

v1 站内通知是数据库写入即送达，不需要外部发送。`startNotificationWorker` 只负责清理超过 90 天的已读通知（轻量任务），并保留扩展点供 v2 接入外部通道。

---

## Correctness Properties

### Property 1: Gate 不可绕过
`handleGate()` 是唯一能将状态推进到 `dev_pending` / `done` 的入口；`startPipeline()` 只能将状态从 `submitted/rejected/deferred` 转到 `analyzing`；Stage 完成只能从 `analyzing→pending_prd` / `designing→pending_design` / `dev_pending→testing` / `testing→pending_merge`。任何跳过 Gate 的状态转移在 `assertValidTransition()` 处被拒绝。

**Validates: Requirements 2.4**

### Property 2: 事务原子性
所有"状态变更 + audit_log 写入 + 文档版本写入"在同一 `BEGIN IMMEDIATE` 事务内；Gate 3 的"文件复制 + 状态变更 + staging 清理"在同一事务内；任一步骤失败全部回滚。

**Validates: Requirements 2.3, 7.4**

### Property 3: Staging 区隔离
CLI Agent 和 Fallback_AI 的输出只写入 `<codebase_dir>/.cobuilder/staging/<idea_id>/`，不直接修改主代码库；只有 Gate 3 通过后的 `mergeStagingToMain()` 才修改主区。所有路径写入前做 `path.resolve()` 起始位置校验，防止路径越界。

**Validates: Requirements 5.7, 5.8, 7.4**

### Property 4: Agent 降级透明
`selectBestAgent()` 返回 null 时自动切换到 Fallback_AI；`pipeline_runs.used_fallback = 1` 记录实际路径；Gate 3 的 diff 接口返回 `usedFallback: true`，Admin 知情。

**Validates: Requirements 5.6, 8.5**

### Property 5: 超时必有处置
每个 Stage 的 `runWithTimeout()` 在超时时必然触发"状态变更（回退或带标志推进）+ audit log + admin 通知"三件事，不存在 Stage 永久卡在 `analyzing` / `designing` / `dev_pending` / `testing` 的情况。

**Validates: Requirements 2.8, 6.4**

### Property 6: 数据迁移幂等
旧 status 值映射在 DB 初始化时通过 `audit_logs` 是否存在判断是否已执行，永不重复；测试覆盖"重启后再次启动 Platform 不改动现有数据"。

**Validates: Requirements 2.3** （audit log 不可删除 + 状态映射保证现有 Idea 转入合法 lifecycle_status）

### Property 7: 重试计数与 PRD 版本绑定
Stage 3 重试计数存于 `dev_retry_counts.count`，绑定 `prd_version`；当 admin 通过 `approve_with_edit` 修改 PRD 时（PRD version 递增），计数清零。Stage 3 重试 ≥3 次且 PRD 未修改时，`/api/ideas/:id/pipeline?action=retry_dev` 返回 400 "请先修改 PRD"。

**Validates: Requirements 5.10**

---

## Error Handling

| 错误场景 | 处理方式 | 状态变化 |
|---|---|---|
| description < 10 字符 | API 校验，不创建 Idea | 无 |
| 无可用 Project（全归档） | API 拒绝，返回 400 | 无 |
| codebase_dir 不是绝对路径 | API 拒绝，返回 400 | 无 |
| MiMo API 失败 | 重试 2 次（1s/3s），3 次失败回退 | analyzing→submitted |
| Stage 1 超时（120s） | 状态回退，audit log，通知 admin | analyzing→submitted |
| Stage 2 超时（60s） | 状态回退，audit log，通知 admin | designing→pending_prd |
| Stage 3-A 超时（60s） | 标 codebase_scanned=false 继续 B | dev_pending（不变） |
| Stage 3-B 超时（240s） | 杀子进程，audit log，等待 admin 重试 | dev_pending（不变，等手动 retry） |
| Stage 4 超时（60s） | 占位 Test_Doc，标 generation_failed | testing→pending_merge |
| CLI Agent 非零退出 | 展示 stderr，等待 admin 重试（≤3 次） | dev_pending（不变） |
| affected_files > 20 | Stage 3-A 即报错，回退至 pending_prd | dev_pending→pending_prd |
| codebase_dir 不可读 | 跳过扫描，标 scan_note，继续生成 Dev_Plan | 不变 |
| Gate 3 文件合入失败 | 事务回滚，状态保持，返回 500 | 不变 |
| 路径越界 | 拒绝写入，返回 500，audit log 记录可疑事件 | 不变 |
| 非 admin 写操作 | 返回 401，无修改 | 不变 |
| 非法状态转移 | 返回 400，audit log（actor=system, event=invalid_transition） | 不变 |
| Idea 已归档 Project | API 拒绝提交，返回 400 | 不变 |

---

## Testing Strategy

### 单元测试

- `state-machine.ts`：覆盖所有 11 个状态、合法 + 非法转移共约 30 个 case
- `gate-manager.ts`：5 种决策 × 3 个 Gate 的合法性矩阵；reason 长度；deferUntil 校验；enable_design_stage 分流
- `stage1-pm.ts` 等 Stage 模块：JSON Schema 校验、超时模拟、MiMo 失败重试
- `diff.ts`：diff 生成、空 staging、大文件
- `merge.ts`：合入成功、路径越界拒绝、回滚
- 数据迁移：旧 status 全量映射 + 幂等
- log-bus：订阅/发布/缓冲/取消订阅

### 集成测试（内存 SQLite）

- 完整流水线：submitted → done（enable_design_stage = 0）
- 完整流水线：submitted → done（enable_design_stage = 1）
- Gate 1 driven `defer` → `submitted` → 再次走完
- Gate 2 driven `reject_to_prd` → `pending_prd` → admin 重新 approve
- Stage 3 CLI Agent 失败重试 → 第 3 次失败 → 必须修改 PRD 才能继续
- Stage 3 Fallback_AI 路径（mock `selectBestAgent` 返回 null）
- Stage 4 失败 → pending_merge with `test_doc_generation_failed=true`
- 24h Gate 超时 → 提醒通知

### 手动验收

- `instrumentation.ts` 启动 worker 后服务重启行为
- Gate 1/2/3 审核界面的全部决策路径
- Stage 3 SSE 实时日志流（≤2s 刷新）+ heartbeat
- Gate 3 diff 展示与文件合入
- 通知中心已读/未读筛选

---

## Phasing 建议

实施按以下顺序展开（详见 `tasks.md`）：

1. **基础设施**：数据迁移 + Schema 变更 + 类型定义 + 旧代码清理
2. **状态机 + Gate Manager**：纯逻辑层，先有完整单元测试
3. **Stage 1 + 2 + 4**：MiMo API 调用，无 SSE，相对简单
4. **Stage 3**：CLI Agent + Fallback_AI + SSE + Staging 区
5. **Gate 3 合入**：Diff + Merge
6. **API Routes**：按照接口设计章节实现
7. **Notification Worker**：instrumentation.ts 启动 + Gate 超时
8. **集成测试 + 手动验收**
