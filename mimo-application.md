# CoBuilder — AI-Native 需求管理平台

> MiMo Token 申请 · 项目描述

---

## 项目核心痛点

独立开发者和小团队在处理用户反馈时面临三个结构性瓶颈：

1. **反馈碎片化** — 用户意见散落在微信群、Telegram、邮件、GitHub Issue 等多个渠道，没有统一入口，开发者无法系统性追踪和响应。
2. **需求模糊化** — 用户提交的反馈大多是"希望支持 XX""某个功能不太好用"这类模糊描述，开发者需要花大量时间理解意图、定位代码、撰写需求文档，单条需求的澄清成本约 30 分钟。
3. **反馈无闭环** — 开发者处理了需求但无法通知原始提交者，用户感受是"提了石沉大海"，导致后续参与意愿下降。

**CoBuilder 的目标：** 构建一个 AI-Native 的需求管理平台，将"用户反馈 → 需求分析 → 代码变更"这条链路自动化，开发者只需在关键节点做人工审核。

---

## 核心逻辑流

### 1. 多 Agent 协作流水线

CoBuilder 是一个 **Agent 容器**，不自己跑模型，而是检测本地 PATH 上已安装的 CLI Agent（Hermes、Cursor、Codex、Gemini CLI 等），根据任务阶段动态调度最合适的 Agent：

```
用户提交需求
    ↓
[Stage 1] 意图分析 ← Hermes Agent (LLM 对话能力)
    · 自动分类：bug / feature / improvement
    · 自动定级：P0(紧急) / P1(重要) / P2(一般) / P3(低优)
    · 自动定位：影响哪个模块
    ↓
[Stage 2] 需求文档生成 ← Claude Code / Cursor (代码理解能力)
    · 读取项目源码，定位受影响的文件和函数
    · 分析根因（如果是 bug）或设计技术方案（如果是 feature）
    · 生成结构化 PRD：背景分析 / 问题定位 / 可行方案 / 实现复杂度 / 测试要点
    ↓
🔒 Gate 1: 人工审核需求文档
    · 通过 → 进入实现阶段
    · 编辑后通过 → 修改文档后继续
    · 驳回 → 回到 Stage 2 重新生成
    ↓
[Stage 3] 代码实现 ← Cursor Agent / Codex CLI
    · Agent 根据需求文档修改代码
    · 生成 diff，等待人工审核
    ↓
🔒 Gate 2: 人工审核代码变更
    ↓
发布 + 通知原始提交者
```

### 2. Agent 调度机制

系统启动时自动扫描 PATH，检测可用的 Agent 并建立能力标签注册表：

| Agent | 能力标签 | 适用阶段 |
|-------|---------|---------|
| Hermes Agent | llm_chat, code_read, code_write, code_review | 意图分析、通用任务 |
| Cursor Agent | code_read, code_write, code_review | 代码审查、需求文档、实现 |
| Codex CLI | code_read, code_write | 代码实现 |
| Gemini CLI | code_read, code_write | 代码实现 |

调度策略：用户指定 > 能力标签匹配 > 自动回退。每个 Agent 阶段的产出是下一个阶段的输入，Gate 是硬门禁，AI 不可跳过。

### 3. 长链推理

- **意图分析**：理解用户模糊描述 → 结合项目上下文 → 输出结构化分类（3-5 步推理）
- **需求文档生成**：读取项目源码 → 定位相关文件 → 分析代码逻辑 → 判断 bug/feature → 生成完整 PRD（5-8 步推理）
- **代码实现**：理解需求文档 → 定位修改位置 → 编写代码 → 确保不引入新问题（4-6 步推理）

整条链路从用户提交到代码变更，涉及 **12-19 步推理**，跨越多个 Agent 的协作。

### 4. 安全机制

- **Gate 机制**：两个强制人工审核点，AI 不可跳过
- **Prompt 注入防护**：用户内容用结构化标签包裹，LLM 被指示将内容视为数据而非指令
- **字段白名单**：数据库操作使用字段白名单防止 SQL 注入
- **时序安全认证**：Token 比较使用 crypto.timingSafeEqual 防止时序攻击

---

## 精简版（表单填写用）

**项目名称：** CoBuilder — AI-Native 需求管理平台

**核心痛点：** 独立开发者处理用户反馈时，反馈碎片化（散落多渠道）、需求模糊化（单条澄清需 30 分钟）、反馈无闭环（用户提了没回应）。CoBuilder 将"用户反馈 → 需求分析 → 代码变更"全链路自动化，开发者只需在关键节点做人工审核。

**核心逻辑流：** 多 Agent 协作流水线。系统检测本地已安装的 CLI Agent（Hermes/Cursor/Codex/Gemini），根据任务阶段动态调度：Hermes 做意图分析（分类/定级/定位）→ Claude Code 读源码生成结构化 PRD → 人工 Gate 审核 → Cursor/Codex 实现代码变更 → 人工 Gate 审核 → 发布通知。整条链路跨越 3 个 Agent、12-19 步推理、2 个强制人工审核点。技术栈：Next.js 16 + node:sqlite + 小米 mimo API + Agent CLI 调度器。

**使用模型：** 小米 mimo-v2.5-pro（意图分析 + 需求文档生成 + 内容审核）

**项目地址：** https://github.com/mephiroth/cobuilder
