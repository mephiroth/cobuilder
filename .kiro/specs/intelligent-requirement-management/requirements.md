# Requirements Document

## Introduction

CoBuilder 是一个面向**独立开发者和小团队**的 AI 协作链路工具。核心目标是打通从"用户提需求"到"代码合入通知用户"的完整链条，让 AI 在每个角色节点（PM、设计师、程序员、测试）上做辅助，人在关键 Gate 节点做决策。

**流水线全貌：**

```
用户提交需求（模糊描述）
        ↓
  [AI-PM]  澄清 + PRD + 技术可行性
        ↓  Gate 1：admin 确认 PRD
  [AI-设计师]  UI 方案（文字描述）        ← 默认跳过，按项目设置开启
        ↓  Gate 2：admin 确认设计方案
  [AI-程序员]  读代码库 + 实现计划 + 写代码
        ↓
  [AI-测试]  生成测试用例文档（全自动，无 Gate）
        ↓  Gate 3：admin 看 diff + 测试用例，确认合入
用户收到"需求已实现"通知
```

**目标用户：** 1–10 人的独立开发者或小团队，PM/程序员可能是同一个人，没有专职设计师和 QA。

**v1 身份模型：** 平台只区分两种身份——**管理员**（持有 `ADMIN_TOKEN`，可执行所有写操作和 Gate 决策）和**匿名用户**（可提交需求、查看可见 Idea、查看通知）。多角色与权限分配是 v2+ 范畴。

---

## Glossary

- **Project**：平台内的一个产品项目，拥有独立的需求池和代码库路径。
- **Idea**：用户提交的一条需求，从模糊描述到代码合入的完整生命周期单元，对应数据库 `ideas` 表。
- **Raw_Input**：用户提交的原始描述，未经 AI 处理。
- **Pipeline**：一条 Idea 触发的完整执行流程，包含 Stage 1–4 及各 Gate。
- **Stage**：流水线中的一个执行节点，由 AI Agent 完成，产出结构化文档或代码变更。
- **Gate**：强制人工审核节点，AI 不可绕过；流水线在 Gate 处暂停，等待管理员决策。
- **PRD**：产品需求文档，由 AI-PM（Stage 1）生成，包含背景、目标、验收标准、技术可行性。
- **UI_Brief**：AI-设计师（Stage 2）生成的 UI 方案，纯文字描述，不含图片或代码。
- **Dev_Plan**：AI-程序员（Stage 3）生成的实现计划，包含受影响文件、实现步骤、接口设计。
- **Test_Doc**：AI-测试（Stage 4）生成的测试用例文档，基于 PRD 的验收标准生成。
- **CLI_Agent**：本地已安装的命令行 AI 编程工具（Hermes、Codex、Cursor、Copilot、Gemini、Aider）。
- **Fallback_AI**：当本地无可用 CLI_Agent 时，使用 MiMo API 直接生成代码的降级路径。
- **Admin**：持有合法 `ADMIN_TOKEN` 的请求方，是 v1 阶段唯一可执行 Gate 决策的身份。
- **Lifecycle_Status**：Idea 当前所处的流水线阶段，见需求 2 的状态机定义。
- **Staging 区**：CLI Agent 或 Fallback_AI 的代码输出目录，位于 `<codebase_dir>/.cobuilder/staging/<idea_id>/`，Gate 3 通过后才合入主代码库。

---

## Requirements

### 需求 0：项目管理

**用户故事：** 作为管理员，我希望管理多个项目，以便用同一个平台跟进多个产品的需求池。

#### 验收标准

1. THE Platform SHALL 在数据库中维护 Project 列表，每个 Project 至少包含 `id`、`name`（1–50 字符）、`codebase_dir`（绝对路径）、`description`（0–500 字符，可选）、`enable_design_stage`（0/1，默认 0）、`archived`（0/1，默认 0）、`created_at`。
2. WHEN 平台首次启动且 Project 表为空，THE Platform SHALL 自动 seed 一个默认 Project，名称取自环境变量 `DEFAULT_PROJECT_NAME`（默认 `Default`），`codebase_dir` 取自环境变量 `CODEBASE_DIR`。
3. THE Platform SHALL 支持 Admin 通过 `POST /api/admin/projects` 创建新 Project，请求体含 `name`、`codebase_dir`、可选 `description` 和 `enable_design_stage`；IF `name` 长度不在 1–50 字符或 `codebase_dir` 不是绝对路径，THEN 返回 400 错误。
4. THE Platform SHALL 支持 Admin 通过 `PATCH /api/admin/projects/:id` 修改 Project 的 `name`、`codebase_dir`、`description`、`enable_design_stage`、`archived`；不可修改 `id` 和 `created_at`。
5. THE Platform SHALL 支持匿名用户通过 `GET /api/projects` 获取所有 `archived = 0` 的 Project 列表（仅返回 `id`、`name`、`description`），用于提交需求时的项目选择。
6. WHEN Project 的 `archived` 被设为 1，THE Platform SHALL 仍允许查看其历史 Idea，但拒绝向该 Project 提交新 Idea，返回 400 错误"项目已归档"。
7. THE Platform SHALL 拒绝删除已存在 Idea 的 Project；管理员需先归档（archived=1）。

---

### 需求 1：需求提交

**用户故事：** 作为用户，我希望能提交一条模糊的需求描述，让平台帮我把它变成可执行的开发任务。

#### 验收标准

1. THE Platform SHALL 提供需求提交入口（`POST /api/ideas`），支持填写：`title`（1–100 字符）、`description`（10–2000 字符）、可选 `screenshots`（最多 5 张，单张不超过 5 MB）、`author_name`（1–50 字符，默认 `匿名`）、`author_contact`（0–200 字符，可选）、`project_id`。
2. IF `description` 少于 10 字符，THEN THE Platform SHALL 拒绝提交并提示"描述过短，请补充更多信息"，不创建 Idea 记录。
3. WHEN Idea 提交成功，THE Platform SHALL 将其 Lifecycle_Status 设为 `submitted`，`visible` 设为 0（待审核），并向 Admin 创建一条"新 Idea 待启动"的站内通知。
4. IF 用户未提供 `project_id`，THEN THE Platform SHALL 默认关联 `archived = 0` 的 Project 列表中按 `created_at ASC` 排序的第一个 Project；IF 不存在任何未归档 Project，THEN 拒绝提交并返回 400 错误"暂无可用项目"。
5. THE Platform SHALL 支持 Admin 在 Idea 列表（`GET /api/admin/ideas?status=submitted`）中查看所有 `submitted` 状态的 Idea，并可通过 `POST /api/ideas/:id/pipeline` 一键启动流水线（将 Lifecycle_Status 推进至 `analyzing`）。
6. THE Platform SHALL 支持 Admin 通过 `POST /api/ideas/:id/pipeline` 时附带 `action: "reject"` 将 Idea 标记为 `rejected`（不启动流水线），并要求填写拒绝原因（不少于 10 字符）。
7. THE Platform SHALL 不支持用户编辑已提交的 Idea；如需修改，用户须重新提交。Admin 可通过 `PATCH /api/admin/ideas/:id` 修改 `title`、`description`、`visible`，但仅在 Lifecycle_Status 为 `submitted` 或 `rejected` 时允许修改 `description`。

---

### 需求 2：流水线状态机

**用户故事：** 作为管理员，我希望每条需求都有明确的生命周期状态，以便随时了解进展并在正确节点介入。

#### 验收标准

1. THE Platform SHALL 为每条 Idea 维护 Lifecycle_Status，合法状态如下：

   | Status | 含义 |
   |---|---|
   | `submitted` | 用户已提交，等待 Admin 启动流水线 |
   | `analyzing` | Stage 1（AI-PM）正在运行 |
   | `pending_prd` | Gate 1：等待 PRD 审核 |
   | `designing` | Stage 2（AI-设计师）正在运行 |
   | `pending_design` | Gate 2：等待 UI_Brief 审核 |
   | `dev_pending` | Stage 3（AI-程序员）正在运行（含 Dev_Plan 生成 + 代码实现） |
   | `testing` | Stage 4（AI-测试）正在运行 |
   | `pending_merge` | Gate 3：等待 diff + 测试用例审核 |
   | `done` | 代码已合入，用户已通知 |
   | `rejected` | 被驳回（可从 `submitted` / `pending_prd` / `pending_design` / `pending_merge` 转入） |
   | `deferred` | 已搁置（可从 `pending_prd` 转入） |

2. THE Platform SHALL 仅允许以下状态转移；任何其它转移返回 400 错误：

   ```
   submitted       → analyzing | rejected
   analyzing       → pending_prd | submitted              # submitted = Stage 1 超时回退
   pending_prd     → designing | dev_pending | rejected | deferred
   designing       → pending_design | pending_prd          # pending_prd = Stage 2 超时回退
   pending_design  → dev_pending | designing | pending_prd # designing = "重新生成"，pending_prd = "回到 PRD"
   dev_pending     → testing | dev_pending                 # dev_pending = 重试
   testing         → pending_merge                         # 测试失败也推进，Gate 3 标注
   pending_merge   → done | rejected | dev_pending         # dev_pending = "重新生成代码"
   rejected        → submitted                             # 重新启动流水线
   deferred        → submitted                             # 重新评估
   done            → (终态)
   ```

3. WHEN Lifecycle_Status 发生变更，THE Platform SHALL 在 `audit_logs` 表写入一条记录（含 `idea_id`、`actor_id`、`from_status`、`to_status`、`reason`、`created_at`），`actor_id` 为 admin 时记 `"admin"`、为系统自动转移时记 `"system"`，记录不可删除。
4. THE Platform SHALL 禁止任何跳过 Gate 节点的状态跳转；任何将 Lifecycle_Status 从 `analyzing` 直接设为 `dev_pending` 或更后续状态的请求均被拒绝，返回 400 错误。
5. IF Admin 在 Gate 1 选择"驳回"，THEN THE Platform SHALL 要求填写驳回原因（不少于 10 字符），填写完成后将 Lifecycle_Status 设为 `rejected`。
6. IF Admin 在 Gate 1 选择"搁置"，THEN THE Platform SHALL 将 Lifecycle_Status 设为 `deferred`，并允许设置 `defer_until`（必须为未来日期，ISO 8601）。
7. WHEN Idea 处于 `rejected` 或 `deferred` 状态，THE Platform SHALL 允许 Admin 通过 `POST /api/ideas/:id/pipeline` 将其重新设为 `submitted` 以重新启动流水线。
8. IF 一个 Stage 的 AI 执行超过其超时上限（Stage 1: 120s，Stage 2: 60s，Stage 3 总计: 300s（其中 Dev_Plan 生成 ≤60s，代码实现 ≤240s），Stage 4: 60s），THEN THE Platform SHALL：
   - Stage 1/2/3 超时：将 Lifecycle_Status 回退至上一个稳定状态（分别为 `submitted` / `pending_prd` / `dev_pending`），记录"执行超时"错误，并向 Admin 发送通知。
   - Stage 4 超时：仍将 Lifecycle_Status 推进至 `pending_merge`，但在 Gate 3 界面标注"测试用例生成超时，请人工补充"。

---

### 需求 3：Stage 1 — AI-PM（澄清 + PRD + 技术可行性）

**用户故事：** 作为管理员，我希望 AI 把用户的模糊描述自动转化为结构化 PRD，并附带技术可行性评估，以便减少人工整理时间。

#### 验收标准

1. WHEN Idea 进入 `analyzing` 状态，THE Platform SHALL 调用 MiMo API（Stage 1 固定使用 MiMo，不调度 CLI Agent）以 Raw_Input 和 Project 上下文（Project.description + 该 Project 中最近 10 条 `done` 状态的 Idea 标题）为输入，生成 PRD。
2. THE PRD SHALL 包含以下字段（JSON Schema 严格校验）：
   - **title**：需求标题（1–50 字符）
   - **background**：背景描述（1–200 字符）
   - **goal**：核心目标（1–200 字符）
   - **user_value**：用户价值（1–200 字符）
   - **out_of_scope**：排除范围（0–200 字符，可为空字符串）
   - **acceptance_criteria**：验收标准（数组，3–10 条，每条 1–200 字符）
   - **feasibility**：技术可行性，对象结构 `{ level: 'high'|'medium'|'low', note: string(1–200) }`
   - **priority**：优先级（`P0`|`P1`|`P2`|`P3`）
   - **priority_reason**：优先级评估理由（不少于 20 字符）
   - **effort_days**：工作量估算（数值，0.5 天为单位，范围 0.5–30）
   - **confidence**：AI 自评置信度（0–100 整数）
3. WHEN PRD 生成完成且 JSON Schema 校验通过，THE Platform SHALL 将 PRD 存入 `requirement_docs` 表（`type='prd'`），将 Lifecycle_Status 推进至 `pending_prd`，并向 Admin 发送 Gate 1 待审核通知。
4. THE Platform SHALL 在 Gate 1 审核界面（`GET /api/admin/ideas/:id`）展示：PRD 全文、Raw_Input 原文、置信度。
5. IF PRD 置信度低于 60，THEN THE Platform SHALL 在 Gate 1 审核界面返回字段 `low_confidence_warning: true`，前端据此展示"建议补充背景信息"提示。
6. WHEN Admin 编辑 PRD 并保存（Gate 决策为 `approve_with_edit`），THE Platform SHALL 在 `requirement_docs` 表新建一条 `version` 递增的记录（保留 AI 原始版本），所有版本均可通过 `GET /api/admin/ideas/:id/documents?type=prd&all=1` 查看。
7. IF MiMo API 调用失败或返回非合法 JSON，THEN THE Platform SHALL 重试最多 2 次（指数退避，1s/3s）；3 次仍失败则将 Lifecycle_Status 回退至 `submitted` 并提示"AI 服务暂时不可用，请稍后重试"。

---

### 需求 4：Stage 2 — AI-设计师（UI 方案，默认跳过）

**用户故事：** 作为管理员，我希望在需要时能让 AI 生成 UI 方案的文字描述，以便给程序员更清晰的实现参考。

#### 验收标准

1. THE Platform SHALL 通过 Project 的 `enable_design_stage` 字段（0/1）控制 Stage 2 是否启用，默认为 0；该字段在 Gate 1 通过的瞬间被读取，之后修改不影响当前 Idea。
2. WHEN Gate 1 决策为 `approve` 或 `approve_with_edit` 且 Project.`enable_design_stage = 0`，THE Platform SHALL 直接将 Lifecycle_Status 从 `pending_prd` 推进至 `dev_pending`，跳过 Stage 2。
3. WHEN Gate 1 决策为 `approve` 或 `approve_with_edit` 且 Project.`enable_design_stage = 1`，THE Platform SHALL 将 Lifecycle_Status 推进至 `designing` 并启动 Stage 2。
4. WHEN Stage 2 启动，THE Platform SHALL 调用 MiMo API 以最新 PRD 为输入，生成 UI_Brief。
5. THE UI_Brief SHALL 包含以下字段：
   - **pages**：受影响的页面或组件列表（数组，1–10 项），每项含：
     - `name`（1–50 字符）
     - `layout_description`（纯文字布局结构描述，不含代码或图片，1–500 字符）
     - `key_interactions`（数组，0–10 项，每项含 `element`（1–50 字符）和 `behavior`（1–200 字符））
   - **style_notes**：风格备注（0–200 字符，可为空）
6. WHEN UI_Brief 生成完成，THE Platform SHALL 存入 `requirement_docs`（`type='ui_brief'`），将 Lifecycle_Status 推进至 `pending_design`，向 Admin 发送 Gate 2 待审核通知。
7. THE Platform SHALL 支持 Admin 在 Gate 2 执行以下决策：
   - `approve` → `dev_pending`（直接进入开发）
   - `approve_with_edit` → `dev_pending`（保存编辑版本后进入开发）
   - `regenerate` → `designing`（保留 PRD，重新生成 UI_Brief）
   - `skip_design` → `dev_pending`（不要 UI_Brief，按 PRD 进入开发）
   - `reject_to_prd` → `pending_prd`（回到 Gate 1 重新审核 PRD）
8. IF Admin 选择 `regenerate` 或 `reject_to_prd`，THEN THE Platform SHALL 要求填写原因（不少于 10 字符）。

---

### 需求 5：Stage 3 — AI-程序员（实现计划 + 代码）

**用户故事：** 作为管理员，我希望 AI 读取代码库后生成具体的实现计划，并调度本地 CLI Agent 写代码，以便减少手动操作。

#### 验收标准

1. WHEN Idea 进入 `dev_pending` 状态，THE Platform SHALL 顺序执行两个子步骤：(A) 生成 Dev_Plan；(B) 执行代码实现。两步都在 `dev_pending` 状态内完成，不分叉中间状态。
2. **子步骤 A（≤60s）**：THE Platform SHALL 调用 MiMo API 读取 Project.`codebase_dir`，按 PRD 关键词（取 PRD.title + acceptance_criteria 中的名词）匹配源文件路径，取前 30 个文件的相对路径列表作为 prompt 上下文（不读取文件内容以控制 token，仅给文件树）。IF 子步骤 A 超时（60s），THEN 跳过代码扫描并在 Dev_Plan 中标注 `codebase_scanned: false, scan_note: "代码扫描超时，计划仅供参考"`。
3. THE Dev_Plan SHALL 包含以下字段：
   - **affected_files**：受影响文件列表（数组，1–20 项），每项含 `path`（相对 codebase_dir 的路径）、`modify_type`（`add`|`modify`|`delete`）、`brief_reason`（1–100 字符）
   - **steps**：实现步骤（数组，3–15 步，每步 1–100 字符）
   - **api_changes**：接口变更（数组，0–10 项），每项含 `method`、`path`、`description`（1–200 字符）
   - **risks**：主要风险（数组，0–5 项，每项 1–200 字符）
   - **codebase_scanned**：是否成功扫描代码库（boolean）
   - **scan_note**：扫描状态备注（0–200 字符，可为空）
4. IF Project.`codebase_dir` 不存在或无读权限，THEN THE Platform SHALL 跳过子步骤 A 的代码扫描，仅基于 PRD 生成 Dev_Plan，并标注 `codebase_scanned: false, scan_note: "未读取代码库（路径不可用），计划仅供参考"`，不视为失败。
5. WHEN Dev_Plan 生成完成，THE Platform SHALL 存入 `requirement_docs`（`type='dev_plan'`），然后进入子步骤 B。
6. **子步骤 B（≤240s）**：THE Platform SHALL 调度 Agent 执行代码实现：
   - IF 本地 PATH 上存在可用的 CLI Agent，THEN 使用本地 CLI Agent，优先级为 `hermes > codex > cursor > copilot > gemini > aider`。
   - IF 本地无可用 CLI Agent，THEN 使用 Fallback_AI（MiMo API）逐文件生成代码内容。
7. WHEN 使用本地 CLI Agent，THE Platform SHALL 将 PRD、Dev_Plan 和（如有）UI_Brief 拼接为单个 prompt 传递给 Agent（通过 stdin），Agent 的工作目录设为 `<codebase_dir>/.cobuilder/staging/<idea_id>/`，并以不超过 2 秒的刷新间隔通过 SSE（`GET /api/ideas/:id/pipeline/stream`）推送实时日志流。
8. WHEN 使用 Fallback_AI，THE Platform SHALL 按 Dev_Plan.`affected_files` 逐文件调用 MiMo API 生成代码内容，写入 staging 区。约束：
   - 单文件生成超时：60s
   - 单文件生成内容大小上限：50 KB（超出则截断并在 Gate 3 标注）
   - `affected_files` 总数上限：20（超出则在 Dev_Plan 阶段就报错，回退至 `pending_prd` 并提示"任务过大，请人工拆分"）
   - `modify_type='delete'` 的文件不调用 API，仅记录到 staging manifest
9. WHEN 代码生成完成，THE Platform SHALL 自动将 Lifecycle_Status 设为 `testing` 并触发 Stage 4。
10. IF CLI Agent 返回非零退出码，THEN THE Platform SHALL 展示完整 stderr 输出，将 Lifecycle_Status 回退至 `dev_pending`（语义为"等待管理员重试"），并支持 Admin 通过 `POST /api/ideas/:id/pipeline` 附带 `action: "retry_dev"` 重试，最多 3 次；超过 3 次后必须人工修改 PRD 或 Dev_Plan 才能再次重试（重试计数在 PRD 修改后清零）。
11. IF 子步骤 B 总执行时间超过 240s，THEN THE Platform SHALL 终止 Agent 进程，将 Lifecycle_Status 回退至 `dev_pending`，记录"代码实现超时"。

---

### 需求 6：Stage 4 — AI-测试（生成测试用例文档）

**用户故事：** 作为管理员，我希望 AI 根据 PRD 的验收标准自动生成测试用例文档，以便在合入代码前有明确的验收依据。

#### 验收标准

1. WHEN Idea 进入 `testing` 状态，THE Platform SHALL 自动调用 MiMo API，以最新 PRD 的 `acceptance_criteria` 数组为输入，生成 Test_Doc；无需人工触发，无 Gate。
2. THE Test_Doc SHALL 包含以下字段：
   - **test_cases**：测试用例列表（数组，长度 ≥ `acceptance_criteria` 数组长度，确保每条 acceptance_criteria 至少对应 1 个测试用例），每个测试用例含：
     - `id`：用例编号（`TC-001` 格式，3 位数字，从 001 起递增）
     - `title`（1–100 字符）
     - `preconditions`（0–200 字符，可为空）
     - `steps`：操作步骤（数组，1–10 步，每步 1–200 字符）
     - `expected_result`（1–200 字符）
     - `criteria_ref`：对应的 `acceptance_criteria` 索引（0-based 整数）
   - **coverage_note**：覆盖说明（1–200 字符，说明哪些验收标准已覆盖，哪些未覆盖）
3. WHEN Test_Doc 生成完成，THE Platform SHALL 存入 `requirement_docs`（`type='test_doc'`），将 Lifecycle_Status 推进至 `pending_merge`，并向 Admin 发送 Gate 3 待审核通知。
4. IF Test_Doc 生成失败、JSON 校验不通过或超时（60s），THEN THE Platform SHALL 仍将 Lifecycle_Status 推进至 `pending_merge`，写入一条占位 Test_Doc（`{ test_cases: [], coverage_note: "测试用例生成失败，请人工补充" }`），并在 Gate 3 界面返回 `test_doc_generation_failed: true`，不阻塞合入流程。

---

### 需求 7：Gate 3 — 代码合入审核

**用户故事：** 作为管理员，我希望在合入代码前能看到完整的 diff 和测试用例，以便做出有依据的合入决策。

#### 验收标准

1. WHEN Idea 进入 `pending_merge` 状态，THE Platform SHALL 通过 `GET /api/admin/ideas/:id/diff` 返回：
   - `diff`：staging 区与主代码库的 unified diff 文本
   - `file_count`：变更文件数
   - `used_fallback`：boolean，是否使用了 Fallback_AI
   - `truncated_files`：被截断的文件列表（path 数组，可为空）
2. THE Platform SHALL 通过 `GET /api/admin/ideas/:id` 返回 Gate 3 所需的全部信息：PRD 摘要（title、acceptance_criteria）、Dev_Plan.`affected_files`、Test_Doc 全文、`test_doc_generation_failed` 标志。
3. THE Platform SHALL 支持 Admin 通过 `POST /api/ideas/:id/gate` 在 Gate 3 执行以下决策：
   - `approve` → `done`（合入 staging 区代码）
   - `reject` → `rejected`（驳回，需填写 reason ≥ 10 字符）
   - `regenerate` → `dev_pending`（保留 PRD 和 Dev_Plan，重新执行 Stage 3 + Stage 4）
4. WHEN Admin 选择 `approve`，THE Platform SHALL 在单个 SQLite 事务（`BEGIN IMMEDIATE`）内执行：
   - 将 staging 区所有文件复制到 `codebase_dir` 对应路径（`add`/`modify` 操作）
   - 删除 staging manifest 中标记为 `delete` 的文件
   - 删除 `<codebase_dir>/.cobuilder/staging/<idea_id>/` 整个目录
   - 删除 `staging_files` 表中对应记录
   - 更新 Lifecycle_Status 为 `done`
   - 写入 audit log
   IF 任一步骤失败，THEN 回滚事务，Lifecycle_Status 保持 `pending_merge`，返回 500 错误并在响应中说明失败步骤。
5. WHEN Lifecycle_Status 变为 `done`，THE Platform SHALL：
   - IF 提交者留有 `client_id`，THEN 创建一条 `status='published'` 的站内通知记录（含需求标题）
   - IF 提交者留有 `author_contact`，THEN 在 `notifications` 表写入一条 `status='external_pending'` 的记录（v1 仅记录不发送，外部发送渠道为 v2 范畴）

---

### 需求 8：Agent 检测与调度

**用户故事：** 作为平台，我需要自动检测本地可用的 CLI Agent，并在无 Agent 时降级到 MiMo API，以便用户无需手动配置。

#### 验收标准

1. WHEN Platform 启动（通过 `instrumentation.ts` register hook），THE Platform SHALL 扫描系统 PATH 检测以下 6 个 CLI Agent：`hermes`、`codex`、`cursor`（binary 名 `cursor-agent`）、`copilot`、`gemini`、`aider`；检测结果缓存 60 秒，过期后下次调度前自动重新扫描。
2. THE Platform SHALL 按以下优先级选择 Agent：`hermes > codex > cursor > copilot > gemini > aider`；IF 均不可用，THEN 使用 Fallback_AI（MiMo API）。
3. WHEN 调度 CLI Agent 或 Fallback_AI，THE Platform SHALL 在 `pipeline_runs` 表写入一条记录，含 `agent_id`（CLI agent id 或 `mimo_fallback`）、`stage_name`、`started_at`、`status`、`used_fallback`（boolean）。
4. THE Platform SHALL 提供 `GET /api/agents` 接口返回当前检测到的 CLI Agent 列表，每项含：`id`、`label`、`available`（boolean）、`version`（可为 null）、`detected_at`（ISO 8601）。
5. IF 使用 Fallback_AI，THE Platform SHALL 在 Stage 3 SSE 日志流中推送一条 `[fallback] 本地无可用 CLI Agent，使用 MiMo API 生成代码` 标注，并在 Gate 3 的 `GET /api/admin/ideas/:id/diff` 响应中返回 `used_fallback: true`。

---

### 需求 9：通知

**用户故事：** 作为参与者，我希望在需要介入的节点收到通知，以便流水线不被阻塞。

#### 验收标准

1. THE Platform SHALL 维护两类通知收件人：
   - **admin**：`target_client_id = "admin"`，所有 Gate 等待和系统异常通知发给 admin
   - **submitter**：`target_client_id = idea.client_id`（如有）
2. THE Platform SHALL 在以下事件发生时创建站内通知（写入 `notifications` 表）：

   | 事件 | 收件人 | status 值 |
   |---|---|---|
   | Idea 提交成功 | admin | `submitted` |
   | Gate 1 等待审核 | admin | `gate1_waiting` |
   | Gate 2 等待审核（如启用） | admin | `gate2_waiting` |
   | Gate 3 等待审核 | admin | `gate3_waiting` |
   | Lifecycle_Status 变为 `done` | submitter（如有 client_id） | `published` |
   | Stage 执行超时或失败 | admin | `stage_failed` |

3. THE Platform SHALL 提供：
   - `GET /api/notifications?client_id=<id>&unread_only=<bool>&limit=50&offset=0` 获取指定收件人的通知列表，按 `created_at DESC` 排序
   - `POST /api/notifications/:id/read` 标记单条已读
   - 时间戳全部使用 ISO 8601 UTC 格式
4. WHEN admin 类通知创建，THE Platform SHALL 不在创建时发送外部消息（v1 仅站内通知）；`notifications.status` 字段值为事件类型，`notifications.read` 字段标记是否已读。
5. WHEN Gate 等待超过 24 小时未处理（即 `lifecycle_status IN ('pending_prd','pending_design','pending_merge')` 且 `updated_at < now - 24h`），THE Platform SHALL 创建一条 `status='gate_overdue'` 的提醒通知给 admin，每 24 小时最多创建 1 次，单个 Idea 最多创建 3 次（之后不再提醒）。
