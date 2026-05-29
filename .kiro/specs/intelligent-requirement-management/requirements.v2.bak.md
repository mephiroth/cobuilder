# Requirements Document

## Introduction

本功能是对 CoBuilder 平台的全面升级，将其从单项目需求收集工具扩展为**智能多项目需求分析管理平台**。核心目标是打通从"用户模糊描述"到"AI 辅助开发落地"的完整生命周期，通过 AI 自动分析需求的必要性、优先级与工作量，结合人工审核 Gate，最终生成开发计划并调度 AI 编程工具（Codex/Cursor 等）执行实现任务，同时支持产品经理、开发、测试、设计多角色协作，减少返工。

---

## Glossary

- **Platform**：智能需求分析管理平台，即 CoBuilder 升级后的整体系统
- **Project**：平台内的独立项目，每个项目拥有独立的需求池、成员和配置
- **Requirement**：一条需求条目，从用户原始描述到最终实现的完整生命周期单元
- **Raw_Input**：用户提交的原始模糊描述，未经 AI 处理
- **AI_Analyzer**：负责需求澄清、必要性分析、优先级评估、工作量估算的 AI 模块
- **Clarification**：AI 对 Raw_Input 进行结构化澄清后产生的标准化需求描述
- **Necessity_Score**：AI 评估需求必要性的量化分值（1–10）
- **Priority**：需求优先级，取值为 P0（紧急）/ P1（重要）/ P2（一般）/ P3（低优）
- **Effort_Estimate**：AI 估算的开发工作量，以人天（person-day）为单位
- **Gate**：强制人工审核节点，AI 不可绕过
- **Reviewer**：在 Gate 节点执行审核操作的人员（产品经理或管理员）
- **Dev_Plan**：基于代码库分析生成的结构化开发计划，包含受影响文件、实现步骤、测试要点
- **Agent_Dispatcher**：检测本地 PATH 上可用 CLI Agent 并按任务调度的模块
- **CLI_Agent**：可被 Agent_Dispatcher 调度的命令行 AI 编程工具（Codex、Cursor、Hermes、Gemini 等）
- **Role**：用户在项目中的角色，取值为 owner / pm（产品经理）/ developer / tester / designer
- **Lifecycle_Status**：需求当前所处的生命周期阶段（见需求 3）
- **Context_Window**：AI 分析时注入的项目上下文，包含项目描述、历史需求摘要、代码结构摘要

---

## Requirements

### 需求 1：多项目管理

**用户故事：** 作为平台管理员，我希望在同一平台内创建和管理多个独立项目，以便不同产品线的需求互不干扰、独立追踪。

#### 验收标准

1. THE Platform SHALL 支持创建、编辑、归档多个 Project，每个 Project 拥有独立的名称（1–100 字符）、描述（0–500 字符）、代码库路径和成员列表；同一平台内 Project 名称不可重复。
2. WHEN 用户访问 Platform 首页，THE Platform SHALL 展示该用户有权限访问的所有非归档 Project 列表，并显示每个 Project 中 Lifecycle_Status 为非终态（非 `done`/`rejected`/`deferred`）的 Requirement 数量。
3. WHEN 用户进入某个 Project，THE Platform SHALL 仅展示属于该 Project 的 Requirement 列表，不混入其他 Project 的数据。
4. IF 用户尝试访问无权限的 Project，THEN THE Platform SHALL 拒绝该请求并向用户展示"无访问权限"的提示信息，不暴露 Project 的任何内容。
5. THE Platform SHALL 支持为每个 Project 独立配置代码库路径（codebase_dir），供 AI_Analyzer 和 Dev_Plan 生成时读取。
6. WHEN 管理员归档一个 Project，THE Platform SHALL 将该 Project 标记为 archived 状态，其下所有 Requirement 保留只读访问（可查看、不可编辑），且不可在该 Project 下新增 Requirement。
7. WHEN 管理员归档一个 Project，THE Platform SHALL 在归档 Project 列表中仍展示该 Project，以便历史查阅。

---

### 需求 2：多角色成员管理

**用户故事：** 作为项目 owner，我希望为项目成员分配不同角色，以便产品经理、开发、测试、设计各司其职，减少沟通成本和返工。

#### 验收标准

1. THE Platform SHALL 支持 owner 为每个 Project 的成员分配且仅分配一个 Role，Role 取值为 owner / pm / developer / tester / designer；每个成员在同一 Project 内只能持有一个 Role。
2. WHEN owner 为成员分配或变更 Role，THE Platform SHALL 立即更新该成员在该 Project 内的权限，无需重新登录。
3. WHEN Role 为 pm 的成员访问处于 `pending_review` 状态的 Requirement，THE Platform SHALL 展示审核操作入口（通过 / 编辑后通过 / 驳回）。
4. WHEN Role 为 developer 的成员登录，THE Platform SHALL 展示分配给该成员的 Requirement 及其 Dev_Plan。
5. WHEN Role 为 tester 的成员登录，THE Platform SHALL 展示 Lifecycle_Status 为 `in_testing` 的 Requirement 及其测试要点。
6. WHEN Role 为 designer 的成员登录，THE Platform SHALL 展示 design_required 标志为 true 的 Requirement 及其设计备注字段。
7. IF 成员尝试执行超出其 Role 权限的操作，THEN THE Platform SHALL 拒绝该操作并向用户展示"权限不足"的提示信息，不执行任何数据变更。

---

### 需求 3：完整需求生命周期状态机

**用户故事：** 作为产品经理，我希望每条需求都有明确的生命周期状态，以便随时了解需求进展并在正确节点介入。

#### 验收标准

1. THE Platform SHALL 为每条 Requirement 维护 Lifecycle_Status，合法状态序列为：`draft` → `ai_analyzing` → `pending_review` → `approved` → `planning` → `dev_ready` → `in_development` → `in_testing` → `done`；终态还包括 `rejected` 和 `deferred`，可从 `pending_review` 转入。
2. WHEN Requirement 的 Lifecycle_Status 发生变更，THE Platform SHALL 记录变更时间戳、操作人（用户 ID）和变更原因（必填，不少于 1 个字符），保留完整审计日志且不可删除。
3. IF Requirement 处于 `ai_analyzing` 状态超过 300 秒，THEN THE Platform SHALL 将其状态回退至 `draft` 并在审计日志中记录"AI 分析超时"错误信息。
4. THE Platform SHALL 禁止跳过 Gate 节点（`pending_review`）的状态跳转，即任何将 Lifecycle_Status 从 `ai_analyzing` 直接设为 `approved` 或更后续状态的请求均被拒绝。
5. WHEN Reviewer 在 Gate 节点选择"驳回"，THE Platform SHALL 要求填写驳回原因（不少于 10 个字符），填写完成后将 Requirement 状态设为 `rejected`；IF 驳回原因少于 10 个字符，THEN THE Platform SHALL 阻止状态变更并提示"驳回原因不少于 10 个字符"。
6. WHEN Reviewer 在 Gate 节点选择"搁置"，THE Platform SHALL 将 Requirement 状态设为 `deferred`，并允许（非强制）设置重新评估日期；IF 设置了重新评估日期，THEN 该日期必须为未来日期，否则 THE Platform SHALL 拒绝保存并提示"重新评估日期必须为未来日期"。
7. WHEN Requirement 处于 `rejected` 或 `deferred` 状态，THE Platform SHALL 允许 pm 或 owner 将其重新设为 `draft` 状态以重新启动分析流程。

---

### 需求 4：AI 需求澄清与结构化

**用户故事：** 作为产品经理，我希望 AI 能将用户的模糊描述自动转化为标准化的需求描述，以便减少人工整理时间。

#### 验收标准

1. WHEN Requirement 进入 `ai_analyzing` 状态，THE AI_Analyzer SHALL 读取 Raw_Input 并结合 Context_Window（项目描述 + 最近 20 条 Lifecycle_Status 为 `done` 的需求摘要）生成 Clarification。
2. THE AI_Analyzer SHALL 在 Clarification 中输出以下结构化字段：需求标题（1–50 字）、背景描述（1–200 字）、核心目标（1–200 字）、用户价值（1–200 字）、排除范围（0–200 字，可为空）、验收条件（3–10 条）。
3. IF Raw_Input 字符数少于 10，THEN THE AI_Analyzer SHALL 拒绝分析，将 Requirement 状态回退至 `draft`，并向用户展示"描述过短，请补充更多信息"的提示。
4. WHEN Clarification 生成完成，THE AI_Analyzer SHALL 在 30 秒内将 Requirement 状态自动推进至 `pending_review`；IF 30 秒内未完成状态推进，THEN THE Platform SHALL 将状态回退至 `draft` 并记录错误。
5. WHEN Reviewer 对 Clarification 进行编辑并保存，THE Platform SHALL 保留原始 AI 生成版本和人工修改版本，两个版本均可查看，且保留至 Requirement 被删除为止。
6. THE AI_Analyzer SHALL 在 Clarification 中标注置信度（0–100% 整数）。
7. IF Clarification 的置信度低于 60%，THEN THE Platform SHALL 在审核界面展示"建议人工补充背景信息"的提示，直至 Reviewer 手动关闭该提示或对 Clarification 进行编辑。
8. IF AI 服务不可用导致 Clarification 生成失败，THEN THE Platform SHALL 将 Requirement 状态回退至 `draft` 并向用户展示"AI 服务暂时不可用，请稍后重试"的错误提示。

---

### 需求 5：AI 必要性与优先级评估

**用户故事：** 作为产品经理，我希望 AI 基于整体产品上下文自动评估每条需求的必要性和优先级，以便做出更客观的排期决策。

#### 验收标准

1. WHEN AI_Analyzer 生成 Clarification，THE AI_Analyzer SHALL 同步输出 Necessity_Score（1–10 整数）和 Priority（P0/P1/P2/P3），并附带不少于 50 字的评估理由；评估理由中必须明确引用以下至少一项因素：当前 Project 中 `approved` 及以上状态的需求数量、项目描述中声明的核心目标、Raw_Input 中的紧急程度关键词。
2. WHEN AI_Analyzer 输出 Priority 评估，THE AI_Analyzer SHALL 在评估理由中明确说明参考了哪些 Context_Window 因素（需求数量 / 核心目标 / 紧急关键词），使评估过程可追溯。
3. IF Necessity_Score 低于 4，THEN THE Platform SHALL 在审核界面展示醒目的警告提示"AI 评估必要性较低，建议谨慎通过"，该提示在 Reviewer 做出审核决定前持续显示。
4. WHEN Reviewer 修改 AI 给出的 Priority，THE Platform SHALL 要求 Reviewer 填写覆盖原因（不少于 1 个字符），并将原始 AI Priority、人工修改后的 Priority 和覆盖原因一并存储，可通过 API 查询。
5. WHEN AI_Analyzer 完成对某条 Requirement 的分析，THE AI_Analyzer SHALL 检测同一 Project 内与该 Requirement 语义相似度超过 85% 的已有 Requirement；IF 存在此类 Requirement，THEN THE Platform SHALL 在该 Requirement 的审核界面展示重复预警及相似需求的标题和链接。

---

### 需求 6：AI 工作量估算

**用户故事：** 作为项目经理，我希望 AI 基于代码库复杂度自动估算每条需求的开发工作量，以便制定合理的迭代计划。

#### 验收标准

1. WHEN Requirement 进入 `planning` 状态，THE AI_Analyzer SHALL 读取 Project 配置的 codebase_dir，扫描文件名或文件内容与 Clarification 关键词匹配的源文件，输出 Effort_Estimate（以人天为单位，精确到 0.5 天）；扫描超时上限为 120 秒，IF 超时，THEN THE AI_Analyzer SHALL 跳过代码扫描并在结果中标注"代码扫描超时，估算仅供参考"。
2. THE AI_Analyzer SHALL 在 Effort_Estimate 中拆分以下子项：前端开发、后端开发、测试、设计；IF Clarification 未涉及某子项对应的功能范围，THEN 该子项标注 N/A。
3. IF codebase_dir 不存在或无法读取，THEN THE AI_Analyzer SHALL 跳过代码扫描，仅基于 Clarification 文本输出估算，并在结果中标注"未读取代码库，估算仅供参考"。
4. THE AI_Analyzer SHALL 在 Effort_Estimate 中列出置信区间（乐观 / 正常 / 悲观），三个值均以人天表示，且满足：乐观值 ≤ 正常值 ≤ 悲观值，且悲观值不超过乐观值的 3 倍。
5. WHEN Reviewer 修改 Effort_Estimate 并保存，THE Platform SHALL 保留 AI 原始估算值和人工修改值；每条 Requirement 最多保留最近 20 条历史记录，超出时自动删除最旧记录。

---

### 需求 7：开发计划生成

**用户故事：** 作为开发人员，我希望系统根据需求文档和现有代码库自动生成具体的开发计划，以便快速了解需要修改哪些文件、执行哪些步骤。

#### 验收标准

1. WHEN Requirement 进入 `planning` 状态，THE AI_Analyzer SHALL 读取 codebase_dir 中与 Clarification 关键词匹配的源文件，生成 Dev_Plan，包含：受影响文件列表（含文件路径和修改类型 add/modify/delete）、实现步骤（有序列表，每步不超过 100 字）、测试要点（至少 3 条）、设计备注（如涉及 UI 变更）。
2. THE AI_Analyzer SHALL 在 Dev_Plan 中标注每个受影响文件的修改风险等级（low / medium / high），high 风险文件需附带不少于 20 字的风险说明。
3. IF Requirement 的 Clarification 中包含 UI 变更描述，THEN THE AI_Analyzer SHALL 在 Dev_Plan 的设计备注中生成线框图描述文本（非图片），描述文本须包含：页面/组件名称、布局结构描述、关键交互元素列表。
4. WHEN Dev_Plan 生成完成，THE Platform SHALL 将 Requirement 状态推进至 `dev_ready`，并向 Project 中 Role 为 developer 的成员发送通知，通知内容包含 Requirement 标题、ID 和 Dev_Plan 链接。
5. WHEN Reviewer 对 Dev_Plan 进行编辑并提交，THE Platform SHALL 保存该版本并记录版本号、保存时间和操作人；每条 Requirement 至少保留最近 5 个 Dev_Plan 版本。
6. IF codebase_dir 不可访问或 Dev_Plan 生成过程中发生错误，THEN THE Platform SHALL 将 Requirement 状态回退至 `approved`，并向操作人展示"开发计划生成失败，请检查代码库路径配置"的错误提示。
7. IF Dev_Plan 生成超过 180 秒未完成，THEN THE Platform SHALL 中止生成，将 Requirement 状态回退至 `approved`，并记录超时错误。

---

### 需求 8：AI 开发工具调度

**用户故事：** 作为开发人员，我希望平台能自动调度本地已安装的 AI 编程工具（Codex/Cursor 等）执行开发任务，以便减少手动操作。

#### 验收标准

1. WHEN Platform 启动，THE Agent_Dispatcher SHALL 扫描系统 PATH，检测可用的 CLI_Agent（Codex、Cursor、Hermes、Gemini），并将检测结果缓存，缓存有效期为 60 秒；缓存过期后，下次调度前自动重新扫描。
2. WHEN Requirement 进入 `in_development` 状态，THE Agent_Dispatcher SHALL 根据 Dev_Plan 选择具备 `code_write` 能力的 CLI_Agent，优先级顺序为：用户指定 > Hermes > Codex > Cursor > Gemini。
3. WHEN Agent_Dispatcher 调度 CLI_Agent 执行任务，THE Agent_Dispatcher SHALL 将 Dev_Plan 和 Clarification 作为上下文传递给 CLI_Agent，并记录调度日志（Agent 名称、启动时间、传入参数摘要）。
4. IF 没有可用的 CLI_Agent，THEN THE Agent_Dispatcher SHALL 向用户展示"未检测到可用 Agent，请安装 Codex 或 Cursor"的提示，并提供安装引导链接，Requirement 状态保持 `dev_ready` 不变。
5. WHEN CLI_Agent 执行完成，THE Platform SHALL 展示 Agent 输出的代码变更摘要（diff 预览），并将 Requirement 状态推进至 `in_testing`，等待人工审核。
6. WHILE CLI_Agent 正在执行，THE Platform SHALL 以不超过 2 秒的刷新间隔展示实时日志流。
7. IF CLI_Agent 执行超过 600 秒未完成，THEN THE Platform SHALL 终止该 Agent 进程，将 Requirement 状态回退至 `dev_ready`，并向用户展示"Agent 执行超时，请重试或手动执行"的提示。
8. IF CLI_Agent 执行过程中返回非零退出码，THEN THE Platform SHALL 将 Requirement 状态回退至 `dev_ready`，展示 Agent 的错误输出，并记录失败日志。

---

### 需求 9：需求解析器与格式化

**用户故事：** 作为平台，我需要能够解析和格式化结构化需求数据，以便在 AI 分析、文档导出和 API 传输之间保持数据一致性。

#### 验收标准

1. WHEN 需求数据从数据库读取，THE Platform SHALL 将其解析为标准 Requirement 对象，并对所有必填字段进行类型校验：`id`（string）、`title`（string）、`description`（string）、`project_id`（string）、`status`（枚举值）、`created_at`（ISO 8601 时间戳）。
2. THE Platform SHALL 支持将 Requirement 对象格式化为 Markdown 文档，格式化后的文档可被重新解析为 Requirement 对象，且解析结果与原始对象在所有必填字段上的值完全相同（往返一致性）。
3. WHEN 对任意合法 Requirement 对象执行"解析 → 格式化 → 再解析"操作，THE Platform SHALL 产生与原始对象在所有必填字段上值完全相同的结果（往返属性）。
4. IF 输入数据缺少必填字段（`title`、`description`、`project_id` 中的任意一个），THEN THE Platform SHALL 返回错误信息，错误信息中明确列出所有缺失的字段名称。
5. IF 输入数据中某必填字段的值类型不符合预期（如 `created_at` 不是合法 ISO 8601 格式），THEN THE Platform SHALL 返回错误信息，错误信息中明确指出字段名称和期望类型。
6. THE Platform SHALL 支持将 Requirement 导出为 JSON 格式，导出的 JSON 包含所有必填字段和可选字段的当前值，且可被重新导入并还原为与原始对象在所有字段上值完全相同的 Requirement 对象。

---

### 需求 10：通知与协作闭环

**用户故事：** 作为需求提交者，我希望在需求状态发生关键变更时收到通知，以便了解我的需求是否被采纳和实现。

#### 验收标准

1. WHEN Requirement 的 Lifecycle_Status 变更为 `approved`、`done`、`rejected` 或 `deferred`，THE Platform SHALL 向 Requirement 的原始提交者发送站内通知，通知内容包含需求标题、新状态和变更说明（变更原因字段的内容）。
2. WHEN Requirement 进入 `pending_review` 状态，THE Platform SHALL 向 Project 中 Role 为 pm 的所有成员发送审核提醒通知，通知内容包含需求标题、提交者名称和审核链接。
3. WHEN Requirement 进入 `dev_ready` 状态，THE Platform SHALL 向 Project 中 Role 为 developer 的所有成员发送开发任务通知，通知内容包含需求标题、Dev_Plan 链接和预计工作量。
4. WHEN Requirement 进入 `in_testing` 状态，THE Platform SHALL 向 Project 中 Role 为 tester 的所有成员发送测试任务通知，通知内容包含需求标题、测试要点数量和 Requirement 链接。
5. THE Platform SHALL 在通知中心页面展示当前用户的所有通知，支持按已读/未读筛选，每页展示不超过 50 条，并以 ISO 8601 格式显示通知时间戳。
6. IF 通知发送失败，THEN THE Platform SHALL 将失败通知加入重试队列，最多重试 3 次，每次间隔不少于 30 秒；IF 3 次重试均失败，THEN THE Platform SHALL 将该通知标记为"发送失败"并记录错误日志，不再自动重试。
