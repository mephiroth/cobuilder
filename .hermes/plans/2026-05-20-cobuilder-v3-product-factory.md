# CoBuilder v3 — AI 产品工厂

> 从用户的一个想法，到一个可运行的产品。全程 AI 驱动，人类把控方向。

---

## 一、定位变化

| | v2（需求管理） | v3（产品工厂） |
|---|---|---|
| 输入 | 用户反馈/需求 | 用户的一个想法 |
| 输出 | 需求文档 + 代码变更 | 一个可运行的产品 |
| AI 角色 | 分析师 + 文档员 | 产品经理 + 架构师 + 全栈工程师 + 测试员 |
| 人类角色 | 审核文档和代码 | 把控方向和验收 |
| 价值主张 | 帮开发者处理需求 | 帮任何人把想法变成产品 |

---

## 二、完整流水线

```
用户输入一个想法
"我想做一个 XX"
    │
    ▼
┌─────────────────────────────────────────────┐
│  Stage 1: 想法澄清                           │
│  Agent: Hermes (对话能力)                     │
│  输出: 结构化产品简报 (What / Who / Why)       │
│  Gate: ✅ 用户确认简报                        │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────┐
│  Stage 2: 市场调研                            │
│  Agent: Hermes + Web Search                  │
│  输出: 竞品分析 + 差异化定位 + 目标用户画像     │
│  Gate: ✅ 用户确认方向                        │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────┐
│  Stage 3: 产品设计                            │
│  Agent: MiMo (推理能力)                       │
│  输出:                                         │
│  · 功能清单 + 优先级 (MVP / v1 / v2)           │
│  · 信息架构 (页面结构 + 导航)                   │
│  · UI 风格定义 (配色/字体/布局)                 │
│  Gate: ✅ 用户确认设计方案                     │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────┐
│  Stage 4: 技术架构                            │
│  Agent: Cursor Agent (代码理解)               │
│  输出:                                         │
│  · 技术栈选型 (框架/数据库/部署)                │
│  · 数据库 Schema                               │
│  · API 设计 (REST / GraphQL)                   │
│  · 目录结构                                     │
│  Gate: ✅ 用户确认架构                         │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────┐
│  Stage 5: 代码实现                            │
│  Agent: Cursor / Codex / Claude Code          │
│  模式: 并行子任务                               │
│  · Task A: 数据库 + API                        │
│  · Task B: 前端页面                             │
│  · Task C: 样式 + 组件                          │
│  输出: 可运行的代码                             │
│  Gate: ✅ 用户验收                             │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────┐
│  Stage 6: 测试 + 修复                         │
│  Agent: Codex (沙箱测试)                      │
│  输出:                                         │
│  · 自动化测试用例                               │
│  · Bug 修复                                    │
│  · 代码优化                                     │
│  Gate: ✅ 用户验收                             │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────┐
│  Stage 7: 部署上线                            │
│  Agent: Copilot / CLI 工具                    │
│  输出:                                         │
│  · 部署到 Vercel / Cloudflare / 自托管         │
│  · 域名配置                                     │
│  · 环境变量设置                                 │
│  Gate: ✅ 用户确认上线                         │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────┐
│  Stage 8: 迭代优化                            │
│  Agent: 全部 Agent 协作                        │
│  循环:                                         │
│  · 收集用户反馈                                 │
│  · 分析 + 排优先级                              │
│  · 自动修复 / 优化                              │
│  · 部署新版本                                   │
└─────────────────────────────────────────────┘
```

---

## 三、每个阶段详细设计

### Stage 1: 想法澄清

**输入：** 用户的一句话描述
```
"我想做一个给独立开发者用的需求管理工具"
```

**Agent 工作：**
Hermes 通过多轮对话澄清：
- 这个产品解决什么问题？
- 目标用户是谁？
- 和现有方案有什么不同？
- MVP 包含哪些核心功能？
- 你希望用什么技术栈？

**输出：** 结构化产品简报
```json
{
  "name": "CoBuilder",
  "one_liner": "AI-Native 需求管理平台，从用户反馈到代码变更的全链路自动化",
  "target_users": "独立开发者和小团队",
  "core_pain": "反馈碎片化、需求模糊化、反馈无闭环",
  "mvp_features": [
    "需求收集（提交/投票/评论）",
    "AI 意图分析（分类/定级/定位）",
    "需求文档生成（读代码生成 PRD）",
    "人工 Gate 审核"
  ],
  "tech_preference": "Next.js + SQLite",
  "style_preference": "Paper 风格，温暖配色"
}
```

**Gate：** 用户确认简报内容，可以修改后继续。

### Stage 2: 市场调研

**Agent 工作：**
Hermes + Web Search 搜索竞品：
- 搜索同类产品（Linear、Canny、Nolt 等）
- 分析各竞品的优缺点
- 找出差异化机会
- 定义目标用户画像

**输出：**
```json
{
  "competitors": [
    {"name": "Linear", "strength": "团队协作", "weakness": "不连接代码"},
    {"name": "Canny", "strength": "用户投票", "weakness": "无 AI 分析"},
    {"name": "Nolt", "strength": "简单易用", "weakness": "功能单一"}
  ],
  "differentiator": "全链路打通：反馈 → 需求文档 → 代码变更，其他工具只管需求不管代码",
  "user_persona": {
    "role": "独立开发者",
    "pain": "一个人处理不了海量反馈",
    "goal": "自动化需求分析，聚焦高价值工作"
  }
}
```

**Gate：** 用户确认调研结果和差异化方向。

### Stage 3: 产品设计

**Agent 工作：**
MiMo（推理能力）根据简报和调研结果：
- 设计功能清单，按 MVP / v1 / v2 分级
- 设计信息架构（页面结构、导航、用户流程）
- 设计 UI 风格（配色方案、字体、布局模式）
- 生成 wireframe 描述

**输出：**
```markdown
## 功能清单

### MVP（本期实现）
- [ ] 需求提交（表单 + 截图）
- [ ] 需求列表（筛选 + 排序 + 投票）
- [ ] AI 意图分析
- [ ] 需求文档生成
- [ ] Gate 审核
- [ ] 管理后台

### v1（下期）
- [ ] Agent 检测 + 调度
- [ ] 代码实现流水线
- [ ] 通知闭环

### v2（远期）
- [ ] 多项目支持
- [ ] MCP 集成
- [ ] 团队协作

## 信息架构
首页 → 提交需求 → 需求详情 → 管理后台

## UI 风格
Paper 风格：米白背景 (#FAF8F5)、金色强调 (#8B6914)
衬线标题 (Noto Serif SC) + 无衬线正文 (Noto Sans SC)
```

**Gate：** 用户确认设计方案。

### Stage 4: 技术架构

**Agent 工作：**
Cursor Agent 读取现有代码（如果有），或从零设计：
- 技术栈选型（给出理由）
- 数据库 Schema（完整 SQL）
- API 路由设计（RESTful）
- 目录结构
- 依赖列表

**输出：**
```
技术栈：
- Framework: Next.js 16 (App Router)
- Database: node:sqlite (零依赖)
- Styling: Tailwind CSS v4
- AI: MiMo v2.5 Pro API

数据库表：
- projects (id, name, codebase_dir, description)
- ideas (id, project_id, title, description, status, ...)
- comments, votes, notifications, pipeline_runs, requirement_docs

目录结构：
src/app/ → 页面
src/app/api/ → API 路由
src/components/ → 组件
src/lib/db/ → 数据层
src/lib/ai/ → AI 集成
```

**Gate：** 用户确认架构。

### Stage 5: 代码实现

**Agent 工作：**
多个 Agent 并行工作：

```
┌──────────┐  ┌──────────┐  ┌──────────┐
│ Agent A  │  │ Agent B  │  │ Agent C  │
│ 数据库   │  │ API 路由  │  │ 前端页面  │
│ + ORM    │  │ + 业务逻辑│  │ + 组件    │
└────┬─────┘  └────┬─────┘  └────┬─────┘
     │             │             │
     └─────────────┼─────────────┘
                   ▼
            集成 + 联调
```

每个 Agent 的工作：
1. 读取架构文档
2. 生成代码
3. 自检（语法、类型、导入）
4. 输出文件

**Gate：** 用户验收（看效果、测功能）。

### Stage 6: 测试 + 修复

**Agent 工作：**
- 生成测试用例
- 运行测试
- 发现 bug → 自动修复
- 代码优化（性能、安全）

**Gate：** 用户确认。

### Stage 7: 部署上线

**Agent 工作：**
- 配置部署环境
- 执行部署命令
- 配置域名（可选）
- 验证线上可用

**Gate：** 用户确认上线。

### Stage 8: 迭代优化（持续循环）

```
用户反馈 → 收集 → 分析 → 排优先级 → 实现 → 部署 → 通知用户
    ↑                                                      │
    └──────────────────────────────────────────────────────┘
```

---

## 四、与现有产品的差异化

| 产品 | 它做什么 | CoBuilder 做什么不同 |
|------|---------|---------------------|
| **Cursor** | AI 代码编辑 | 我们管理从想法到产品的全流程 |
| **Devin** | 自主编程 | 我们保持人在环路中（Gate） |
| **Bolt.new** | 一句话生成应用 | 我们有结构化的 8 阶段流水线 |
| **Replit Agent** | AI 生成代码 | 我们有市场调研 + 产品设计阶段 |
| **OpenDesign** | AI 设计工具 | 我们做产品不只是设计 |
| **v0** | UI 生成 | 我们生成完整产品（前端+后端+数据库） |

**核心差异：** 其他工具要么只做代码生成（Cursor、Devin），要么只做 UI 生成（v0、Bolt），CoBuilder 是唯一一个 **从想法到产品的完整流水线**，且每个阶段都有人工 Gate。

---

## 五、技术架构

```
┌─────────────────────────────────────────────┐
│  Layer 3: 用户层                             │
│  Web UI / Alice 客户端 / API                 │
│  · 想法输入表单                               │
│  · 流水线进度视图                             │
│  · 每个阶段的 Gate 审核界面                    │
│  · 产品预览（iframe 沙盒）                    │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│  Layer 2: 编排层（CoBuilder Daemon）          │
│  · 流水线引擎（8 阶段状态机）                  │
│  · Agent 调度器（按能力标签匹配）              │
│  · Gate 管理器（等待人类输入）                 │
│  · 上下文管理器（阶段间传递数据）              │
│  · 文件系统管理（项目工作目录）                │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│  Layer 1: 执行层（外部 Agents）               │
│  Hermes → 想法澄清 + 市场调研                 │
│  MiMo → 产品设计 + 技术架构                   │
│  Cursor → 代码实现 + 代码审查                  │
│  Codex → 代码实现（沙箱安全）                  │
│  Copilot → 部署 + GitHub 集成                 │
└─────────────────────────────────────────────┘
```

### 关键技术决策

1. **每个产品一个工作目录** — `.cobuilder/projects/<id>/`，Agent 在这个目录里工作
2. **阶段间通过 JSON 传递上下文** — 每个阶段的输出是下一个阶段的输入
3. **Gate 是阻塞式的** — 流水线在 Gate 处暂停，等待人类输入
4. **支持断点续跑** — 流水线状态持久化到 SQLite，刷新页面不丢失
5. **产品预览** — 实现阶段生成的代码可以在 iframe 沙盒中预览

---

## 六、数据模型

```sql
-- 产品（一个想法 = 一个产品）
CREATE TABLE products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'ideation',  -- ideation|designing|building|testing|deployed|iterating
  work_dir TEXT,                    -- .cobuilder/projects/<id>/
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- 流水线运行
CREATE TABLE pipeline_runs (
  id TEXT PRIMARY KEY,
  product_id TEXT REFERENCES products(id),
  stage TEXT NOT NULL,              -- clarify|research|design|architecture|implement|test|deploy|iterate
  agent_id TEXT,
  status TEXT DEFAULT 'pending',    -- pending|running|completed|failed|gate_waiting
  input_data TEXT,                  -- JSON
  output_data TEXT,                 -- JSON
  gate_decision TEXT,               -- approved|rejected|edited
  gate_comments TEXT,
  started_at TEXT,
  completed_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- 生成的文档（产品简报、竞品分析、设计文档、架构文档）
CREATE TABLE documents (
  id TEXT PRIMARY KEY,
  product_id TEXT REFERENCES products(id),
  stage TEXT NOT NULL,
  type TEXT NOT NULL,               -- brief|research|design|architecture|prd
  content TEXT NOT NULL,            -- Markdown
  version INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

-- 生成的代码文件
CREATE TABLE code_files (
  id TEXT PRIMARY KEY,
  product_id TEXT REFERENCES products(id),
  path TEXT NOT NULL,               -- 相对于 work_dir 的路径
  content TEXT NOT NULL,
  stage TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- 迭代记录
CREATE TABLE iterations (
  id TEXT PRIMARY KEY,
  product_id TEXT REFERENCES products(id),
  feedback TEXT NOT NULL,
  action TEXT,                      -- fix|feature|optimize
  result TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
```

---

## 七、MVP 范围

### 最小可行产品：只做 3 个阶段

```
用户输入想法
  → [Hermes] 想法澄清（多轮对话）
  → [MiMo] 产品设计（功能清单 + UI 风格）
  → 🔒 人工审核
  → 输出：产品设计文档
```

**为什么只做 3 个阶段：**
1. 验证"AI 能否理解用户想法并输出合理的产品设计"
2. 不需要代码实现、不需要部署
3. 1-2 天可以做完
4. 用户拿到设计文档后可以自己用 Cursor 实现

### Phase 1（MVP，2天）：想法澄清 + 产品设计

```
功能：
- 用户输入一句话想法
- Hermes 多轮对话澄清
- MiMo 生成产品设计文档（功能清单 + 信息架构 + UI 风格）
- 管理员审核设计文档

技术：
- 保持现有 CoBuilder 架构
- 新增 products + documents 表
- 新增 2 个 API 路由
- 新增 1 个 Gate UI
```

### Phase 2（+3天）：技术架构生成

```
功能：
- MiMo 根据设计文档生成技术架构
- 包含：技术栈选型 + 数据库 Schema + API 设计 + 目录结构
- 人工审核架构

技术：
- 扩展流水线到 4 个阶段
- 新增架构文档生成 prompt
```

### Phase 3（+5天）：代码实现

```
功能：
- Agent 根据架构文档生成代码
- 支持并行子任务（数据库 + API + 前端）
- 产品预览（iframe 沙盒）

技术：
- 集成 Cursor/Codex CLI
- 文件系统管理
- iframe 沙盒预览
```

### Phase 4（+3天）：部署 + 迭代

```
功能：
- 一键部署到 Vercel
- 用户反馈收集
- 自动迭代优化

技术：
- Vercel API 集成
- 反馈收集表单
- 迭代流水线
```

**总 MVP 工时：~13 天**

---

## 八、与 MiMo 申请的关联

这个定位比"需求管理"更有说服力：

1. **Token 消耗量更大** — 每个产品 8 个阶段，每阶段至少 1 次 LLM 调用，加上多轮对话，一个产品从想法到上线至少消耗 50-100K tokens
2. **用户场景更广** — 不只是开发者，任何有想法的人都能用
3. **技术深度更深** — 多 Agent 协作、长链推理、Gate 机制、沙盒预览
4. **商业潜力更大** — "一句话做产品"是更大的市场

### 申请描述修改建议

> **项目名称：** CoBuilder — AI 产品工厂
>
> **核心痛点：** 有想法的人很多，能把想法变成产品的人很少。传统路径：想清楚 → 写需求 → 找开发 → 开发 → 测试 → 部署，一个人走完全程需要数周。CoBuilder 将这条链路压缩到几小时：用户输入一句话想法，AI 自动完成想法澄清 → 市场调研 → 产品设计 → 技术架构 → 代码实现 → 测试 → 部署，人类只在关键节点做方向把控。
>
> **核心逻辑流：** 8 阶段 AI 流水线，多 Agent 协作。Hermes 做想法澄清和市场调研 → MiMo 做产品设计和技术架构 → Cursor/Codex 并行实现代码（数据库/API/前端分 3 路）→ 自动测试修复 → 一键部署。整条链路 50-100K tokens/产品，涉及 4 种 Agent、8 个阶段、6 个 Gate。每个阶段产出结构化文档，阶段间通过 JSON 传递上下文，支持断点续跑。
>
> **使用模型：** MiMo v2.5 Pro（想法澄清 + 产品设计 + 技术架构 + 内容审核）
>
> **项目地址：** https://github.com/mephiroth/cobuilder
