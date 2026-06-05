# 需求文档

## 简介

CoBuilder 当前支持多项目管理，但在创建需求时，项目绑定是可选的——系统会在用户未选择项目时自动回退到默认项目。这种隐式绑定导致需求归属不清晰，尤其在多项目场景下容易产生混乱。

本功能要求**创建需求时必须显式绑定项目**：无论是用户通过提交页面提交，还是管理员在后台新建，都必须明确选择一个项目，系统不再做静默的默认项目回退。

**影响范围：**
- 用户提交页面（`/submit`）：当只有一个可用项目时，自动预选但仍需展示；当有多个项目时，必须手动选择。
- 管理员后台新建需求弹窗（`/admin`）：无论项目数量，始终展示项目选择器，且为必填。
- 后端 API（`POST /api/ideas` 和 `POST /api/admin/ideas`）：`project_id` 字段变为必填，移除默认项目回退逻辑。

---

## 词汇表

- **Project**：平台内的一个产品项目，拥有独立的需求池和代码库路径，对应数据库 `projects` 表。
- **Idea**：用户提交的一条需求，必须归属于某个 Project，对应数据库 `ideas` 表。
- **Active_Project**：`archived = 0` 的项目，即当前可接收新需求的项目。
- **Submit_Page**：用户提交需求的前端页面（`/submit`）。
- **Admin_Dashboard**：管理员后台首页（`/admin`），包含新建需求弹窗。
- **Project_Selector**：供用户或管理员选择目标项目的下拉控件。
- **Default_Fallback**：当前系统在 `project_id` 缺失时自动选择第一个未归档项目的逻辑，本功能将移除此逻辑。

---

## 需求

### 需求 1：后端强制要求 project_id

**用户故事：** 作为平台，我需要确保每条需求在创建时都明确关联到一个项目，以便需求数据的归属始终清晰可追溯。

#### 验收标准

1. WHEN `POST /api/ideas` 请求体中未包含 `project_id` 字段或 `project_id` 为空字符串，THE API SHALL 拒绝请求并返回 HTTP 400，响应体为 `{ "error": "project_id 为必填项" }`。
2. WHEN `POST /api/admin/ideas` 请求体中未包含 `project_id` 字段或 `project_id` 为空字符串，THE API SHALL 拒绝请求并返回 HTTP 400，响应体为 `{ "error": "project_id 为必填项" }`。
3. THE API SHALL 移除 `POST /api/ideas` 中的 Default_Fallback 逻辑（即不再调用 `getDefaultActiveProject()` 作为回退）。
4. THE API SHALL 移除 `POST /api/admin/ideas` 中的 Default_Fallback 逻辑（即不再在 `project_id` 缺失时自动取 `projects[0]`）。
5. WHEN `POST /api/ideas` 提供的 `project_id` 对应的 Project 不存在，THE API SHALL 返回 HTTP 404，响应体为 `{ "error": "项目不存在" }`。
6. WHEN `POST /api/ideas` 提供的 `project_id` 对应的 Project 的 `archived = 1`，THE API SHALL 返回 HTTP 400，响应体为 `{ "error": "项目已归档" }`。
7. IF `project_id` 有效且 Project 处于活跃状态，THEN THE API SHALL 按现有逻辑继续创建 Idea，行为不变。

---

### 需求 2：用户提交页面强制选择项目

**用户故事：** 作为用户，我希望在提交需求时清楚地知道我的需求归属于哪个项目，以便我能做出正确的选择。

#### 验收标准

1. THE Submit_Page SHALL 始终展示 Project_Selector，无论 Active_Project 数量为多少（包括只有 1 个项目的情况）。
2. WHEN Submit_Page 加载且只有 1 个 Active_Project，THE Submit_Page SHALL 自动预选该项目，但 Project_Selector 仍然可见，用户可以看到当前选中的项目名称。
3. WHEN Submit_Page 加载且有多个 Active_Project，THE Submit_Page SHALL 不预选任何项目，Project_Selector 显示占位文字"请选择项目..."。
4. WHILE `project_id` 未选择，THE Submit_Page SHALL 禁用提交按钮（`disabled` 状态），防止用户提交未绑定项目的需求。
5. WHEN Submit_Page 加载且没有任何 Active_Project（`GET /api/projects` 返回空数组），THE Submit_Page SHALL 隐藏表单，展示提示信息"暂无可用项目，请联系管理员"，并禁用提交操作。
6. IF `GET /api/projects` 请求失败，THEN THE Submit_Page SHALL 展示错误提示"加载项目列表失败，请刷新重试"，并禁用提交操作。

---

### 需求 3：管理员后台新建需求弹窗强制选择项目

**用户故事：** 作为管理员，我希望在后台新建需求时始终能明确指定项目，以便需求管理更加规范。

#### 验收标准

1. THE Admin_Dashboard 新建需求弹窗 SHALL 始终展示 Project_Selector，无论 Active_Project 数量为多少（移除当前仅在 `projects.length > 1` 时才显示选择器的条件判断）。
2. WHEN 新建需求弹窗打开且只有 1 个 Active_Project，THE Admin_Dashboard SHALL 自动预选该项目，Project_Selector 仍然可见。
3. WHEN 新建需求弹窗打开且有多个 Active_Project，THE Admin_Dashboard SHALL 不预选任何项目，Project_Selector 显示占位文字"请选择项目..."。
4. WHILE `project_id` 未选择，THE Admin_Dashboard SHALL 禁用"创建需求"提交按钮。
5. WHEN 新建需求弹窗打开且没有任何 Active_Project，THE Admin_Dashboard SHALL 在弹窗内展示提示"暂无可用项目，请先在项目设置中创建项目"，并禁用提交按钮。
6. THE Admin_Dashboard 新建需求弹窗 SHALL 在 Project_Selector 标签旁展示必填标记（`*`），与标题、描述字段保持一致的视觉风格。

---

### 需求 4：项目列表 API 支持管理员获取完整列表

**用户故事：** 作为管理员，我希望在新建需求弹窗中能看到所有未归档项目，以便选择正确的归属项目。

#### 验收标准

1. THE Platform SHALL 确保 `GET /api/projects` 返回所有 `archived = 0` 的 Project，按 `created_at ASC` 排序，供前端 Project_Selector 使用。
2. WHEN `GET /api/projects` 返回的项目列表为空，THE Platform SHALL 返回 HTTP 200 和空数组 `[]`，不返回错误状态码。
3. THE Platform SHALL 确保 `GET /api/projects` 的响应中每个项目至少包含 `id`、`name`、`description` 字段，供前端展示项目名称和描述。

