# CoBuilder v2 — 市场调研 + 方案重定义

> 基于市场现有工具的能力分析，重新定义 CoBuilder 的技术方案。

---

## 一、市场工具全景图

### 1. Agent 执行层（做具体事的）

| 工具 | 能力 | CLI/API | 代码读写 | 适合阶段 | 开源 | 备注 |
|------|------|---------|---------|---------|------|------|
| **Claude Code** | 深度代码理解 + 生成 | CLI (`claude -p`) | ✅ 读+写 | 代码审查/文档生成/实现 | ❌ | 最强代码理解能力 |
| **Cursor Agent** | 代码编辑 + 聊天 | CLI (`cursor-agent`) | ✅ 读+写 | 代码审查/实现 | ❌ | 编辑体验最好 |
| **Codex CLI** | OpenAI 代码生成 | CLI (`codex exec`) | ✅ 读+写 | 实现 | ✅ | 有沙箱隔离 |
| **GitHub Copilot CLI** | GitHub 生态集成 | CLI (`copilot -p`) | ✅ 读+写 | 实现/审查 | ❌ | 天然集成 GitHub PR |
| **Hermes Agent** | 通用 Agent + MCP | CLI + ACP | ⚠️ 依赖配置 | 意图分析/通用任务 | ✅ | 你已经在用 |
| **Aider** | 结对编程 | CLI | ✅ 读+写 | 实现 | ✅ | 轻量，支持多模型 |
| **Cline** | VS Code 内 Agent | 插件 | ✅ 读+写 | 实现 | ✅ | 有 MCP 支持 |
| **Devin** | 自主软件工程 | API | ✅ 读+写 | 全流程 | ❌ | 最自主但最贵 |
| **OpenCode** | 开源 Agent | CLI (`opencode run`) | ✅ 读+写 | 实现 | ✅ | 轻量 |
| **Gemini CLI** | Google 生态 | CLI | ✅ 读+写 | 实现 | ✅ | 免费额度大 |

### 2. 代码分析层（理解代码的）

| 工具 | 功能 | 接入方式 | 适合阶段 | 备注 |
|------|------|---------|---------|------|
| **Tree-sitter** | AST 解析 | 本地库 | 代码结构分析 | 零成本，毫秒级 |
| **OpenAI Embeddings** | 语义搜索 | API | 代码语义理解 | 需要向量数据库 |
| **CodeGPT MCP** | 代码图谱分析 | MCP Server | 代码关系分析 | ⭐394 |
| **recomcode** | 代码上下文检索 | CLI | 代码搜索 | token 优化 |
| **pygount** | 代码统计 | CLI | 项目概况 | LOC/语言/比例 |
| **AST-grep** | 结构化代码搜索 | CLI | 精确代码匹配 | 比 grep 强 |

### 3. 需求管理层（管需求的）

| 工具 | 功能 | AI 能力 | 开源 | 适合场景 |
|------|------|---------|------|---------|
| **Linear** | 项目管理 | AI 分类/搜索 | ❌ | 团队协作 |
| **GitHub Issues** | 问题追踪 | Copilot 集成 | ✅ | 开源项目 |
| **Canny** | 功能投票 | ❌ | ❌ | 用户反馈收集 |
| **Nolt** | 功能投票 | ❌ | ❌ | 简单的需求投票 |
| **Productboard** | 产品管理 | AI 优先级 | ❌ | 产品团队 |
| **Plane** | 项目管理 | ❌ | ✅ | Jira 替代 |
| **Huly** | 项目管理 | ❌ | ✅ | Linear 替代 |
| **Taiga** | 敏捷管理 | ❌ | ✅ | 开源 Scrum |

### 4. 工作流编排层（串流程的）

| 工具 | 功能 | 接入方式 | 适合场景 |
|------|------|---------|---------|
| **n8n** | 可视化工作流 | 自托管 | 通用自动化 |
| **Temporal** | 持久化工作流 | SDK | 复杂业务流程 |
| **Inngest** | 事件驱动工作流 | SDK | Next.js 集成 |
| **OpenAgentsControl** | AI Agent 工作流 | 框架 | ⭐4075 plan-first 开发 |
| **CocoPlus** | 开发生命周期 | Snowflake 插件 | 数据工程项目 |
| **Durable Functions** | 无状态工作流 | Azure/WS | 云原生 |

---

## 二、关键发现

### 发现 1：没有现成的"需求 → 代码"全链路工具

市面上的工具要么只管需求（Linear、Canny），要么只管代码（Cursor、Codex），**没有人把"用户反馈 → 需求分析 → 代码变更"串成一条完整的流水线**。

这是 CoBuilder 的核心差异化机会。

### 发现 2：MCP（Model Context Protocol）是最佳接入方式

2025-2026 年，MCP 已经成为 AI Agent 与外部工具交互的标准协议。CoBuilder 应该：
- 作为 MCP Server 暴露能力（让 Agent 能查询/更新需求状态）
- 作为 MCP Client 调用外部工具（让 Agent 能操作 CoBuilder）

### 发现 3：Tree-sitter 是代码分析的最佳零成本方案

不需要调 API，本地 AST 解析就能做到：
- 函数/类/接口的精确提取
- 依赖关系分析
- 代码结构理解
- 毫秒级响应

### 发现 4：OpenAgentsControl 的 plan-first 模式值得借鉴

⭐4075 的 OpenAgentsControl 项目提出了 "plan-first development"：
- 先让 AI 制定计划 → 人工审批 → 再执行
- 这和 CoBuilder 的 Gate 模式完全一致

### 发现 5：GitHub Issues + Copilot 是最小闭环

如果 CoBuilder 要做 MVP，最轻量的方案是：
- 用户反馈 → GitHub Issue
- Copilot 自动分析 + 生成 PR
- 人工 Review PR
- 合并 → 通知用户

---

## 三、重新定义的方案

### 核心架构：三层分离

```
┌─────────────────────────────────────────────┐
│  Layer 3: 用户层                             │
│  Web UI / Alice 客户端 / API                 │
│  功能：提交需求、查看进度、审核文档、审核代码   │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│  Layer 2: 编排层（CoBuilder Daemon）          │
│  功能：流水线引擎、Agent 调度、Gate 管理      │
│  技术：Next.js API Routes + SQLite           │
│  借鉴：Open Design 的 daemon 模式            │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│  Layer 1: 执行层（外部 Agents）               │
│  Claude Code / Cursor / Codex / Hermes      │
│  功能：读代码、分析问题、写文档、改代码        │
│  接入：CLI 调用 / MCP / ACP                  │
└─────────────────────────────────────────────┘
```

### 五阶段流水线（简化版）

```
用户提交需求
    │
    ▼
[Stage 1] 意图分析 ← Hermes（LLM 对话能力）
    │ 输出：分类 + 优先级 + 一句话总结
    │
    ▼
[Stage 2] 代码定位 ← Tree-sitter（本地 AST）+ Hermes（语义理解）
    │ 输出：受影响的文件 + 根因分析
    │
    ▼
[Stage 3] 需求文档 ← Claude Code / Cursor（读代码 + 写文档）
    │ 输出：结构化需求文档（背景/方案/复杂度/测试要点）
    │
    ▼
🔒 Gate 1: 人工审核需求文档
    │
    ▼
[Stage 4] 代码实现 ← Cursor / Codex（读代码 + 改代码）
    │ 输出：代码变更（diff）
    │
    ▼
🔒 Gate 2: 人工审核代码
    │
    ▼
[Stage 5] 发布 + 通知
```

### 与之前方案的关键差异

| 之前 | 现在 | 为什么改 |
|------|------|---------|
| 所有阶段都调 LLM API | Stage 2 用 Tree-sitter 本地分析 | 省 token，速度快，更精确 |
| 代码扫描靠关键词匹配 | Tree-sitter AST 精确解析 | 关键词匹配太粗糙 |
| Agent 调度靠硬编码 | 基于能力标签的动态调度 | 支持更多 agent 类型 |
| 没有 MCP 集成 | CoBuilder 暴露 MCP Server | 让 agent 能主动查询需求 |
| Gate 只有"通过/驳回" | Gate 支持"编辑后通过" | 更实际的工作流 |

---

## 四、推荐技术选型

### Stage 1：意图分析

**首选：Hermes Agent（你已经在用）**
- 理由：免费、本地、你熟悉、支持 MCP
- 用法：调用 Hermes 的 LLM 能力做分类和定级
- 备选：mimo API（你有 key，成本低）

### Stage 2：代码定位

**首选：Tree-sitter（本地 AST 解析）**
- 理由：零成本、毫秒级、精确到函数级别
- 用法：解析项目代码，提取函数/类/依赖关系
- 备选：pygount（代码统计）+ AST-grep（结构化搜索）

**辅助：MCP Code Graph Server（⭐394）**
- 理由：提供代码图谱分析能力
- 用法：作为 MCP Server 被 CoBuilder 调用

### Stage 3：需求文档生成

**首选：Claude Code**
- 理由：最强代码理解能力，能读整个代码库后写出高质量文档
- 用法：`claude -p "根据以下代码分析，生成需求文档：..."`
- 备选：Cursor Agent

### Stage 4：代码实现

**首选：Cursor Agent**
- 理由：编辑体验最好，支持多文件修改
- 用法：`cursor-agent --print "实现以下需求：..."`
- 备选：Codex CLI（有沙箱，更安全）、Aider（轻量）

### Stage 5：代码审核辅助

**首选：GitHub Copilot CLI**
- 理由：天然集成 GitHub PR 流程
- 用法：`copilot -p "审查这个 PR 的代码变更：..."`
- 备选：Claude Code

### 工作流编排

**首选：Inngest（事件驱动工作流）**
- 理由：与 Next.js 深度集成、持久化执行、重试机制
- 用法：每个 Stage 是一个 Inngest Function，Gate 是等待事件
- 备选：Temporal（更重但更强大）、自建状态机（最简单）

### 代码分析辅助

**Tree-sitter + 自建 wrapper**
- 提取函数签名、类定义、导入关系
- 构建代码知识图谱
- 为 Agent 提供精准上下文

---

## 五、MVP 路线（重新定义）

### 最小可行产品：只跑通 3 个阶段

```
用户提交 → [Hermes] 意图分析 → [Claude Code] 需求文档 → 🔒 人工审核
```

**为什么只做 3 个阶段：**
1. 意图分析（Hermes）+ 需求文档（Claude Code）+ 人工审核 = 最小闭环
2. 不需要 Tree-sitter、不需要 Cursor、不需要复杂编排
3. 验证"AI 生成的需求文档"是否有价值
4. 1-2 天可以做完

### Phase 1（MVP，2天）：意图分析 + 需求文档

```
功能：
- 用户提交需求
- Hermes 自动分析意图（分类 + 优先级）
- Claude Code 读代码生成需求文档
- 管理员审核文档（通过/驳回/编辑）

技术：
- 保持现有 CoBuilder 架构
- 新增 pipeline_runs 表
- 新增 2 个 API 路由（启动分析、生成文档）
- 新增 1 个 Gate UI（文档审核）
```

### Phase 2（+3天）：Tree-sitter 代码分析

```
功能：
- 自动扫描项目代码结构
- 精确匹配受影响的文件和函数
- 为 Agent 提供精准上下文

技术：
- 集成 Tree-sitter（npm 包）
- 构建代码知识图谱 API
- 优化意图分析的输入质量
```

### Phase 3（+3天）：代码实现 + Gate 2

```
功能：
- Agent 根据需求文档修改代码
- 人工审核代码变更
- 合并 + 发布

技术：
- 集成 Cursor Agent CLI
- Diff 查看器
- Gate 2 UI
```

### Phase 4（+2天）：MCP 集成 + 打磨

```
功能：
- CoBuilder 暴露 MCP Server
- 让外部 Agent 能查询/更新需求状态
- 通知闭环

技术：
- MCP Server 实现
- 通知系统完善
- 整体 UI 打磨
```

**总 MVP 工时：~10 天**

---

## 六、CoBuilder 的护城河

1. **全链路打通** —— 市面上没有"用户反馈 → 需求文档 → 代码变更"的完整工具
2. **Gate 机制** —— AI 不可跳过人工审核，保证质量
3. **Agent 无关** —— 不绑定任何特定 Agent，用户可以随时切换
4. **本地优先** —— 代码分析在本地跑（Tree-sitter），不上传到云端
5. **闭环通知** —— 需求提交者能收到"你的需求已实现"的通知

---

## 七、与竞品的差异化

| 竞品 | 它做什么 | CoBuilder 做什么不同 |
|------|---------|---------------------|
| Linear | 需求管理 + AI 分类 | 我们连接到代码变更，不只是分类 |
| Canny | 用户反馈收集 | 我们自动分析代码并生成文档 |
| Cursor | AI 代码编辑 | 我们编排 Cursor 去做特定任务 |
| GitHub Copilot | AI 代码补全 | 我们管理从需求到代码的全流程 |
| Devin | 自主编程 | 我们保持人在环路中（Gate） |
| OpenAgentsControl | AI Agent 工作流 | 我们专注需求管理场景 |
