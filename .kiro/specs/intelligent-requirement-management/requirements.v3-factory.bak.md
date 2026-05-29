# Requirements Document

## Introduction

CoBuilder 是一个 **AI 产品工厂**：用户输入一个想法，平台通过 8 阶段 AI 流水线（想法澄清 → 市场调研 → 产品设计 → 技术架构 → 代码实现 → 测试修复 → 部署上线 → 迭代优化），自动产出一个可运行的产品。每个阶段由一个或多个外部 CLI Agent 执行（Hermes / MiMo / Cursor / Codex / Gemini 等），平台本身不跑模型，只做编排、上下文传递和 Gate 管理。每个阶段的产出都需要人类在 Gate 节点审核（通过 / 编辑后通过 / 驳回），AI 不可绕过 Gate。流水线状态持久化到 SQLite，支持断点续跑和并发执行。

> 本 spec 的"需求"指对平台本身的功能要求；用户在平台上提交的"想法"则使用 Idea 这一术语，与现有数据库的 `ideas` 表保持一致。

---

## Glossary

- **Platform**：CoBuilder 平台本身，提供想法收集、流水线编排、Agent 调度、Gate 审核能力。
- **Product**：用户在平台上启动的一个产品工程，对应数据库中的一个 Project 记录，拥有独立的工作目录、流水线状态和成员列表。
- **Idea**：用户提交的一个想法，是流水线的输入起点，对应数据库中的一条 `ideas` 记录。一个 Product 可由一个 Idea 演化而来，也可由多个相关 Idea 聚合而来。
- **Raw_Input**：用户提交的原始模糊描述，未经 AI 处理。
- **Pipeline**：8 阶段流水线的运行实例，每个 Product 拥有一条主 Pipeline，对应数据库 `pipeline_runs` 表中以 product_id 为主键的多条记录。
- **Stage**：流水线中的一个阶段，取值见状态机定义；每个 Stage 对应一条 `pipeline_runs` 记录。
- **Stage_Status**：单个 Stage 的执行状态，取值为 `pending` / `running` / `gate_waiting` / `approved` / `rejected` / `failed` / `timeout`。
- **Product_Status**：Product 整体所处阶段，由当前 active Stage 推导得出，取值见需求 1。
- **Gate**：强制人工审核节点，AI 不可绕过；流水线在 Gate 处暂停（Stage_Status = `gate_waiting`），等待人类决策后才能进入下一阶段。
- **Reviewer**：在 Gate 节点执行审核的人员，可为 owner、pm 或被授权的成员。
- **Agent_Dispatcher**：检测本地 PATH 上可用 CLI Agent 并按任务调度的模块。
- **CLI_Agent**：可被 Agent_Dispatcher 调度的命令行 AI 编程工具（Hermes、MiMo、Cursor、Codex、Gemini 等），每个 CLI_Agent 在注册表中标注其能力标签（llm_chat / web_search / code_read / code_write / code_review / deploy）。
- **Capability_Tag**：CLI_Agent 的能力标签，调度器按标签匹配阶段需求。
- **Stage_Output**：单个 Stage 完成后产出的结构化数据，存储在 `pipeline_runs.output_data` 字段，作为下一 Stage 的输入。
- **Document**：流水线产出的结构化文档（产品简报、市场调研、产品设计、技术架构、PRD 等），存储在 `requirement_docs` 表，每次编辑生成新版本。
- **Work_Dir**：每个 Product 独立的工作目录，路径形如 `.cobuilder/projects/<product_id>/`，CLI_Agent 在该目录内读写代码。
- **Role**：用户在 Product 中的角色，取值为 owner / pm / developer / tester / designer / viewer。
- **Audit_Log**：所有状态变更和 Gate 决策的不可删除日志，存储 actor、timestamp、from_status、to_status、reason。
- **Token_Usage**：单次 CLI_Agent 调用的 tokens 消耗记录（input / output / total），用于成本可观测性。

---

## 状态机定义（统一规范）

### Product_Status（Product 整体状态）

合法取值与含义：

| Status | 含义 | 进入条件 |
|---|---|---|
| `draft` | 已创建，未启动流水线 | Product 创建时的初始态 |
| `clarifying` | Stage 1 想法澄清进行中 | 用户提交 Raw_Input 后自动进入 |
| `researching` | Stage 2 市场调研进行中 | Stage 1 Gate 通过 |
| `designing` | Stage 3 产品设计进行中 | Stage 2 Gate 通过 |
| `architecting` | Stage 4 技术架构进行中 | Stage 3 Gate 通过 |
| `building` | Stage 5 代码实现进行中 | Stage 4 Gate 通过 |
| `testing` | Stage 6 测试修复进行中 | Stage 5 Gate 通过 |
| `deploying` | Stage 7 部署上线进行中 | Stage 6 Gate 通过 |
| `iterating` | Stage 8 迭代优化（持续循环） | Stage 7 Gate 通过 |
| `paused` | 用户主动暂停 | 任意非终态由用户触发 |
| `archived` | 归档（只读） | 用户主动归档 |
| `cancelled` | 流水线被驳回且用户选择终止 | Gate 驳回后用户确认终止 |


### Stage_Status（单个 Stage 状态）

每个 Stage 是流水线中一个独立的执行单元，其状态机为：

```
        ┌─────────────────────────────────┐
        │                                 │
   pending ──► running ──► gate_waiting ──┼─► approved ──► (next stage pending)
        │        │              │         │
        │        ▼              ▼         └─► rejected ──► (退回上一 Stage 或 cancelled)
        │     timeout         (人类驳回)
        │      failed
        │        │
        └────────┴─► (Stage 重试或回退)
```

### 合法状态转移表

下表列出所有允许的 Product_Status / Stage_Status 转移；任何未列出的转移均被拒绝。

| From | To | 触发条件 |
|---|---|---|
| Product `draft` | Product `clarifying` | 用户启动流水线 |
| Product Stage N `pending` | Stage N `running` | Agent_Dispatcher 调度成功 |
| Stage N `running` | Stage N `gate_waiting` | Stage_Output 生成成功 |
| Stage N `running` | Stage N `failed` | Agent 报错或返回非零退出码 |
| Stage N `running` | Stage N `timeout` | 超过该 Stage 的超时上限 |
| Stage N `gate_waiting` | Stage N `approved` | Reviewer 审核通过 |
| Stage N `gate_waiting` | Stage N `rejected` | Reviewer 驳回 |
| Stage N `approved` | Stage N+1 `pending` | 自动推进到下一 Stage |
| Stage N `rejected` | Stage N `pending` | Reviewer 选择"重新生成本阶段" |
| Stage N `rejected` | Product `cancelled` | Reviewer 选择"终止流水线" |
| Stage N `rejected` | Stage N-1 `gate_waiting` | Reviewer 选择"回退到上一阶段重审" |
| Stage N `failed` / `timeout` | Stage N `pending` | Reviewer 或自动重试（最多 3 次） |
| Product 任意非终态 | Product `paused` | 用户主动暂停 |
| Product `paused` | Product 暂停前的状态 | 用户恢复 |
| Product 任意状态 | Product `archived` | owner 归档 |
| Product `iterating` | Product `iterating` | 迭代循环（不离开该状态） |

### 全局约束

- AI 不可在任何情况下将 Stage_Status 直接从 `running` 设为 `approved`；必须经过 `gate_waiting` 由人类决策。
- Product `archived` / `cancelled` 为终态，不可恢复（如需重启需创建新 Product）。
- 同一 Product 同一时刻最多只有一个 active Stage（Stage_Status ∈ {pending, running, gate_waiting}）；并发触发时后到的请求被拒绝，返回 `409 Conflict`。
- 所有状态变更必须写入 Audit_Log，记录 actor、timestamp、from_status、to_status 和不少于 1 字符的 reason。

---

## Requirements

### 需求 1：Product 与 Idea 管理

**用户故事：** 作为用户，我希望在平台内创建多个 Product 并向其提交 Idea，以便每个产品的流水线状态、文档和代码相互隔离。

#### 验收标准

1. THE Platform SHALL 支持创建、编辑、归档 Product，每个 Product 拥有独立的名称（1–100 字符）、描述（0–500 字符）、Work_Dir 路径和成员列表；同一用户名下 Product 名称不可重复。
2. WHEN 用户创建 Product，THE Platform SHALL 在 `.cobuilder/projects/<product_id>/` 下自动创建 Work_Dir 目录，并将该路径写入 Product 的 `work_dir` 字段；IF 目录创建失败，THEN THE Platform SHALL 拒绝创建并返回"工作目录创建失败"错误，不在数据库中留下孤儿记录。
3. WHEN 用户访问 Platform 首页，THE Platform SHALL 展示该用户有权限访问的所有非 archived Product 列表，并显示每个 Product 的当前 Product_Status 和 active Stage 名称。
4. THE Platform SHALL 支持向 Product 提交 Idea，每条 Idea 包含：title（1–100 字符）、description（10–2000 字符）、可选 screenshots（最多 5 张，单张不超过 5 MB）、author_name、author_contact；description 不足 10 字符时拒绝提交并提示"描述过短，请补充更多信息"。
5. WHEN Idea 提交成功，THE Platform SHALL 将其 status 设为 `pending`、visible 设为 0（待审核），并通知 Product 中 Role 为 owner 或 pm 的成员。
6. WHEN 管理员归档 Product，THE Platform SHALL 将 Product_Status 设为 `archived`，其下所有 Idea、Document、code_files 保留只读访问，且不可在该 Product 下新增 Idea 或推进流水线。
7. IF 用户尝试访问无权限的 Product 或 Idea，THEN THE Platform SHALL 返回 403 状态码并展示"无访问权限"提示，不暴露任何内容。
8. THE Platform SHALL 支持将一个或多个 Idea 关联到 Pipeline 作为 Stage 1 的输入；多 Idea 关联时，THE Platform SHALL 将这些 Idea 的 description 拼接后作为 Raw_Input。

---

### 需求 2：多角色成员与权限

**用户故事：** 作为 Product owner，我希望为成员分配角色，以便流水线各阶段的 Gate 由合适的人审核。

#### 验收标准

1. THE Platform SHALL 支持 owner 为每个 Product 的成员分配且仅分配一个 Role，取值为 owner / pm / developer / tester / designer / viewer。
2. WHEN owner 变更成员 Role，THE Platform SHALL 立即更新该成员在该 Product 内的权限，无需重新登录。
3. THE Platform SHALL 按下表分配 Gate 审核权限：

   | Stage | Gate 审核者 |
   |---|---|
   | Stage 1 想法澄清 | owner / pm |
   | Stage 2 市场调研 | owner / pm |
   | Stage 3 产品设计 | owner / pm / designer |
   | Stage 4 技术架构 | owner / developer |
   | Stage 5 代码实现 | owner / developer |
   | Stage 6 测试修复 | owner / tester / developer |
   | Stage 7 部署上线 | owner |
   | Stage 8 迭代决策 | owner / pm |

4. IF 成员尝试在自己无权限的 Stage 执行 Gate 决策，THEN THE Platform SHALL 拒绝该操作并返回"权限不足"提示，不修改任何状态。
5. THE Platform SHALL 支持 owner 转让，转让需要原 owner 二次确认（输入 Product 名称作为确认）；转让成功后原 owner 自动降级为 pm。
6. WHEN 一个 Stage 进入 `gate_waiting`，THE Platform SHALL 向该 Stage 的所有合法 Reviewer 发送站内通知（详见需求 13）。

---

### 需求 3：Pipeline 状态机与执行编排

**用户故事：** 作为 Product owner，我希望流水线按 8 阶段顺序执行、在 Gate 处暂停、状态完整持久化，以便流程可追溯、可恢复、不丢数据。

#### 验收标准

1. THE Platform SHALL 实现"状态机定义"章节中描述的全部状态和转移规则；任何不在转移表中的状态变更请求 SHALL 被拒绝并返回 `400 Bad Request` 及"非法状态转移"错误。
2. WHEN 用户启动 Pipeline，THE Platform SHALL 创建 Stage 1 的 `pipeline_runs` 记录（status=pending），并将 Product_Status 设为 `clarifying`。
3. WHEN 一个 Stage 完成（进入 `approved`），THE Platform SHALL 在同一事务内：(a) 将该 Stage_Status 写入数据库；(b) 创建下一 Stage 的 `pipeline_runs` 记录（status=pending）；(c) 更新 Product_Status；(d) 写入 Audit_Log；任一步骤失败 SHALL 回滚整个事务。
4. THE Platform SHALL 为每个 Stage 设置超时上限：

   | Stage | 超时上限 |
   |---|---|
   | Stage 1 想法澄清 | 600 秒（含多轮对话） |
   | Stage 2 市场调研 | 300 秒 |
   | Stage 3 产品设计 | 300 秒 |
   | Stage 4 技术架构 | 300 秒 |
   | Stage 5 代码实现 | 1800 秒（30 分钟） |
   | Stage 6 测试修复 | 1200 秒（20 分钟） |
   | Stage 7 部署上线 | 600 秒 |
   | Stage 8 单次迭代 | 1800 秒 |

5. IF 一个 Stage 的 `running` 持续时间超过其超时上限，THEN THE Platform SHALL 终止该 Stage 的 Agent 进程、将 Stage_Status 设为 `timeout`、记录"执行超时"错误，并保留已生成的部分输出（如有）以供调试。
6. WHEN Stage_Status 变为 `failed` 或 `timeout`，THE Platform SHALL 允许 Reviewer 选择：(a) 立即重试该 Stage（最多 3 次自动重试，间隔 30 秒）；(b) 编辑 Stage 输入后重试；(c) 终止流水线（Product_Status → `cancelled`）。
7. WHEN 用户暂停 Pipeline，THE Platform SHALL 立即终止当前 active Stage 的 Agent 进程，将 Product_Status 设为 `paused`，保留所有已生成的中间产物；恢复时从被暂停的 Stage 重新开始（status=pending）。
8. THE Platform SHALL 在每个 Stage 之间通过 JSON 传递 Stage_Output 作为下一 Stage 的输入，传递时进行 JSON Schema 校验；IF 校验失败，THEN 阻止下一 Stage 启动并将当前 Stage_Status 回退至 `gate_waiting`，提示 Reviewer 编辑输出。
9. THE Platform SHALL 支持断点续跑：进程重启后，THE Platform SHALL 扫描所有 Stage_Status 为 `running` 的记录，将其重置为 `pending` 并重新调度（不复用已死的子进程）。

---

### 需求 4：Stage 1 — 想法澄清

**用户故事：** 作为想法提交者，我希望 AI 通过多轮对话把我的模糊想法澄清成结构化产品简报，以便后续阶段有清晰的输入。

#### 验收标准

1. WHEN Stage 1 进入 `running`，THE Platform SHALL 调度具备 `llm_chat` 能力的 CLI_Agent（默认 Hermes），向用户发起多轮澄清对话，对话轮次上限为 10 轮。
2. THE CLI_Agent SHALL 在对话中至少澄清以下 5 个维度：解决什么问题、目标用户、与现有方案的差异、MVP 核心功能（不少于 3 项）、技术栈倾向。
3. WHEN 对话轮次达到 5 轮且 5 个维度均已被覆盖，OR 用户主动选择"结束澄清"，THE CLI_Agent SHALL 输出结构化产品简报（Product_Brief），包含字段：name、one_liner、target_users、core_pain、mvp_features（数组，3–10 项）、tech_preference、style_preference。
4. THE Product_Brief SHALL 通过 JSON Schema 校验后存入 `requirement_docs`（type=brief，version=1）；校验失败时 Stage_Status 设为 `failed` 并记录校验错误。
5. WHEN Product_Brief 生成完成，THE Platform SHALL 将 Stage_Status 设为 `gate_waiting`，向 owner / pm 发送审核通知。
6. THE Platform SHALL 在 Gate 1 审核界面同时展示：Product_Brief 内容、对话历史、置信度（0–100% 整数）。
7. IF Product_Brief 的置信度低于 60%，THEN THE Platform SHALL 在审核界面展示醒目提示"建议补充对话信息"，提示在 Reviewer 关闭或编辑后消失。
8. WHEN Reviewer 选择"编辑后通过"，THE Platform SHALL 保存编辑后版本（version+1），同时保留原始 AI 版本，两个版本均可查看。
9. WHEN Reviewer 驳回 Stage 1，THE Platform SHALL 要求填写驳回原因（不少于 10 字符），并按需求 3.6 提供"重新生成 / 终止"选项。
10. IF Raw_Input 字符数少于 10，THEN THE Platform SHALL 在 Stage 1 启动前拒绝并提示"描述过短，请补充更多信息"，Pipeline 不进入 `running`。

---

### 需求 5：Stage 2 — 市场调研

**用户故事：** 作为产品 owner，我希望 AI 自动调研竞品和目标用户画像，以便在产品设计前明确差异化方向。

#### 验收标准

1. WHEN Stage 2 进入 `running`，THE Platform SHALL 调度具备 `llm_chat` + `web_search` 能力的 CLI_Agent（默认 Hermes + Web Search），以 Stage 1 输出的 Product_Brief 为输入。
2. THE CLI_Agent SHALL 输出 Market_Research 文档，包含字段：competitors（数组，3–5 项，每项含 name、url、strength、weakness）、differentiator（不少于 50 字符）、user_persona（含 role、pain、goal）、market_size_note（可选）。
3. THE CLI_Agent SHALL 在 Market_Research 中为每条 competitor 标注信息来源 URL；IF 某条 competitor 无可验证 URL，THEN 在该条目上标注"未验证"标签。
4. IF Web Search 不可用或返回结果数为 0，THEN THE Platform SHALL 标记 Market_Research 为"调研降级"模式（仅基于模型先验知识），并在 Gate 审核界面展示该标签提示 Reviewer 注意。
5. WHEN Market_Research 生成完成，THE Platform SHALL 将其存入 `requirement_docs`（type=research）并将 Stage_Status 设为 `gate_waiting`。
6. THE Platform SHALL 支持 Reviewer 在 Gate 2 编辑 competitors / differentiator / user_persona 字段；编辑后保存为新版本。
7. WHEN Reviewer 通过 Gate 2，THE Platform SHALL 自动推进至 Stage 3，并将 Product_Brief 与 Market_Research 一并作为 Stage 3 输入。

---

### 需求 6：Stage 3/4 初步分析（必要性 / 优先级 / 工作量 / 风险）

**用户故事：** 作为产品 owner，我希望在投入实现之前看到 AI 对每个 MVP 功能的必要性、优先级、工作量和风险的初步评估，以便决定是否调整范围。

#### 验收标准

1. WHEN Stage 3 进入 `running`，THE Platform SHALL 调度具备 `llm_chat` 能力的 CLI_Agent（默认 MiMo），以 Product_Brief 和 Market_Research 为输入，输出 Product_Design 文档。
2. THE Product_Design SHALL 包含字段：feature_list（按 MVP / v1 / v2 三档分级，每个 feature 含 title、description、necessity_score、priority、effort_estimate、risk_level、necessity_reason）、information_architecture（页面结构与导航）、ui_style（配色 / 字体 / 布局模式）、wireframe_descriptions（数组，每个页面一条文本描述）。
3. 每个 feature 的初步分析字段 SHALL 满足：
   - **necessity_score**：1–10 整数；评估理由 necessity_reason 不少于 50 字符，且必须明确引用以下至少一项：Product_Brief 的 core_pain、Market_Research 的 differentiator、user_persona 的 goal。
   - **priority**：取值 P0 / P1 / P2 / P3；priority 与 MVP / v1 / v2 分档之间的映射规则在 Product_Design 文档头部说明。
   - **effort_estimate**：以人天为单位精确到 0.5 天，并附带置信区间（optimistic / normal / pessimistic）；三个值满足 optimistic ≤ normal ≤ pessimistic 且 pessimistic ≤ 3 × optimistic。
   - **risk_level**：取值 low / medium / high；high 风险必须附带不少于 20 字符的 risk_note。
4. IF 某个 feature 的 necessity_score 低于 4，THEN THE Platform SHALL 在 Gate 3 审核界面对该 feature 标注醒目警告"必要性较低，建议谨慎纳入 MVP"，警告在 Reviewer 调整该 feature 的分级或关闭后消失。
5. WHEN AI 检测到同一 Product 内或同一 owner 名下其它 Product 中语义相似度（使用平台内置的向量相似度计算函数，阈值 ≥ 0.85）超过 0.85 的 feature 或 Idea，THE Platform SHALL 在 Gate 3 审核界面展示重复预警，列出相似条目的标题与链接。
6. WHEN Stage 4 进入 `running`，THE Platform SHALL 调度具备 `code_read` 能力的 CLI_Agent（默认 Cursor），以 Product_Design 为输入并读取 Work_Dir（如有现有代码），输出 Tech_Architecture 文档。
7. THE Tech_Architecture SHALL 包含字段：tech_stack（含选型理由，每项 ≥ 30 字符）、database_schema（完整 SQL，可直接执行）、api_design（每个 endpoint 含 method / path / 请求体 / 响应体）、directory_structure（树状文本）、dependencies（含版本号锁定）。
8. THE Tech_Architecture SHALL 对 Product_Design 中每个 MVP feature 给出"受影响文件预测列表"（含 path 与 modify_type ∈ {add, modify, delete}），并在 medium / high 风险文件上标注风险说明（≥ 20 字符）。
9. WHEN Reviewer 在 Gate 3 或 Gate 4 修改任意初步分析字段（necessity_score / priority / effort_estimate / risk_level），THE Platform SHALL 要求填写覆盖原因（不少于 1 字符），并将原始 AI 值与人工修改值、覆盖原因一并存储，可通过 API 查询。
10. THE Platform SHALL 为每条 Product_Design / Tech_Architecture 至少保留最近 5 个版本（含 AI 原始版本与人工编辑版本）。
11. IF Stage 3 / Stage 4 的 CLI_Agent 输出无法通过 JSON Schema 校验，THEN THE Platform SHALL 自动重试一次（使用相同输入 + 校验错误信息作为补充提示）；二次仍失败则 Stage_Status 设为 `failed`。

---

### 需求 7：Stage 5 — 代码实现与 Gate 5（代码变更审核）

**用户故事：** 作为开发者，我希望在 Gate 4 审核通过后，平台调度多个 Agent 并行实现代码、产出可预览的产品，并在 Gate 5 审核每一条代码变更后才合入 Work_Dir。

#### 验收标准

1. WHEN Stage 4 Gate 通过且 Stage 5 进入 `pending`，THE Platform SHALL 根据 Tech_Architecture 自动拆分实现任务为 3 个并行子任务：(a) database + API、(b) frontend pages、(c) styles + components；每个子任务作为一条 `pipeline_runs` 记录（stage=`build:db_api` / `build:frontend` / `build:styles`）。
2. THE Agent_Dispatcher SHALL 为每个子任务选择具备 `code_write` 能力的 CLI_Agent，优先级按需求 9 的能力匹配规则；同一 Pipeline 内允许不同子任务使用不同 CLI_Agent。
3. WHEN CLI_Agent 执行子任务，THE Platform SHALL 向其传递：Product_Brief、Product_Design、Tech_Architecture、子任务范围（受影响文件预测列表的子集），并指定输出根目录为 Work_Dir 下的 staging 区（`<work_dir>/.staging/<run_id>/`），CLI_Agent 不得直接写入 Work_Dir 主区。
4. WHILE 子任务正在执行，THE Platform SHALL 以不超过 2 秒的刷新间隔向用户展示实时日志流（基于 SSE 或长轮询）。
5. WHEN 所有 3 个子任务全部进入 `gate_waiting`，THE Platform SHALL 进入 Gate 5（代码变更审核）：合并 staging 区的所有变更，向 Reviewer 展示 diff 预览（按文件分组、可逐条 accept/reject）、新增依赖列表、潜在风险提示（如修改了 high 风险文件、新增了不在 architecture 中的依赖）。
6. THE Platform SHALL 支持 Reviewer 在 Gate 5 执行：(a) 全部通过；(b) 逐条 accept/reject；(c) 编辑后通过；(d) 驳回；(e) 终止流水线。被 reject 的 hunk 不合入主区。
7. IF Reviewer 选择"编辑后通过"，THEN THE Platform SHALL 将编辑结果作为最终合入版本，记录"原始 AI 版本"与"人工编辑版本"两份 diff。
8. WHEN Reviewer 完成 Gate 5 审核（除"驳回"和"终止"外），THE Platform SHALL 在事务内将通过的变更从 staging 区合入 Work_Dir 主区，并将所有合入的文件存入 `code_files` 表（path、content、stage='build'、version 自增）。
9. IF 任一子任务超过其单任务超时上限（默认 1200 秒）未完成，THEN THE Platform SHALL 终止该子任务的 Agent 进程、将该子任务 Stage_Status 设为 `timeout`；未超时的子任务正常进入 `gate_waiting`。Reviewer 可在 Gate 5 选择仅审核已完成部分或重试失败子任务。
10. IF CLI_Agent 返回非零退出码，THEN THE Platform SHALL 将该子任务 Stage_Status 设为 `failed`，展示完整 stderr，并允许 Reviewer 选择重试（最多 3 次）。
11. WHEN Gate 5 通过，THE Platform SHALL 在 Work_Dir 主区运行一次轻量级自检：(a) 语法检查（`tsc --noEmit` 或同等工具）；(b) lint；(c) 依赖安装（`npm install --no-save`）；任一项失败 SHALL 将 Stage 5 整体回退至 `gate_waiting` 并展示失败详情，Reviewer 可选择"忽略并继续"或"驳回"。
12. WHEN Stage 5 整体进入 `approved`，THE Platform SHALL 自动推进至 Stage 6 并向 tester / developer 角色发送通知。
13. THE Platform SHALL 提供产品预览能力：在 Stage 5 通过后，可在 iframe 沙盒中启动 Work_Dir 内的 Next.js dev server（端口随机分配，仅在 localhost 暴露），预览页面带有醒目"沙盒预览"标签。

---

### 需求 8：Stage 6 / 7 / 8 — 测试、部署、迭代

**用户故事：** 作为 Product owner，我希望在 Gate 5 通过后，平台自动完成测试修复、部署上线、并支持持续迭代。

#### 验收标准

1. WHEN Stage 6 进入 `running`，THE Platform SHALL 调度具备 `code_write` 能力的 CLI_Agent（默认 Codex，沙箱模式）执行：(a) 生成自动化测试用例（覆盖率目标 ≥ 60%）；(b) 在沙箱中运行测试；(c) 对失败的测试自动修复（最多 3 轮，每轮一次"修复 → 重测"）。
2. THE Platform SHALL 在 Stage 6 输出 Test_Report，包含字段：test_count、passed、failed、coverage_percent、fix_attempts、residual_issues（数组，每项含 test_name、error、severity）。
3. IF 修复后仍有 failed 测试或 coverage < 60%，THEN THE Platform SHALL 在 Gate 6 审核界面展示醒目警告，Reviewer 可选择"接受当前状态推进"或"驳回重试"。
4. WHEN Stage 6 Gate 通过且 Stage 7 进入 `running`，THE Platform SHALL 调度具备 `deploy` 能力的 CLI_Agent 或内置部署适配器，将 Work_Dir 部署到用户在 Product 设置中指定的目标（取值：vercel / cloudflare / self_hosted / none）。
5. IF 部署目标为 `none`，THEN THE Platform SHALL 跳过 Stage 7 实际部署，仅生成部署指令脚本（`deploy.sh` 或 README 段落）作为 Stage_Output，Gate 7 让用户手动执行后确认。
6. WHEN 部署完成，THE Platform SHALL 在 Stage_Output 中记录：deploy_url、deploy_target、commit_sha、deployed_at；部署失败时记录 stderr 全文并将 Stage_Status 设为 `failed`。
7. WHEN Stage 7 Gate 通过，THE Platform SHALL 将 Product_Status 设为 `iterating`，并启用 Stage 8 的反馈收集入口（在 Product 详情页生成公开反馈链接）。
8. WHEN 用户在 Stage 8 提交新反馈，THE Platform SHALL 创建一个新的 Iteration 实例（关联 product_id），运行简化的 mini-pipeline：clarify → design → build → test → deploy；mini-pipeline 复用主 Pipeline 的状态机和 Gate 机制，但每个 Stage 的超时上限减半。
9. THE Platform SHALL 在 Product 详情页展示 Iteration 历史列表，含 iteration_id、feedback、action（fix / feature / optimize）、result、created_at。
10. WHEN Reviewer 在 Stage 8 选择"暂停迭代"，THE Platform SHALL 将 Product_Status 保持 `iterating` 但停止接收新反馈，直至 Reviewer 显式恢复。

---

### 需求 9：CLI_Agent 检测、注册与调度

**用户故事：** 作为 Platform，我需要按能力标签调度本地可用的 CLI_Agent，以便每个 Stage 自动选到合适的工具。

#### 验收标准

1. WHEN Platform 启动，THE Agent_Dispatcher SHALL 扫描系统 PATH 检测以下 CLI_Agent：hermes、mimo、cursor、codex、gemini；检测结果（agent_name、binary_path、version、capability_tags、detected_at）缓存有效期为 60 秒，过期后下次调度前自动重新扫描。
2. THE Agent_Dispatcher SHALL 维护能力标签注册表，初始内置如下映射；注册表可通过配置文件（`~/.cobuilder/agents.json`）覆盖：

   | Agent | Capability_Tags |
   |---|---|
   | Hermes | llm_chat, web_search, code_read, code_write, code_review |
   | MiMo | llm_chat, code_read |
   | Cursor | code_read, code_write, code_review |
   | Codex | code_read, code_write |
   | Gemini | code_read, code_write |

3. WHEN 一个 Stage 需要调度 Agent，THE Agent_Dispatcher SHALL 按以下优先级选择：(a) Product 设置中用户指定的 agent；(b) 满足该 Stage 所需全部 Capability_Tags 的 agent 中按注册表顺序的第一个；(c) 部分匹配的 agent（缺少非关键能力）；任一情形均记录调度决策日志（agent_name、selected_reason、stage、run_id）。
4. IF 没有 CLI_Agent 满足所需 Capability_Tags，THEN THE Platform SHALL 将 Stage_Status 设为 `failed`、展示"未检测到可用 Agent"提示并附带安装引导链接，Pipeline 在该 Stage 暂停等待人工干预。
5. WHEN Agent_Dispatcher 启动子进程，THE Platform SHALL 设置以下隔离约束：(a) 子进程工作目录限制在 Work_Dir 内（除 Stage 1/2 等不涉及代码的阶段）；(b) 环境变量白名单（仅传递明确允许的 PATH、HOME、LANG、CO_BUILDER_*）；(c) 不传递平台自身的数据库连接和 API 密钥，AI 服务密钥单独加密注入。
6. THE Platform SHALL 记录每次 Agent 调用的 Token_Usage（input_tokens、output_tokens、total_tokens、estimated_cost_cny），关联到对应的 `pipeline_runs.id`。
7. THE Platform SHALL 提供 `/api/agents` 接口返回当前已检测的 CLI_Agent 列表（含 capability_tags、是否可用、最近检测时间），用于前端展示与诊断。

---

### 需求 10：Document 解析、版本与导出

**用户故事：** 作为平台，我需要对所有结构化文档（Brief / Research / Design / Architecture / PRD / Test_Report 等）做统一的解析、校验、版本管理与导出。

#### 验收标准

1. THE Platform SHALL 为每种 Document 类型定义 JSON Schema；存入 `requirement_docs` 前 SHALL 通过 Schema 校验；校验失败时返回错误信息并明确列出所有不通过的字段、期望类型与实际值。
2. THE Platform SHALL 将任意 Document 对象格式化为 Markdown，且支持从该 Markdown 反向解析回 Document 对象；对任意合法 Document 执行"对象 → Markdown → 对象"往返操作 SHALL 在所有必填字段上得到与原始对象完全相同的值（往返一致性）。
3. WHEN 用户编辑 Document 并保存，THE Platform SHALL 创建新版本（version+1），原版本保留只读访问；每个 Document 至少保留最近 5 个版本，超出后从最旧版本开始删除。
4. THE Platform SHALL 提供导出能力：(a) 单个 Document 导出为 Markdown 或 JSON；(b) 整个 Product 导出为 zip 包，包含所有 Document、code_files、Test_Report、deploy 信息；导出文件命名为 `<product_name>-<timestamp>.zip`。
5. IF Document 缺少必填字段，THEN THE Platform SHALL 在保存时拒绝并明确列出所有缺失字段名称。
6. THE Platform SHALL 支持通过 Document version_id 直接获取该版本完整内容的 API（`GET /api/products/<id>/documents/<doc_id>?version=<n>`），返回内容包含 created_at、created_by、change_summary。

---

### 需求 11：审计日志与可观测性

**用户故事：** 作为 owner，我希望所有关键操作都有不可删除的审计记录，并能查看流水线运行成本和耗时。

#### 验收标准

1. THE Platform SHALL 为以下事件写入 Audit_Log（不可删除）：Product 创建/归档/转让 owner、成员 Role 变更、所有 Stage_Status 变更、所有 Gate 决策（含 reason）、Document 编辑、CLI_Agent 调度与失败、部署成功与失败。
2. 每条 Audit_Log 记录 SHALL 包含：log_id、product_id、actor_id、actor_role、event_type、from_value、to_value、reason、ip_address、created_at（ISO 8601）。
3. THE Platform SHALL 提供 Audit_Log 查询接口，支持按 product_id、actor_id、event_type、时间范围筛选，分页大小 50，最大返回 1000 条；超出范围请求需提供时间窗口收紧。
4. THE Platform SHALL 在 Product 详情页展示 Pipeline 运行概览：每个 Stage 的耗时、Token_Usage、估算成本（人民币，按 MiMo 计费规则换算）、Agent 名称；支持按 Stage 折叠展开。
5. THE Platform SHALL 记录每次 CLI_Agent 调用的标准输出与标准错误日志到独立日志文件（`<work_dir>/.logs/<run_id>.log`），单个文件超过 10 MB 时自动切片，保留最近 30 天。
6. IF 任一 Stage 触发 `failed` 或 `timeout`，THEN THE Platform SHALL 在 Audit_Log 之外额外发送告警通知给 owner（站内通知），告警包含 stage、错误摘要（不超过 200 字）和日志文件链接。

---

### 需求 12：并发控制与幂等

**用户故事：** 作为 Platform，我需要保证流水线并发场景下不出现重复执行、状态错乱或竞态条件。

#### 验收标准

1. THE Platform SHALL 使用数据库行级锁（SQLite 通过 `BEGIN IMMEDIATE` 事务）确保同一 Product 同一时刻只有一个 Stage 处于 active 状态；并发推进请求 SHALL 返回 `409 Conflict` 与"该流水线正在被其他请求修改"错误。
2. THE Platform SHALL 为所有状态变更接口要求请求方提供 `If-Match: <current_status_etag>` 头；版本不匹配时返回 `412 Precondition Failed`，提示客户端刷新后重试。
3. WHEN 多个 Reviewer 同时审核同一 Gate，THE Platform SHALL 接受最先提交的决策、拒绝后续决策并返回"该 Gate 已被 <reviewer_name> 决策"提示。
4. THE Platform SHALL 为每次 CLI_Agent 调度生成唯一 run_id（UUID v4），并在子进程退出后通过 run_id 校验回写的 Stage_Output；run_id 不匹配（来自旧 / 死进程）的回写 SHALL 被拒绝。
5. WHEN 自动重试触发，THE Platform SHALL 在重试前等待至少 30 秒，并在 Audit_Log 中记录每次重试（attempt_number、reason、started_at）。
6. THE Platform SHALL 对所有写接口（POST / PUT / PATCH / DELETE）支持 `Idempotency-Key` 头；同一 key 在 24 小时内的重复请求返回首次请求的结果，不重复执行。

---

### 需求 13：通知与协作

**用户故事：** 作为参与者，我希望在我需要介入的节点收到通知，以便流水线不被阻塞。

#### 验收标准

1. WHEN 一个 Stage 进入 `gate_waiting`，THE Platform SHALL 向该 Stage 的所有合法 Reviewer（按需求 2.3）发送站内通知，含 product_name、stage、Gate 链接和已等待时长。
2. WHEN Stage_Status 变为 `failed` / `timeout`，THE Platform SHALL 向 Product owner 发送告警通知。
3. WHEN Stage 7 部署成功，THE Platform SHALL 向 Idea 的原始提交者（如有 author_contact）发送通知，含 deploy_url 与"想法已上线"文案。
4. WHEN Stage 8 收到新反馈，THE Platform SHALL 向 owner / pm 发送通知，含反馈摘要（≤ 100 字）与处理链接。
5. THE Platform SHALL 在通知中心页面展示当前用户的所有通知，支持已读/未读筛选，分页大小 50，时间戳为 ISO 8601。
6. IF 通知发送失败，THEN THE Platform SHALL 重试最多 3 次，间隔不少于 30 秒；3 次失败后标记为"发送失败"，记录错误日志，不再自动重试。
7. THE Platform SHALL 对超过 24 小时未处理的 `gate_waiting` 状态发送二次提醒通知给 owner（每 24 小时一次，最多 3 次）。

---

### 需求 14：数据迁移（从现有 v1 schema）

**用户故事：** 作为现有用户，我希望升级到 v3 时，已有的 ideas / projects / pipeline_runs / requirement_docs 数据能被自动迁移而不丢失。

#### 验收标准

1. WHEN Platform 启动检测到数据库 schema_version 低于 v3，THE Platform SHALL 自动执行迁移脚本，迁移过程使用单一事务，失败时完整回滚。
2. THE 迁移脚本 SHALL 为 `projects` 表新增字段：`work_dir TEXT`、`product_status TEXT DEFAULT 'draft'`、`deploy_target TEXT DEFAULT 'none'`、`updated_at TEXT`、`archived_at TEXT`；现有记录 `work_dir` 字段补默认值 `.cobuilder/projects/<id>/`，`product_status` 根据下游数据推断（详见 14.4）。
3. THE 迁移脚本 SHALL 新增表：`product_members(product_id, user_id, role, created_at, UNIQUE(product_id, user_id))`、`audit_logs`、`code_files`、`token_usage`、`iterations`；为现有 Project 的创建者写入一条 owner 角色记录。
4. THE 迁移脚本 SHALL 根据现有 `pipeline_runs` 与 `ideas.status` 推断 `projects.product_status`：若有 stage=`deploy` 且 status=`completed` 的记录则设为 `iterating`；否则按最新 active stage 映射到对应 product_status；无 pipeline_runs 的 Project 设为 `draft`。
5. THE 迁移脚本 SHALL 保留 `ideas` 表结构，仅新增字段：`promoted_to_product_id TEXT`（用于记录该 Idea 被推进为哪个 Product 的输入）；`requirement_docs` 表 SHALL 新增字段：`type TEXT NOT NULL DEFAULT 'prd'`，并对存量记录将 type 设为 `prd`。
6. THE 迁移脚本 SHALL 在 schema_version 表中写入新版本号 3，并记录迁移时间；同一版本号的迁移脚本 SHALL 保证幂等（重复执行不产生副作用）。
7. IF 迁移过程中检测到必填字段缺失或外键不一致，THEN THE Platform SHALL 中止启动、保留原数据库不变、向运维输出详细诊断日志，要求人工介入。

---

### 需求 15：安全与隔离

**用户故事：** 作为 Platform，我需要在调度外部 CLI_Agent 时保证用户数据和系统安全。

#### 验收标准

1. THE Platform SHALL 对所有用户提交的 Raw_Input 和 Document 内容做 prompt injection 防护：在向 CLI_Agent 传递时使用结构化标签包裹（如 `<user_content>...</user_content>`），并在 system prompt 中明确指示 LLM 将标签内内容视为数据而非指令。
2. THE Platform SHALL 限制 CLI_Agent 子进程的文件系统访问：除 Stage 1/2 外，所有 Stage 的 Agent 子进程 cwd 设为对应 Product 的 Work_Dir，且不允许读写 Work_Dir 之外的路径（通过 sandbox-exec / 容器 / chroot 等实现，具体方案在 design.md 中确定）。
3. THE Platform SHALL 对所有数据库写入使用参数化查询或字段白名单；不允许字符串拼接 SQL。
4. THE Platform SHALL 使用 `crypto.timingSafeEqual` 比较 token / API key，防止时序攻击。
5. THE Platform SHALL 对存储在数据库中的 AI 服务密钥使用对称加密（AES-256-GCM），主密钥从环境变量 `COBUILDER_MASTER_KEY` 读取，启动时校验主密钥强度（≥ 32 字节）。
6. IF 检测到 Raw_Input 或 Document 中包含明显的 prompt injection 模式（如"ignore previous instructions"、"system:" 前缀），THEN THE Platform SHALL 在 Audit_Log 中标记该事件，但不阻断流水线（仅记录用于后续分析）。
7. THE Platform SHALL 拒绝 CLI_Agent 输出中尝试写入以下路径的请求：系统目录（/etc /usr /var）、用户家目录非 .cobuilder 子目录、其他 Product 的 Work_Dir。
8. THE Platform SHALL 在 Stage 5 / 7 执行前对 Work_Dir 内的 `package.json` 依赖进行简单检查：若新增依赖名包含已知 typosquatting 模式（如 `lodash` vs `lodahs`）或为 24 小时内新发布且下载量 < 100，THE Platform SHALL 在 Gate 5 / 7 审核界面展示风险提示。
