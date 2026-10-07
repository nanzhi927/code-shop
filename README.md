# 毕设源码售卖商城 (code-shop)

基于 Vue 3 + Node.js + MySQL 的毕业设计源码学习参考商城。

> **仅供学习交流，请遵守学术诚信，勿用于不当用途。**

| 入口 | 链接 |
|------|------|
| 在线商城 | http://62.234.122.127:8080 |
| Gitee | https://gitee.com/nanzhiyu/code-shop |
| GitHub | （创建后填入） |
| 多平台分发说明 | [docs/distribution.md](docs/distribution.md) |

## 技术栈

- 前端：Vue 3 + Vite + Pinia + Vue Router + Element Plus
- 后端：Node.js (Express) + MySQL 5.7
- 交付方式：手动发货（网盘链接）

## 快速启动

Windows **双击即可**：

| 文件 | 说明 |
|------|------|
| `启动.bat` | 生产启动（自动装依赖、开服务窗口） |
| `停止.bat` | 停止服务 |
| `开发启动.bat` | 本机开发（热更新） |

### 0. 前置
- 已装 Node.js 20+、MySQL 可连
- 复制 `server/.env.example` → `server/.env` 并改账号密码
- 首次初始化：
```bash
cd server
npm install
node src/init.js
```
默认管理员 `admin / admin123`（上线后请改密）。

- 生产前构建前端一次：
```bash
cd web
npm install
npm run build
```

### 1. 商品同步 / 封面（可选）
```bash
cd D:\code-shop
npm run scan
cd server
npm run sync
npm run covers
```

## 源码扫描

```bash
cd D:\code-shop
npm run scan          # 全量扫描 D:\从戎网站源码 + D:\整理代码 -> data/products.json
node scripts/scan-sources.js --limit 100   # 调试限制数量
```

## 账号

| 角色 | 账号 | 密码 |
|------|------|------|
| 管理员 | admin | admin123（默认超级管理员，可在后台新建 admin/ops 角色） |
| 普通用户 | 注册即可 | — |

## 功能清单

前台：
- 首页（分类入口 + 最新商品，Banner 文案后台可配）
- 公告（顶部轮播展示，后台可管理）
- 商品列表（关键词搜索、搜索拼音兜底 + 关键词高亮、技术栈筛选、排序、分页，筛选条件同步到 URL）
- 商品详情（材料标记、封面图、价格、加购/立即购买、收藏）
  - 自动生成的丰富详情：项目截图图册（可放大预览）、功能模块、技术特点、数据库表、项目简介、购买须知
  - 运行环境标签（Maven/Node/SpringBoot/MyBatis/Servlet/JSP）、质检状态徽标（已验证 ✅）、文件清单（论文/PPT/视频等材料包）、注意事项
- 购物车、结算（模拟在线支付 / 卡密支付，支持优惠券抵扣）
- 领券中心（浏览可领优惠券、一键领取）
- 我的订单（查看发货信息、确认收货、取消、申请售后退款，支持状态筛选与分页）
  - 已支付待发货：展示"加客服 QQ 发送订单号"发货指引 + 一键复制订单号
  - 支付流水记录（查看订单支付渠道与交易号）
- 我的卡密（查看卡密使用记录 + 客服购买入口）
- 我的收藏
- 登录/注册（含登录限流防暴力破解）
- 移动端适配（响应式布局，手机端友好）
- SEO（动态 meta 标签、sitemap.xml、robots.txt）

后台（`/admin`）：
- 数据概览（商品/订单/用户/销售额统计）
- 商品管理（编辑、上下架、软删除、新建、封面图上传、批量上架/下架/标记已验证、分类与质检字段）
- 质检中心（按运行状态筛选、标记已验证/有问题、行内备注编辑、批量质检、上架）
- 订单管理（手动发货（QQ/微信/网盘）、修改发货信息、发货记录、CSV 导出）
- 优惠券管理（后台生成/编辑优惠券、库存与领取统计）
- 公告管理（发布/编辑/启用停用公告）
- 售后退款（审核用户退款申请、同意/拒绝/确认退款）
- 卡密管理（批量生成、状态跟踪、CSV 导出）
- 用户管理（搜索、重置密码、禁用/启用）
- 系统设置（客服 QQ/微信、客服说明、发货说明、首页 Banner 文案）

安全与工程：
- 数据库密码 / JWT 密钥等敏感配置统一在 `server/.env`
- 登录注册接口限流、全站基础限流
- 商品删除为软删除（保留历史订单数据，可恢复）
- `/api` 未匹配路径统一返回 JSON 404
- 管理员操作日志（admin_logs）
- 商品运行状态（run_status：未验证/已验证可运行/有问题/停止出售）与质检备注（qa_note），新扫描商品默认未验证且不上架，质检通过后手动上架
- 站内消息通知（订单/定制/退款动态 + 前台消息中心）
- 多管理员角色 superadmin/admin/ops（后台管理员管理）
- 后台批量发货
- 定制报价模板
- 无结果搜索词一键转定制需求单
- 卡密退款自动恢复
- 优惠券适用范围（技术栈/分类）
- 支付渠道 Provider 化（易支付预留）
- ESLint/Prettier 配置（先报错不强制）
- 慢查询日志开关

## 部署与运维

一键启停、更新、备份详见 [docs/deploy.md](docs/deploy.md)。

数据库备份命令：

```bash
cd server && npm run backup
```

## 商品资产流水线（v2 归并版）

扫描脚本已升级为**归并模式**（`D:\code-shop\scripts\scan-sources.js`）：

1. **同目录归并**：同一项目目录下的多个压缩包（源码/论文/LW PPT/副本）合并为一个商品 + `product_files` 材料清单（源码/论文/PPT/视频/截图/数据库/其他）。
2. **跨目录去重**：同编号（springbootXXX）且标题高度相似的项目只保留一条，其余并入材料清单。
3. **标题清洗**：自动去除噪音标注（111111/待做/pf/LW PPT/副本/(1)(2) 等），注意事项提取到 `qa_note`。
4. **业务分类**：按标题关键词自动归类（商城购物/校园教育/医疗健康/娱乐影音/…）。
5. **运行环境标记**：探测 pom.xml / package.json / application.yml / sql / vue 等，写入 `run_env`。

新增源码入库流程：
```bash
cd D:\code-shop
npm run scan              # 重新扫描 -> data/products.json（归并+清洗+分类）
cd D:\code-shop\server
node scripts/sync-products.js --disable-missing   # 增量同步（新商品默认未上架）
# 后台「质检中心」验证通过后手动上架
```

## 目录结构

```
code-shop/
├── scripts/scan-sources.js   # 源码扫描脚本
├── data/products.json        # 扫描产物（商品目录）
├── server/                   # Express 后端
│   ├── scripts/
│   │   ├── regression-test.js    # 回归测试
│   │   └── sync-products.js      # 商品增量同步 + 详情自动生成
│   ├── .env.example          # 环境变量模板（数据库/JWT 等）
│   └── src/
│       ├── index.js          # 入口（含限流、生产模式静态托管）
│       ├── init.js           # 建库+导入+幂等迁移
│       ├── db.js             # MySQL 连接池
│       ├── gen-covers.js     # 商品封面生成
│       ├── lib/probe.js      # 源码探测（截图/功能模块/技术点/数据表/简介）
│       ├── middleware/       # auth / rateLimit
│       └── routes/           # auth/products/orders/cards/admin/settings/favorites
└── web/                      # Vue3 前端
    └── src/
        ├── components/       # ProductCover 封面组件
        ├── layouts/          # StoreLayout / AdminLayout
        ├── views/store/      # 前台页面（含 MyFavorites 收藏）
        ├── views/admin/      # 后台页面（含 UserManage / Settings）
        ├── stores/           # user / cart
        ├── utils/            # techColors / orderStatus
        └── api/              # axios 封装
```
