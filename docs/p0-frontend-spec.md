# P0 前端改造规格（子代理实施指南）

项目：D:\code-shop\web（Vue 3 + Vite + Pinia + Element Plus）
请先阅读现有文件了解代码风格，再按下述规格实施。**不要修改后端**。所有 API 已由后端实现，直接按规格对接。

## 一、通用定义

运行状态 run_status 映射（多处复用，建议在 `web/src/utils/` 下新增 `runStatus.js`）：
```js
export const RUN_STATUS = {
  0: { label: '未验证', type: 'info' },
  1: { label: '已验证可运行', type: 'success' },
  2: { label: '有问题', type: 'warning' },
  3: { label: '停止出售', type: 'danger' }
};
```
文件材料类型 kind 映射（新增 `fileKind.js` 或并入上面）：
```js
export const FILE_KIND = {
  source: '源码', paper: '论文/文档', ppt: 'PPT',
  video: '演示视频', screenshot: '截图', db: '数据库脚本', other: '其他材料'
};
```

## 二、前台改造

### 1. `src/views/store/ProductDetail.vue`
- 头部信息区：标题旁加 `category` 标签（el-tag, 浅色）+ run_status 徽标（el-tag，颜色按 RUN_STATUS.type，文案按 label）。
- 详情 tab 增加「运行环境」区块：后端返回 `runEnv`（对象，如 `{maven:true, node:true, springBoot:true, sql:true, vue:true, servlet:true, mybatis:true, jsp:true}`），渲染存在的项为 el-tag（映射：maven→Maven, node→Node/npm, springBoot→Spring Boot, sql→数据库脚本, vue→Vue, servlet→Servlet/JSP, mybatis→MyBatis, jsp→JSP）。
- 新增「文件清单」区块（放在截图图册下方或单独 Tab）：遍历 `files`（`[{id, kind, name, size_mb, ext}]`），每行显示 材料类型标签(FILE_KIND[kind]) + 文件名 + 大小(MB)，无文件则隐藏该区块。
- `qa_note` 非空时，在商品简介下方显示 el-alert（type=warning，标题"注意事项"，内容 qa_note）。

### 2. `src/views/store/ProductList.vue`
- 商品卡片（复用 ProductCover 组件处）增加：run_status===1 时显示绿色小徽标"已验证"（角标或标题旁）；卡片底部可选显示 销量（`sales`）。
- 列表接口返回新增字段 `category, run_status, sales, views`，卡片可直接使用。

### 3. `src/views/store/MyOrders.vue`
- 订单状态 `paid`（已支付待发货）时，订单卡显示醒目 el-alert（type=warning）：
  「请添加客服 QQ **{shipSettings.service_qq}**（微信：{shipSettings.service_wechat}），发送订单号 **{order.order_no}** 获取源码。发货说明：{shipSettings.ship_notice}」
  - 提供「复制订单号」按钮（navigator.clipboard + ElMessage.success('订单号已复制')）。
- 状态 `shipped` 时展示发货信息 `shipping_info` 与 `delivery.content`（如有）。
- 列表接口整体返回 `shipSettings`（在响应顶层），订单项带 `delivery`（最近发货记录，含 content/created_at/method）——直接使用。

### 4. `src/views/store/Checkout.vue`
- 支付成功后（现有跳转逻辑前），用支付接口返回的 `message` 与 `shipSettings` 弹 ElMessageBox/ElNotification 提示：
  「支付成功！请添加客服 QQ：{service_qq}，发送订单号获取源码（手动发货）」。保留现有跳转。

## 三、后台改造

### 5. `src/views/admin/ProductManage.vue`
- 列表表格增加列：分类(category)、质检状态(run_status → RUN_STATUS 标签)、质检备注(qa_note，超长省略)。
- 编辑对话框（新建/编辑共用）增加字段：
  - 分类 category（el-input 或下拉，可自由输入）
  - 质检状态 run_status（el-select：0 未验证 / 1 已验证可运行 / 2 有问题 / 3 停止出售）
  - 质检备注 qa_note（el-input type=textarea）
  - 提交时随 PUT /api/admin/products/:id 或 POST /api/admin/products 一起发送。
- 列表增加「批量操作」：表格多选（el-table 的 selection 列）+ 顶部按钮「批量上架」「批量下架」「批量标记已验证」→ 调 POST /api/admin/products/batch `{ids, action:'onsale'|'offsale'|'qa', run_status:1}`，成功后刷新。

### 6. 新增 `src/views/admin/QaCenter.vue`（质检中心）
页面结构：
1. 顶部统计卡片（el-row/el-col，复用 Dashboard 风格）：从 GET /api/admin/stats/qa 取数：
   - 商品总数 total；byStatus 数组按 run_status 渲染 未验证/已验证/有问题/停止出售 各卡片（显示 cnt，on_sale 可显示"在售 x"）。
2. 筛选栏：run_status 下拉（全部/0-3）+ 关键词输入 + 查询按钮。
3. 表格：GET /api/admin/qa/products?run_status=&keyword=&page=&pageSize=
   列：ID、标题（超长省略+title 提示）、技术栈、类型、大小、价格、在售状态(status)、质检状态（el-tag）、质检备注（可编辑：el-input 或点击弹出输入）、文件数(file_count)、验证时间、操作列。
4. 操作列按钮：
   - 「通过」→ POST /api/admin/products/:id/qa `{run_status:1, qa_note: 当前备注}`
   - 「有问题」→ POST .../qa `{run_status:2, qa_note: 当前备注}`
   - 「上架/下架」→ POST /api/admin/products/:id/toggle
   - 备注编辑：行内小输入框 + 保存按钮（或点击备注弹出 el-input 确认后调 /qa 保存 qa_note，run_status 保持不变——注意 /qa 接口会同时写 run_status，所以把当前 run_status 一并提交）。
5. 批量：多选 + 「批量通过」「批量上架」→ POST /api/admin/products/batch。
6. 分页：el-pagination（page-size 20）。

### 7. `src/router/index.js` + `src/layouts/AdminLayout.vue`
- 新增路由 `/admin/qa` → QaCenter.vue（懒加载，与其他后台路由一致，meta 需登录+管理员，参照现有后台路由写法）。
- AdminLayout 菜单在「商品管理」旁增加「质检中心」入口（el-menu-item index="/admin/qa"，icon 可复用现有图标，如 CircleCheck）。

### 8. `src/views/admin/OrderManage.vue`
- 发货对话框（现有 POST /api/admin/orders/:id/ship）增加「发货方式」下拉：QQ / 微信 / 网盘 / 其他（值为 qq/wechat/pan/other，随请求发送 method）。
- 订单详情抽屉（如已有）显示发货记录 deliveries（内容+时间）；如无抽屉可跳过此条。

## 四、验证要求
- 完成后运行 `cd D:\code-shop\web && npm run build` 确认无编译错误。
- 不要修改后端文件；不要运行 dev server。
- 如发现规格与现有代码结构冲突，以最小改动达成规格为准，并在最终报告中说明。
