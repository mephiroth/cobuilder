# CoBuilder v2 — Agent-Native 需求管理平台

> 从"需求看板"升级为"AI 编排平台"：不做 Agent，做 Agent 的容器。

---

## 核心理念

借鉴 Open Design 的三个设计决策：

1. **Agent-as-Teammate** — CoBuilder 不自己跑模型，而是检测 PATH 上已装的 CLI（Hermes、Cursor、Codex、Copilot 等），让它们当执行引擎。
2. **Skill-Driven Pipeline** — 每个阶段是一个 Skill（意图分析、代码审查、需求生成、实现），定义输入/输出/门禁。
3. **Gate Pattern** — 关键节点强制人工审核，AI 不可跳过。

---

## 五阶段流水线

```
用户提交需求
    │
    ▼
┌─────────────────┐
│  Stage 1        │  意图分析（Hermes / 任意 LLM）
│  Intent Analysis │  输出：意图文档（类型/优先级/影响范围）
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Stage 2        │  代码审查（Cursor / Codex / 有代码访问权的 Agent）
│  Code Review    │  读取源码，定位根因，分析影响文件
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Stage 3        │  需求文档生成（Cursor / Codex）
│  Doc Generation │  生成结构化需求文档（背景/方案/复杂度/测试要点）
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  🔒 Gate 1      │  人工审核需求文档
│  Human Review   │  通过 → 进入实现  |  驳回 → 回到 Stage 2
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Stage 4        │  代码实现（Cursor / Codex）
│  Implementation │  Agent 根据需求文档修改代码
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  🔒 Gate 2      │  人工审核代码变更
│  Code Review    │  通过 → 合并  |  驳回 → 回到 Stage 4
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Stage 5        │  发布 + 通知
│  Publish        │  状态 → published，通知提交者
└─────────────────┘
```

---

## Agent 检测与调度

### PATH 扫描（借鉴 Open Design 的 agents.ts）

启动时扫描 PATH 上的 CLI 工具，建立 agent 注册表：

```typescript
interface AgentDef {
  id: string;              // 'cursor' | 'codex' | 'hermes' | 'copilot' | ...
  binary: string;          // 'cursor-agent' | 'codex' | 'hermes' | 'copilot'
  label: string;           // 'Cursor Agent' | 'Codex CLI' | ...
  capabilities: string[];  // ['code_read', 'code_write', 'code_review']
  streamFormat: string;    // 'json-event-stream' | 'acp-json-rpc' | ...
  available: boolean;      // 运行时检测
}
```

### 能力标签

每个 agent 有声明的能力标签，CoBuilder 根据标签分配任务：

| 能力标签 | 含义 | 适用阶段 |
|---------|------|---------|
| `llm_chat` | 纯 LLM 对话（无代码访问） | Stage 1 意图分析 |
| `code_read` | 能读取项目源码 | Stage 2 代码审查 |
| `code_write` | 能修改项目代码 | Stage 4 实现 |
| `code_review` | 能做代码审查 | Gate 2 代码审核 |

### 调度策略

```typescript
function selectAgent(stage: Stage, preferred?: string): AgentDef {
  // 1. 用户指定 → 用指定的
  // 2. 按能力标签匹配 → 选第一个可用的
  // 3. 回退 → 提示用户安装
}
```

---

## Skill 体系（借鉴 Open Design 的 SKILL.md）

每个阶段是一个 Skill，定义在 `skills/` 目录下：

```
skills/
├── intent-analysis/
│   └── SKILL.md          # 意图分析 skill
├── code-review/
│   └── SKILL.md          # 代码审查 skill
├── doc-generation/
│   └── SKILL.md          # 需求文档生成 skill
├── implementation/
│   └── SKILL.md          # 代码实现 skill
└── code-review-gate/
    └── SKILL.md          # 代码审核 skill
```

### SKILL.md 格式

```markdown
---
name: intent-analysis
stage: 1
agent_capability: llm_chat
input:
  - user_description
  - project_context
output:
  - intent_type        # bug | feature | improvement
  - priority           # P0 | P1 | P2 | P3
  - affected_area      # 哪个模块/功能
  - summary            # 一句话总结
  - detailed_analysis  # 详细分析
gates:
  auto_advance: true   # 分析完自动进入下一阶段
---

# 意图分析 Skill

你是一个需求分析师。收到用户反馈后，你需要：

1. **分类**：这是 bug、新功能、还是改进？
2. **定级**：P0(紧急) / P1(重要) / P2(一般) / P3(低优)
3. **定位**：影响哪个模块？
4. **总结**：一句话说清楚用户到底想要什么

## 输出格式

必须输出 JSON：
{
  "intent_type": "bug|feature|improvement",
  "priority": "P0|P1|P2|P3",
  "affected_area": "模块名",
  "summary": "一句话总结",
  "detailed_analysis": "详细分析..."
}
```

---

## Gate 机制（借鉴 Open Design 的五维评审）

### Gate 1：需求文档审核

AI 生成需求文档后，强制进入人工审核：

```
┌─────────────────────────────────────────┐
│  🔒 需求文档待审核                        │
│                                          │
│  标题：支持暗色模式                        │
│  类型：功能请求 | 优先级：P2               │
│                                          │
│  ┌─ 背景分析 ─────────────────────────┐  │
│  │ 用户希望在夜间使用时有更舒适的视觉... │  │
│  └────────────────────────────────────┘  │
│                                          │
│  ┌─ 技术方案 ─────────────────────────┐  │
│  │ 1. 新增 theme provider              │  │
│  │ 2. CSS 变量切换                     │  │
│  │ 3. localStorage 持久化偏好          │  │
│  └────────────────────────────────────┘  │
│                                          │
│  预估工时：3h | 复杂度：中               │
│                                          │
│  [✅ 通过] [✏️ 编辑] [❌ 驳回]           │
└─────────────────────────────────────────┘
```

### Gate 2：代码变更审核

Agent 实现完代码后，强制进入代码审核：

```
┌─────────────────────────────────────────┐
│  🔒 代码变更待审核                        │
│                                          │
│  修改了 3 个文件：                        │
│  - src/components/ThemeProvider.tsx  +45 │
│  - src/app/globals.css              +12 │
│  - src/hooks/useTheme.ts            +28 │
│                                          │
│  Agent 说明：                            │
│  新增 ThemeProvider，使用 CSS 变量实现...  │
│                                          │
│  [📝 查看 Diff] [✅ 合并] [❌ 驳回]      │
└─────────────────────────────────────────┘
```

---

## 数据模型扩展

在现有 CoBuilder schema 基础上新增：

```sql
-- Agent 注册表（运行时动态，不持久化）
-- agents 内存中维护，不需要数据库表

-- 流水线状态追踪
CREATE TABLE IF NOT EXISTS pipeline_runs (
  id TEXT PRIMARY KEY,
  idea_id TEXT NOT NULL REFERENCES ideas(id),
  stage TEXT NOT NULL,           -- intent_analysis|code_review|doc_generation|implementation|publish
  agent_id TEXT,                 -- 执行的 agent
  status TEXT NOT NULL,          -- pending|running|completed|failed|gate_waiting|gate_approved|gate_rejected
  input_data TEXT,               -- JSON: 该阶段的输入
  output_data TEXT,              -- JSON: 该阶段的输出
  error TEXT,                    -- 错误信息
  started_at TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Gate 审核记录
CREATE TABLE IF NOT EXISTS gate_reviews (
  id TEXT PRIMARY KEY,
  pipeline_run_id TEXT NOT NULL REFERENCES pipeline_runs(id),
  gate_type TEXT NOT NULL,       -- doc_review | code_review
  reviewer TEXT,                 -- 审核人
  decision TEXT NOT NULL,        -- approved | rejected | edited
  comments TEXT,                 -- 审核意见
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 需求文档版本
CREATE TABLE IF NOT EXISTS requirement_docs (
  id TEXT PRIMARY KEY,
  idea_id TEXT NOT NULL REFERENCES ideas(id),
  version INTEGER NOT NULL DEFAULT 1,
  content TEXT NOT NULL,         -- Markdown 格式的需求文档
  generated_by TEXT,             -- agent_id
  reviewed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_pipeline_idea ON pipeline_runs(idea_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_stage ON pipeline_runs(stage, status);
CREATE INDEX IF NOT EXISTS idx_requirement_idea ON requirement_docs(idea_id);
```

---

## API 路由扩展

### Agent 管理

```
GET  /api/agents                # 列出检测到的 agents
POST /api/agents/:id/test       # 测试某个 agent 是否可用
```

### 流水线控制

```
POST /api/ideas/:id/pipeline/start     # 启动流水线
GET  /api/ideas/:id/pipeline           # 查看流水线状态
POST /api/ideas/:id/pipeline/advance   # 手动推进到下一阶段
POST /api/ideas/:id/pipeline/retry     # 重试失败的阶段
```

### Gate 审核

```
GET  /api/ideas/:id/gate               # 查看待审核内容
POST /api/ideas/:id/gate/approve       # 通过审核
POST /api/ideas/:id/gate/reject        # 驳回（附意见）
POST /api/ideas/:id/gate/edit          # 编辑后通过
```

### Skill 管理

```
GET  /api/skills                       # 列出可用 skills
GET  /api/skills/:name                 # 查看 skill 详情
```

---

## 前端扩展

### 流水线视图（替代现有的简单状态标签）

```
想法卡片现在显示：

┌──────────────────────────────────────────┐
│  1  支持暗色模式                          │
│      ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐          │
│      │✅│→│✅│→│🔒│→│⬜│→│⬜│          │
│      └──┘ └──┘ └──┘ └──┘ └──┘          │
│      意图  代码  文档  实现  发布          │
│      分析  审查  生成                     │
│                                          │
│      测试用户 · 2小时前 · 💬 1           │
└──────────────────────────────────────────┘

状态图标：✅ 完成 | ⏳ 进行中 | 🔒 等待审核 | ⬜ 未开始 | ❌ 失败
```

### Agent 选择器

在启动流水线时，让用户选择（或自动检测）用哪个 agent：

```
启动流水线
├── 意图分析：[Hermes v2.5 ▾]  ← 自动检测到 Hermes
├── 代码审查：[Cursor Agent ▾]  ← 自动检测到 Cursor
├── 需求生成：[Cursor Agent ▾]
├── 代码实现：[Codex CLI ▾]     ← 用户手动选了 Codex
└── 代码审核：[Copilot ▾]
```

### Skill 配置

管理后台新增 Skill 管理页：

```
可用 Skills
├── intent-analysis    ✅ 已启用
├── code-review        ✅ 已启用
├── doc-generation     ✅ 已启用
├── implementation     ✅ 已启用
└── custom-qa-check    ❌ 未启用（用户自定义 skill）
```

---

## 与 Open Design 的差异

| 维度 | Open Design | CoBuilder v2 |
|------|-------------|-------------|
| 产出物 | HTML 设计稿 | 需求文档 + 代码变更 |
| Agent 角色 | 设计执行 | 需求分析 + 代码实现 |
| Gate 数量 | 1（五维评审） | 2（文档审核 + 代码审核） |
| 持久化 | SQLite（.od/app.sqlite） | SQLite（data/cobuilder.db） |
| 用户角色 | 设计师 | 开发者 + 产品经理 |
| 通知机制 | 无 | 通知原始提交者（闭环） |

---

## 实施路线

### Phase 1：Agent 检测 + 调度（1-2天）
- [ ] PATH 扫描器，检测可用 CLI
- [ ] Agent 注册表 API
- [ ] 前端 Agent 选择器

### Phase 2：流水线引擎（2-3天）
- [ ] Pipeline 数据模型
- [ ] 流水线状态机（pending → running → completed/failed/gate）
- [ ] Skill 加载器
- [ ] Agent 调度器（根据 skill 要求选 agent）

### Phase 3：意图分析 + 代码审查（1-2天）
- [ ] intent-analysis skill
- [ ] code-review skill
- [ ] 对接 Hermes / Cursor API

### Phase 4：需求文档生成 + Gate 1（2-3天）
- [ ] doc-generation skill
- [ ] 需求文档编辑器（Markdown）
- [ ] Gate 审核 UI

### Phase 5：代码实现 + Gate 2（2-3天）
- [ ] implementation skill
- [ ] 代码 Diff 查看器
- [ ] Gate 代码审核 UI

### Phase 6：通知闭环 + 打磨（1天）
- [ ] 发布后通知原始提交者
- [ ] 流水线历史记录
- [ ] 整体 UI 打磨

**预估总工时：~10-15天**
