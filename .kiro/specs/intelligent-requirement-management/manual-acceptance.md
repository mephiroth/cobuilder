# 手动验收清单（UAT）

## 1. Instrumentation / Worker 启动

| 步骤 | 操作 | 通过判定 |
|------|------|----------|
| 1.1 | `npm run build && npm start` | 进程正常启动，无 instrumentation 报错 |
| 1.2 | 提交一条 `submitted` 需求并搁置在 Gate 1 超过 1h（或改 DB `updated_at` 模拟） | `gate_overdue_reminders` 有记录，admin 收到提醒通知 |

## 2. Gate 1 / 2 / 3 UI 走查

| Gate | 路径 | 通过判定 |
|------|------|----------|
| Gate 1 | Admin 详情 → 待审 PRD → 通过 / 编辑后通过 / 驳回 / 搁置 | 状态与 `audit_logs` 一致 |
| Gate 2 | `enable_design_stage=1` 项目 → 待审设计 → 五种决策各测一次 | 状态按 design 转移表变化 |
| Gate 3 | 待合入 → 查看 Diff → 合入 | 文件写入 `codebase_dir`，状态 `done` |

## 3. SSE 实时日志

| 步骤 | 通过判定 |
|------|----------|
| 需求进入 `dev_pending`，打开 Admin 详情 | 终端区域 ≤2s 内出现 `[fallback]` 或 agent 日志 |
| 保持页面 20s | 连接未断开（heartbeat 每 15s） |

## 4. 通知中心

| 步骤 | 通过判定 |
|------|----------|
| 前台用户 `client_id` 收到状态通知 | 未读列表可见 |
| 标记已读 | `read=1`，刷新后不在 unread 列表 |

## 5. 自动化测试（发布前）

```bash
npm test
npm run build
```

全部通过方可发布。
