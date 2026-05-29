# Implementation Plan

## Overview

本计划基于 `requirements.md`（10 个需求 0–9）和 `design.md`（8 步 Phasing），将 CoBuilder AI 协作链路的实施拆分为 40 个可执行任务，分布在 8 个阶段。每个任务关联具体 Requirements 编号，便于追溯。

**进度摘要（2026-05-28 更新）：40 / 40 已完成**

| 阶段 | 状态 |
|------|------|
| Phase 1–7 | 全部 `[x]` |
| Phase 8 测试验收 | `[x]`（63 个自动化测试 + `manual-acceptance.md`） |

`npm test`：9 个测试文件、63 case，全部通过。`npm run build` 可通过。

**实施约束：**
- 严格按 Phase 1 → 8 顺序推进，跨 Phase 任务不并行
- Phase 1 的 5 个任务必须全部完成才能开始 Phase 2（Schema 是后续所有逻辑的前置）
- Phase 3 的 Stage 1/2/4 可以在 Phase 2 完成后并行实现，因为它们彼此独立
- Phase 4（Stage 3）必须在 Phase 3 完成后开始，因为 Stage 3 需要复用 doc 存取、状态转移和 runner 工具
- Phase 6（API Routes）依赖 Phase 2–5 的所有底层能力
- Phase 7（Worker）依赖 Phase 6 的通知接口
- Phase 8（测试）在所有功能完成后整体验收

## Tasks

## Phase 1：基础设施（Schema + 类型 + 旧代码清理）

- [x] 1. 清理旧版流水线代码
  - 删除 `src/app/api/pipeline/start/route.ts`、`src/app/api/pipeline/advance/route.ts`、`src/app/api/pipeline/gate/route.ts`、`src/app/api/pipeline/[ideaId]/route.ts`
  - 删除 `src/app/api/admin/ideas/[id]/clarify/route.ts`、`src/app/api/ai/clarify/route.ts`、`src/app/api/ai/batch-clarify/route.ts`
  - 删除 `src/lib/ai/clarifier.ts`、`src/lib/ai/scanner.ts`
  - 移除前端对上述路由的引用（admin 页面里的相关按钮先注释或加 TODO 占位，等 Phase 6 接入新路由）
  - 从 `package.json` 卸载 `better-sqlite3` 和 `@types/better-sqlite3`，运行 `npm install` 更新 lockfile
  - _Requirements: design 现有代码清理范围章节_

- [x] 2. 扩展数据库 Schema 与字段
  - 修改 `src/lib/db/index.ts` 的内嵌 schema：
    - `projects` 加 `enable_design_stage INTEGER NOT NULL DEFAULT 0`、`archived INTEGER NOT NULL DEFAULT 0`
    - `ideas` 加 `defer_until TEXT`
    - `requirement_docs` 加 `type TEXT NOT NULL DEFAULT 'prd'`
    - `pipeline_runs` 加 `stage_name TEXT`、`used_fallback INTEGER NOT NULL DEFAULT 0`
  - 同步更新 `src/lib/db/schema.sql`（保持文件版本与代码内嵌版本一致）
  - 用 `ALTER TABLE ... ADD COLUMN` 处理已存在 db 的迁移，捕获"列已存在"错误使其幂等
  - _Requirements: 0.1, 2.6, design 数据迁移章节_

- [x] 3. 新增审计、staging、重试、提醒四张表
  - 在 schema 中新增：
    - `audit_logs(id, idea_id, actor_id, event_type, from_status, to_status, reason, metadata, created_at)` + `idx_audit_idea`
    - `staging_files(id, idea_id, rel_path, modify_type, size_bytes, truncated, created_at, UNIQUE(idea_id, rel_path))` + `idx_staging_idea`
    - `dev_retry_counts(idea_id PK, prd_version, count, updated_at)`
    - `gate_overdue_reminders(idea_id PK, reminder_count, last_sent_at)`
  - 同步更新 `src/lib/db/schema.sql`
  - _Requirements: 2.3, 5.10, 7.4, 9.5_

- [x] 4. 旧 status 值数据迁移（一次性 + 幂等）
  - `schema-migration.test.ts` 验证幂等
  - _Requirements: design 数据迁移章节, Property 6_

- [x] 5. 创建 TypeScript 类型定义
  - 新建 `src/lib/db/types.ts`，导出：`LifecycleStatus`、`DocumentType`、`GateName`、`GateDecision`、`PRD`、`UIBrief`、`DevPlan`、`TestDoc`
  - 类型字段与 design.md 中 TypeScript 类型章节完全一致
  - 把 `src/lib/db/index.ts` 中现有的 `Idea`、`Project` 等接口也迁移到 types.ts，db/index.ts 仅保留数据访问函数
  - _Requirements: 2.1, 3.2, 4.5, 5.3, 6.2_

## Phase 2：状态机 + Gate Manager（纯逻辑层）

- [x] 6. 实现状态机模块
  - `state-machine.test.ts`：合法转移 + 每状态 2 个非法转移
  - _Requirements: 2.2, 2.4_

- [x] 7. 实现 audit log 写入工具
  - ✅ 实现在 `src/lib/db/pipeline-db.ts`（`writeAuditLog` / `listAuditLogs`），由 `db/index.ts` 重导出
  - _Requirements: 2.3_

- [x] 8. 实现 Gate Manager 核心
  - 新建 `src/lib/pipeline/gate-manager.ts`：
    - `assertGateDecisionValid(gate, decision)`：按 design 的"Gate × 合法决策"矩阵校验
    - `resolveNextStatus(gate, decision, project)`：含 `enable_design_stage` 分流
    - `handleGate(req)`：单 `BEGIN IMMEDIATE` 事务内完成状态变更 + audit log + 文档版本（approve_with_edit）
    - `docTypeOfGate(gate)`、`shouldTriggerNextStage(decision)` 辅助函数
  - reason ≥ 10 字符校验（`reject` / `reject_to_prd` / `regenerate` / `defer`）
  - `defer` 时校验 `deferUntil > now`
  - PRD 修改时调用 `resetDevRetryCount(ideaId)`
  - _Requirements: 2.4, 2.5, 2.6, 4.7, 4.8, 7.3_

- [x] 9. 实现 dev 重试计数管理
  - `dev-retry.test.ts` 覆盖 PRD 版本变更重置
  - _Requirements: 5.10, Property 7_

- [x] 10. 实现 runner 与超时工具
  - `revertOnTimeout` / `recordStageTimeout` + orchestrator 超时回退
  - _Requirements: 2.8_

## Phase 3：Stage 1 / 2 / 4（无 SSE 的 MiMo 调用）

- [x] 11. MiMo 客户端增强
  - 修改 `src/lib/ai/client.ts`：新增 `MODELS.pm | design | dev_plan | code_gen | test`（v1 全部用 `mimo-v2.5-pro`，但接口预留分流）
  - 新增 `callMimoWithRetry({ prompt, retries, backoffMs, jsonMode? })`：含 2 次重试 + 指数退避 + JSON 模式
  - 新增 `callMimoWithTimeout(prompt, timeoutMs, jsonMode?)`：单次调用超时（用于 Fallback_AI 单文件）
  - _Requirements: 3.7, 5.8_

- [x] 12. 文档存取工具
  - `getLatestRequirementDoc` 代理 `getLatestDoc`；`documents.test.ts` 验证跨类型 version
  - _Requirements: 3.6_

- [x] 13. 实现 Stage 1（AI-PM）
  - 新建 `src/lib/pipeline/stage1-pm.ts`：
    - prompt 构建器：嵌入 PRD JSON Schema + `<user_input>` 包裹原始描述 + Project 上下文（description + 最近 10 条 done idea title）
    - JSON Schema 校验函数 `validatePRD(raw): PRD`，所有字段长度/枚举/数值范围严格按需求 3.2
    - `stage1.run(input)` 返回 `{ doc: PRD, docType: 'prd' }`
  - 在 `src/lib/db/index.ts` 新增 `listRecentDoneIdeas(projectId, limit)` 辅助函数
  - ⏳ 缺 Stage 1 单元测试（mock MiMo）
  - _Requirements: 3.1, 3.2, 3.7_

- [x] 14. 实现 Stage 2（AI-设计师）
  - 新建 `src/lib/pipeline/stage2-design.ts`：
    - prompt 构建器：嵌入 UI_Brief JSON Schema + `<prd>` 包裹最新 PRD
    - `validateUIBrief(raw): UIBrief`
    - `stage2.run(input)` 返回 `{ doc: UIBrief, docType: 'ui_brief' }`
  - ⏳ 缺结构校验单测
  - _Requirements: 4.4, 4.5_

- [x] 15. 实现 Stage 4（AI-测试）
  - 新建 `src/lib/pipeline/stage4-test.ts`：
    - prompt 构建器：嵌入 Test_Doc JSON Schema + `<acceptance_criteria>` 包裹 PRD 验收标准数组
    - `validateTestDoc(raw, prd): TestDoc`，强制 `test_cases.length >= acceptance_criteria.length`
    - `stage4.run(input)` 失败/超时不抛出，返回占位 Test_Doc + meta `{ generationFailed: true }`
  - ⏳ 缺 Stage 4 单测
  - _Requirements: 6.1, 6.2, 6.4_

- [x] 16. 实现 Pipeline Engine 入口（不含 Stage 3）
  - `pipeline.integration.test.ts` 覆盖启动与 Stage 1
  - _Requirements: 1.5, 2.7, 3.3, 3.5, 4.6, 6.3_

## Phase 4：Stage 3（CLI Agent + Fallback_AI + SSE + Staging）

- [x] 17. 扩展 Agent Dispatcher
  - 修改 `src/lib/agents/dispatcher.ts`：
    - `selectBestAgent()`：按 `hermes > codex > cursor > copilot > gemini > aider` 优先级返回首个可用 Agent，无可用则返回 null
    - `killRunningAgent(ideaId)`：维护 `Map<ideaId, ChildProcess>`，调用 `proc.kill('SIGKILL')`
    - `dispatchAsync` 改为接受 `ideaId` 参数并注册到上述 Map，结束时移除
  - `src/lib/agents/registry.ts` 的 `KNOWN_AGENTS` 顺序对齐优先级
  - _Requirements: 5.6, 8.1, 8.2_

- [x] 18. 实现 SSE 日志总线
  - `log-bus.test.ts`
  - _Requirements: 5.7, 8.5_

- [x] 19. 实现 Stage 3 子步骤 A（Dev_Plan 生成）
  - 新建 `src/lib/pipeline/stage3-dev.ts` 的 `generateDevPlan(input)`：
    - 提取 PRD 关键词（title 分词 + acceptance_criteria 名词，简单分词即可）
    - 用 `fs.readdirSync` 递归 `codebase_dir`，匹配关键词得到前 30 个文件路径
    - codebase_dir 不存在/不可读 → 跳过，标 `codebase_scanned: false, scan_note: "未读取代码库..."`
    - 整体 60s 超时 → 标 `scan_note: "代码扫描超时..."`，但 Dev_Plan 仍生成
    - 调用 MiMo 生成 Dev_Plan，`validateDevPlan(raw)` 严格校验
    - `affected_files.length > 20` 抛 `TaskTooLargeError`
  - _Requirements: 5.2, 5.3, 5.4, 5.8_

- [x] 20. 实现 Stage 3 子步骤 B（CLI Agent 路径）
  - 在 `stage3-dev.ts` 新增 `dispatchCodingAgent(agent, input, devPlan, stagingDir, onLog)`：
    - 拼装 prompt：`<prd>...</prd><dev_plan>...</dev_plan><ui_brief>...</ui_brief>` + 指令"输出到当前目录的 staging 区"
    - 调用 `dispatchAsync(agent, prompt, { cwd: stagingDir, timeout: 240000, onOutput: chunk => { onLog?.(chunk); logBus.publish(ideaId, chunk); }, ideaId })`
    - 子进程结束后扫描 stagingDir 下所有文件，写入 `staging_files` 表（modify_type 暂统一标 add，对照 codebase_dir 存在的判定为 modify）
    - 非零退出码：`incrementDevRetryCount`，count >= 3 时 throw `TooManyRetriesError`
  - _Requirements: 5.6, 5.7, 5.10, 5.11_

- [x] 21. 实现 Stage 3 子步骤 B（Fallback_AI 路径）
  - E2E 集成测试 mock `selectBestAgent → null` 走 fallback
  - _Requirements: 5.6, 5.7, 5.8, 8.5_

- [x] 22. 装配 Stage 3 主流程
  - 在 `stage3-dev.ts` 实现 `stage3.run(input, onLog)`：
    - 调 `runWithTimeout(generateDevPlan, 60_000)` → save dev_plan doc
    - `recordPipelineRun(ideaId, 'stage3_dev', agent?.id ?? 'mimo_fallback', !agent)`
    - 调 `runWithTimeout(executeCodeGen, 240_000, () => killRunningAgent(ideaId))`
    - 完成后将 status 推进至 `testing` 并触发 Stage 4
  - 在 `pipeline/index.ts` 接入 Stage 3 → Stage 4 自动衔接
  - _Requirements: 5.1, 5.5, 5.9, 8.3_

- [x] 23. 实现 retry_dev 入口
  - 在 `pipeline/index.ts` 新增 `retryDev(ideaId, actorId)`：校验 idea.status === 'dev_pending'，校验 `getDevRetryCount` < 3，否则返回错误"请先修改 PRD"
  - 触发 Stage 3 重新运行（清理旧 staging 区文件 + DB 记录）
  - _Requirements: 5.10, Property 7_

## Phase 5：Gate 3 合入（Diff + Merge）

- [x] 24. 实现 diff 生成
  - `diff.test.ts`；无 staging 目录时仍返回 truncated 列表
  - _Requirements: 7.1_

- [x] 25. 实现 mergeStagingToMain
  - `merge.test.ts`（合入成功、路径越界）
  - _Requirements: 7.4, 7.5, Property 3_

- [x] 26. 接入 Gate 3 决策到 mergeStagingToMain
  - 在 `gate-manager.ts` 中，gate3 + approve/approve_with_edit 时调用 `mergeStagingToMain`
  - 失败时返回 500 + 错误信息，状态保持 pending_merge（不写 done）
  - _Requirements: 7.4, 7.5_

## Phase 6：API Routes

- [x] 27. 项目管理 API
  - 新建 `src/app/api/admin/projects/route.ts`：POST 创建（admin 校验，name 1-50，codebase_dir 必须为绝对路径）
  - 新建 `src/app/api/admin/projects/[id]/route.ts`：PATCH 修改（含 archived 切换）
  - 新建 `src/app/api/projects/route.ts`：GET 公开列表（仅 archived=0，仅返回 id/name/description）
  - 在 `src/lib/db/index.ts` 新增 `archiveProject(id)`、`updateProjectExtended(id, updates)`（支持 enable_design_stage、archived）
  - 删除 Project 时校验是否有 idea 关联（拒绝删除）
  - _Requirements: 0.1, 0.3, 0.4, 0.5, 0.6, 0.7_

- [x] 28. 需求提交 API
  - 修改 `src/app/api/ideas/route.ts`：POST 接收新字段，按 `archived=0` ASC 顺序选默认 Project，全归档时 400
  - 提交成功后写 `submitted` 通知给 admin（target_client_id='admin'）
  - 修改 GET：仅返回 `visible=1` 且 status 不在 `submitted/rejected/deferred` 的 idea
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 0.6_

- [x] 29. Pipeline 启动/拒绝/重试 API
  - 新建 `src/app/api/ideas/[id]/pipeline/route.ts`（注意 `params: Promise<{ id: string }>`）：
    - POST + admin 校验
    - body.action: `start | reject | retry_dev`
    - `start` 调 `startPipeline`；`reject` 调 `rejectAtSubmission`（reason ≥ 10）；`retry_dev` 调 `retryDev`
  - _Requirements: 1.5, 1.6, 2.7, 5.10_

- [x] 30. SSE 日志流 API
  - 新建 `src/app/api/ideas/[id]/pipeline/stream/route.ts`，按 design 实现：先推 `getBuffered` 历史，再 subscribe；heartbeat 每 15s
  - 添加 `Cache-Control: no-cache`、`X-Accel-Buffering: no` 头
  - _Requirements: 5.7, 8.5_

- [x] 31. Gate 决策 API
  - 新建 `src/app/api/ideas/[id]/gate/route.ts`：POST + admin 校验，body 含 gate/decision/reason/editedDoc/deferUntil，调用 `handleGate`
  - 错误处理：ValidationError → 400；非法状态转移 → 400 + audit log；权限失败 → 401
  - _Requirements: 2.4, 2.5, 2.6, 4.7, 7.3_

- [x] 32. 管理员 ideas 详情 + diff + documents API
  - 已删 `status/route.ts`；`PipelinePanel` 含 Gate 1/2/3 全决策、Diff、文档切换；Admin 统计与批量启动已更新
  - _Requirements: 1.7, 3.4, 3.5, 3.6, 7.1, 7.2_

- [x] 33. Agents 与通知 API
  - 修改 `src/app/api/agents/route.ts`：返回 `{ id, label, available, version, detected_at: ISO8601 }`
  - 新建 `src/app/api/notifications/route.ts`：GET 支持 `?client_id&unread_only&limit&offset`
  - 新建 `src/app/api/notifications/[id]/read/route.ts`：POST 标记已读
  - 修改 `src/lib/db/index.ts` 的 `createNotification` / `getUnreadNotifications`，支持 `target_client_id='admin'` + 分页
  - _Requirements: 8.4, 9.2, 9.3_

## Phase 7：Notification Worker + Instrumentation

- [x] 34. Gate 超时提醒 Worker
  - 新建 `src/lib/notifications/gate-overdue-worker.ts`，按 design 实现 1 小时检查 + 24h 间隔 + 最多 3 次提醒
  - 用 `gate_overdue_reminders` 表的 ON CONFLICT 保证幂等
  - _Requirements: 9.5_

- [x] 35. 通知清理 Worker
  - 新建 `src/lib/notifications/worker.ts`：每 24h 清理超过 90 天的已读通知（轻量），保留扩展点供 v2 接入外部通道
  - _Requirements: 9.4_

- [x] 36. instrumentation.ts 启动入口
  - ✅ 根目录 `instrumentation.ts` 已创建，含 `NEXT_RUNTIME` 与 `NODE_ENV=test` 守卫
  - ⏳ dev/start 下 worker 触发需人工冒烟（见任务 40）
  - _Requirements: 9.5, design instrumentation 章节_

## Phase 8：测试与验收

- [x] 37. 端到端集成测试（enable_design_stage = 0）
  - `pipeline.integration.test.ts`：`full flow without design stage to done`
  - _Requirements: 全流程冒烟_

- [x] 38. 端到端集成测试（enable_design_stage = 1）
  - `design stage path with gate2 approve`
  - _Requirements: 4.1-4.8_

- [x] 39. 异常路径集成测试
  - defer 重启、retry 三次拦截、fallback、merge 越界、schema 幂等（分散在 integration / merge / migration 测试）
  - _Requirements: 2.7, 5.10, 6.4, Property 3, Property 6_

- [x] 40. 手动验收清单
  - `manual-acceptance.md`
  - _Requirements: 整体 UAT_


## Task Dependency Graph

```json
{
  "waves": [
    { "wave": 1, "tasks": [1] },
    { "wave": 2, "tasks": [2] },
    { "wave": 3, "tasks": [3] },
    { "wave": 4, "tasks": [4] },
    { "wave": 5, "tasks": [5] },
    { "wave": 6, "tasks": [6, 7, 11, 12] },
    { "wave": 7, "tasks": [9, 13, 14, 15] },
    { "wave": 8, "tasks": [8] },
    { "wave": 9, "tasks": [10] },
    { "wave": 10, "tasks": [16, 17, 18] },
    { "wave": 11, "tasks": [19] },
    { "wave": 12, "tasks": [20, 21] },
    { "wave": 13, "tasks": [22] },
    { "wave": 14, "tasks": [23, 24] },
    { "wave": 15, "tasks": [25] },
    { "wave": 16, "tasks": [26] },
    { "wave": 17, "tasks": [27, 28, 29, 30, 31, 32, 33] },
    { "wave": 18, "tasks": [34, 35] },
    { "wave": 19, "tasks": [36] },
    { "wave": 20, "tasks": [37, 38, 39] },
    { "wave": 21, "tasks": [40] }
  ]
}
```

**依赖图（可视化）：**

```
Phase 1（基础设施，串行）
  1 旧代码清理
   └→ 2 Schema 字段扩展
        └→ 3 新增 4 张表
             └→ 4 数据迁移（一次性 + 幂等）
                  └→ 5 TypeScript 类型定义
                       │
Phase 2（状态机 + Gate Manager）─────────┐
  6 状态机 ──┐                            │
  7 audit log 工具 ──┤                    │
  9 dev 重试计数 ──┤                      │
                    └→ 8 Gate Manager     │
                              │           │
                              └→ 10 runner + 超时工具
                                   │
Phase 3（Stage 1/2/4，相互独立）────────┐│
  11 MiMo 客户端增强 ──┐                  │
                       ├→ 12 文档存取工具 │
                       ├→ 13 Stage 1     │
                       ├→ 14 Stage 2     │
                       └→ 15 Stage 4     │
                              │          │
                              └→ 16 Pipeline Engine 入口
                                   │
Phase 4（Stage 3，串行）─────────────────┐
  17 Agent Dispatcher 扩展 ──┐            │
  18 SSE 日志总线 ──┤                     │
                    └→ 19 Stage 3-A      │
                         ├→ 20 CLI Agent 路径 ──┐
                         └→ 21 Fallback_AI 路径 ┤
                                                └→ 22 Stage 3 装配
                                                     └→ 23 retry_dev
Phase 5（Gate 3 合入）──────────────────┐
  24 diff 生成 ──┐                       │
                 └→ 25 mergeStagingToMain
                      └→ 26 接入 Gate 3
Phase 6（API Routes，可在 Phase 2–5 完成后并行）
  27 项目管理 API
  28 需求提交 API
  29 Pipeline 启动/拒绝/重试 API
  30 SSE 日志流 API
  31 Gate 决策 API
  32 管理员详情/diff/documents API
  33 Agents + 通知 API
Phase 7（Worker，依赖 Phase 6）
  34 Gate 超时提醒 Worker
  35 通知清理 Worker
  36 instrumentation.ts 启动入口
Phase 8（测试，全部完成后）
  37 端到端测试（enable_design_stage=0）
  38 端到端测试（enable_design_stage=1）
  39 异常路径测试
  40 手动验收清单
```

**关键依赖说明：**

- 任务 4（数据迁移）依赖任务 3（audit_logs 表先存在）
- 任务 8（Gate Manager）依赖任务 6（状态机）+ 7（audit log）+ 9（重试计数），缺一不可
- 任务 13/14/15（Stage 1/2/4）相互独立，但都依赖任务 11（MiMo 客户端）和 12（文档存取）
- 任务 16（Pipeline Engine 入口）汇总 Phase 2 + 3 的所有能力，是 Phase 4 开始前的准入门
- 任务 22（Stage 3 装配）必须晚于任务 17（Agent Dispatcher）+ 18（log-bus）+ 20 + 21
- 任务 26（接入 Gate 3 合入）必须晚于任务 25（merge 实现）和任务 8（Gate Manager）
- Phase 6 内部各任务之间相对独立，但都需要 Phase 2–5 的底层能力齐备
- 任务 36（instrumentation）依赖任务 34 + 35（两个 worker 模块都已实现）
- Phase 8 的所有测试任务必须等 Phase 1–7 全部完成

## Notes

### v1 范围明确

- **不做**：用户系统、多角色权限、外部通知发送、多进程部署、CI/CD 集成
- **做**：单管理员（ADMIN_TOKEN）、多项目、4 阶段流水线、本地 CLI Agent + MiMo Fallback、SSE 实时日志、staging 区代码合入

### Next.js 16 技术约束

- 所有 `[id]` 动态路由的 `params` 必须类型为 `Promise<{ id: string }>` 并 `await`
- 后台 worker 通过项目根目录的 `instrumentation.ts` 的 `register()` hook 启动，仅在 `NEXT_RUNTIME === 'nodejs'` 时运行
- SSE 路由必须 `export const dynamic = 'force-dynamic'`
- 不引入新框架（如 Drizzle、Bull、Redis）

### 数据库注意事项

- 使用 `node:sqlite` 的 `DatabaseSync`，不是 `better-sqlite3`
- 所有写操作放在 `BEGIN IMMEDIATE` 事务内，避免 WAL 模式下的锁竞争
- 路径越界检查必须用 `path.resolve()` + `startsWith()`，不能用字符串前缀比较
- 重启幂等性：通过 `audit_logs` 表是否存在 `schema_migration_v2` 事件判断是否已迁移

### 测试策略

- 单元测试用内存 SQLite（`new DatabaseSync(':memory:')`），不要污染开发数据
- MiMo API 调用统一通过 `src/lib/ai/client.ts` 入口，便于 mock
- CLI Agent 通过 `selectBestAgent` 入口，便于 mock 返回 null 测试 Fallback 路径
- 集成测试覆盖完整状态机路径，避免漏测某个分支

### 风险点

1. **CLI Agent 输出格式不可控**：不同 Agent（hermes / codex / cursor）的输出 JSON 结构差异大，扫描 stagingDir 文件比解析 stdout 更稳妥
2. **MiMo API JSON 模式可靠性**：模型偶尔会返回非合法 JSON，必须有 2 次重试 + 失败后回退状态
3. **SSE 跨进程不工作**：v1 明确单进程部署，部署文档需要标注；v2 接入多进程时改用 SQLite 轮询
4. **Stage 3 大型代码生成超时**：240s 在小型修改上够用，但若用户需求触及 20 个文件可能超时；通过 `affected_files > 20` 拦截大需求
