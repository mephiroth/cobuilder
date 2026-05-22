# CoBuilder

> AI-Native 需求管理平台 —— 用户提交模糊需求，AI 自动分析并生成可指导开发的结构化文档。

## 核心功能

- **需求收集** — 用户提交想法，支持投票、评论、截图
- **AI 意图分析** — 自动分类（bug/feature/improvement）、定级（P0-P3）、定位影响范围
- **需求文档生成** — AI 读取项目源码，生成结构化 PRD（背景/方案/复杂度/测试要点）
- **Gate 审核** — 人工审核需求文档（通过/编辑后通过/驳回）
- **Agent 容器** — 检测 PATH 上的 CLI Agent（Hermes、Cursor、Codex、Gemini 等），按需调度
- **反馈闭环** — 需求实现后自动通知原始提交者

## 技术栈

| 层 | 技术 |
|---|---|
| Frontend | Next.js 16 (App Router) + Tailwind CSS v4 |
| Database | node:sqlite (Node.js 内置，零依赖) |
| AI | 小米 mimo API (OpenAI 兼容格式) |
| Agent | PATH 扫描 + CLI 调度 (Hermes/Cursor/Codex/Gemini) |

## 快速开始

```bash
# 安装依赖
npm install

# 配置环境变量
cp .env.example .env.local
# 编辑 .env.local，填入 MIMO_API_KEY 和 ADMIN_TOKEN

# 启动开发服务器
npm run dev

# 访问
# 首页: http://localhost:3000
# 管理后台: http://localhost:3000/admin
```

## 环境变量

```env
MIMO_API_KEY=your-mimo-api-key        # 小米 mimo API key
ADMIN_TOKEN=your-admin-token           # 管理员认证 token
CODEBASE_DIR=/path/to/your/project     # AI 澄清时读取的代码目录
```

## 项目结构

```
cobuilder/
├── src/
│   ├── app/                    # Next.js App Router 页面
│   │   ├── page.tsx            # 首页（许愿池列表）
│   │   ├── ideas/[id]/         # 想法详情
│   │   ├── submit/             # 提交想法
│   │   ├── admin/              # 管理后台
│   │   └── api/                # API 路由
│   │       ├── projects/       # 项目 CRUD
│   │       ├── ideas/          # 想法 CRUD + 投票 + 评论
│   │       ├── pipeline/       # 流水线引擎
│   │       ├── agents/         # Agent 检测
│   │       └── skills/         # Skill 列表
│   ├── components/             # React 组件
│   └── lib/
│       ├── db/                 # SQLite 数据层
│       ├── ai/                 # AI 集成（mimo API）
│       ├── agents/             # Agent 检测 + 调度
│       └── auth.ts             # Token 认证
├── data/                       # SQLite 数据库
└── .env.local                  # 环境变量
```

## 工作流

```
用户提交需求
    ↓
[Stage 1] AI 意图分析 (mimo)
    ↓ 分类 + 优先级 + 影响范围
[Stage 2] 需求文档生成 (mimo)
    ↓ 结构化 PRD
🔒 Gate 1: 人工审核
    ↓ 通过 / 编辑 / 驳回
发布 + 通知提交者
```

## Agent 支持

CoBuilder 自动检测 PATH 上的 CLI Agent：

| Agent | 能力 | 状态 |
|-------|------|------|
| Hermes Agent | llm_chat, code_read, code_write, code_review | ✅ |
| Cursor Agent | code_read, code_write, code_review | 需安装 |
| Codex CLI | code_read, code_write | ✅ |
| Gemini CLI | code_read, code_write | ✅ |
| GitHub Copilot | code_read, code_write, code_review | 需安装 |

## License

MIT
