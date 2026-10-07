# code-shop 毕设源码售卖商城 · 完善设计方案

> 版本：v1.0 ｜ 日期：2026-08-17 ｜ 状态：待评审
> 目标对齐用户诉求：**① 所有代码全量上线 ② 持续扩充新增 ③ 支持定制服务 ④ 搜索做到很好**

---

## 一、现状诊断（基于代码审计）

### 1.1 项目概览

| 维度 | 现状 |
|---|---|
| 技术栈 | Vue 3 + Vite + Pinia + Element Plus ｜ Node.js (Express) + MySQL 5.7.17（已启用 ngram_token_size=2） |
| 商品规模 | 1528 条（文件夹型 526 / 压缩包型 1002），技术栈：SpringBoot 1338、SSM 127、JSP+Servlet 63 |
| 功能闭环 | 前台 9 页 + 后台 6 页全部可用；登录/购物车/订单/卡密/收藏/后台管理均已实现 |
| 交付方式 | 纯手动（管理员在订单里填发货信息） |
| 支付 | 模拟支付 + 卡密支付（无真实收款） |
| 搜索 | `title/keywords LIKE '%kw%'`，无分词/权重/联想/高亮/聚合 |

### 1.2 核心问题清单

| # | 问题 | 影响 | 严重度 |
|---|---|---|---|
| 1 | **商品目录混乱**：同一项目目录下多个 zip（源码/论文/LW PPT/(1)(2)副本）被拆成多个商品；1315 唯一标题 vs 1528 商品 | 重复铺货、买家困惑、后台难管理 | 🔴 高 |
| 2 | **标题噪音**："111111"、"待做"、"pf"、"LW PPT"、"数据库导入失败"、"启动页空白"、"账号密码不知道" 等标注混入标题 | 搜索结果质量差、专业感缺失 | 🔴 高 |
| 3 | **无运行信息**：不标注 JDK/MySQL/Node 版本、端口、运行状态（已验证/有问题） | 买家购买后跑不起来→差评退货 | 🔴 高 |
| 4 | **搜索太弱**：LIKE 全表扫描、无权重排序、无联想、无高亮、无价格/材料组合筛选、无搜索统计 | 核心短板，用户明确要求 | 🔴 高 |
| 5 | **无定制服务**：没有任何需求提交/报价/沟通/交付流程 | 丢失高客单业务 | 🔴 高 |
| 6 | **交易不闭环**：模拟支付、手动发货、无退款/售后、下单非幂等、购物车价格快照过期 | 无法真实商业化 | 🟠 中 |
| 7 | **无运营能力**：无评价、无公告、无在线客服（仅静态 QQ/微信）、无优惠券、后台无批量操作/无图表/无操作日志 | 运营效率低 | 🟠 中 |
| 8 | **工程化弱**：无日志、500 回显 err.message、无缓存、`bcrypt.hashSync` 阻塞事件循环、无部署方案、无备份、无 ESLint/测试 | 上线风险高 | 🟠 中 |
| 9 | **前端体验**：无移动端适配（导航挤压/表格溢出）、无 SEO（纯 SPA 无动态 meta）、无 404 页、Element Plus 全量引入 | 转化率受限 | 🟡 低 |
| 10 | **已发现 Bug**：401 重复弹窗、路由守卫不校验 token 有效性、`onSearch` 与 watch 可能双请求、购物车不校验下架/改价 | 体验与安全 | 🟡 低 |

### 1.3 可复用资产（设计时优先复用）

- `middleware/rateLimit.js`、`middleware/auth.js`（JWT + adminRequired）
- `lib/probe.js` 的压缩包解码（bsdtar 列条目+按需解压）、文件名词典翻译引擎
- `scripts/scan-sources.js` → `sync-products.js` 的增量同步骨架（按 source_path 匹配、不覆盖手动价）
- `gen-covers.js` 封面评分挑选、CSV 导出工具函数

---

## 二、总体目标与设计原则

### 2.1 四个目标

1. **全量上线**：每个项目 = 1 个商品（文件聚合），字段完备（运行环境/材料/截图/质检状态），1528+ 全部可上架、可搜索、可购买、可交付。
2. **持续扩充**：新源码丢进扫描目录 → 一键扫描/归并/质检/上架，全流程工具化。
3. **定制服务**：需求提交 → 报价 → 定金 → 开发 → 交付 → 验收 的完整定制开发订单闭环。
4. **强搜索**：中文分词全文检索 + 加权排序 + 联想 + 高亮 + 组合筛选 + 搜索统计。

### 2.2 设计原则

- **不重写、只增强**：在现有 Express + Vue3 架构上演进，保持 API 兼容，数据迁移幂等。
- **数据资产优先**：先解决商品数据质量（去重/清洗/补全），一切功能才有意义。
- **可插拔**：支付（mock → 易支付 → 官方）、搜索（MySQL 全文 → 预留 Elasticsearch 接口）、存储（网盘/本地/OSS）均抽象成 Provider。
- **成本可控**：当前 1.5k 商品量级，MySQL ngram 全文索引足够支撑（无需上 ES）；Redis 可后置。
- **渐进交付**：按 P0→P4 分阶段，每阶段可独立上线验收。

---

## 三、总体架构（演进后）

```
┌───────────────────────────── 浏览器 ─────────────────────────────┐
│  Vue3 SPA（现有）+ vue-meta 动态 SEO + 预渲染关键页 + 移动端响应式  │
└──────────────────────────────┬──────────────────────────────────┘
                               │ /api
┌──────────────────────────────▼──────────────────────────────────┐
│  Express 后端（现有目录结构，新增模块）                             │
│  routes/ : products / search / custom / pay / delivery / ...     │
│  services/: searchService(Provider) payProvider deliveryProvider │
│  jobs/   : scanJob enrichJob qaJob backupJob                     │
└───────────────┬────────────────────────────────┬────────────────┘
        MySQL 5.7（ngram FULLTEXT）        Redis（可选：缓存/热门词/限流）
                │
    mysqldump 每日备份  +  商品文件存储（本地 server/uploads / 网盘链接 / 未来 OSS）
```

> 部署目标形态：本机开发（现有方式）+ Docker Compose（app/mysql/redis/nginx）一键生产部署。

---

## 四、数据模型演进

### 4.1 products 表改造（沿用 ensureColumn 幂等迁移）

| 新字段 | 类型 | 说明 |
|---|---|---|
| `kind` | ENUM('code','custom','document') | 商品类型：源码 / 定制服务 / 资料文档，默认 code |
| `category` | VARCHAR(32) | 业务分类（校园/商城/政务/医疗/教育…），自动归因 |
| `run_status` | TINYINT | 0 未验证 / 1 已验证可运行 / 2 有问题 / 3 停止出售 |
| `run_env` | VARCHAR(500) | JSON：{jdk, mysql, node, redis, port, 备注} |
| `demo_url` / `video_url` | VARCHAR(500) | 在线演示链接 / 演示视频链接 |
| `sales` / `views` | INT | 销量 / 浏览量（排序与榜单用） |
| `sort_weight` | INT | 人工置顶权重 |
| `qa_note` | VARCHAR(1000) | 质检备注（如：数据库账号密码、常见报错） |
| `verified_at` | DATETIME | 最近验证时间 |

### 4.2 新增表（全部纳入 init.js 幂等建表）

| 表 | 用途 | 关键字段 |
|---|---|---|
| `product_files` | 一个商品多个文件（源码/论文/PPT/sql/截图/视频） | product_id, kind, name, path, size_mb, ext, sort |
| `delivery_logs` | 自动/手动发货记录 | order_id, method, link, code, expire_at, operator |
| `custom_orders` | 定制需求单 | user_id, title, tech, description, budget_min/max, deadline, status(状态机), deposit/total, deliver_note |
| `custom_messages` | 需求单内沟通留言 | custom_order_id, user_id, role, content, attachment |
| `pay_records` | 支付流水（对账/回调验签） | order_id, channel, trade_no, amount, status, raw_callback |
| `refunds` | 售后/退款单 | order_id, user_id, reason, amount, status |
| `reviews` | 订单评价 | order_id, user_id, product_id, rating, content |
| `coupons` / `user_coupons` | 优惠券 | code, type(满减/折扣), amount, threshold, expire |
| `notices` | 站内公告 | title, content, enabled |
| `search_logs` | 搜索日志 | user_id, keyword, result_count, created_at |
| `hot_words` | 热门词（后台可配置+自动统计） | word, weight, type(auto/manual) |
| `admin_logs` | 管理员操作审计 | admin_id, action, target, detail, ip |
| `attachments` | 通用附件（需求单/售后/沟通） | biz_type, biz_id, name, path |

---

## 五、分阶段详细设计

---

### 阶段 1（P0）：商品资产体系 —— "所有代码跑上去"

**目标**：一个项目 = 一个商品；字段完备；可运行状态可追踪；交付自动化；新增一键入库。

#### 1.1 扫描/归并流水线升级（scan → merge → enrich → qa）

1. **归并（merge）**：新增 `scripts/merge-products.js`
   - 以"项目目录"为聚合单元，把同目录下的 源码zip / 论文zip / LW PPT / (1)(2)副本 归并为**一个商品 + 多个 product_files**。
   - 归并规则：优先取主源码包（含代码特征 pom/package.json/web.xml 者），其余按材料类型归类；文件名后缀（论文/开题/PPT/截图/sql/视频）映射材料标签。
   - 输出 `data/products-merged.json`，同时保留原始映射表 `data/file-map.json`（可回滚、可审计）。
2. **清洗（clean）**：标题/关键词清洗规则引擎（正则表驱动）：
   - 去噪音：`1111+`、`待做`、`pf`、`LW PPT`、`(1)(2)`、`【问题】`、`数据库导入失败`、`启动页空白` 等后缀/标注 → 移入 `qa_note` 而不是删除项目。
   - 规范化：统一全角/半角、去重复空格、`springboot`→`SpringBoot`（展示层）。
   - 派生 `category`：关键词→业务分类映射表（商城/校园/医疗/教育/政务/生活…）。
3. **富化（enrich，probe.js v2）**：
   - 解析压缩包内 `pom.xml / application.yml / package.json / web.xml / sql 文件头` → 精确识别 JDK 版本、SpringBoot 版本、MySQL 版本、端口、前端框架。
   - 提取 `README/部署说明/数据库脚本` 内容片段进 `qa_note`。
   - 详情生成升级：功能模块（现有词典 + 代码特征词）、运行环境、启动步骤。
4. **质检（qa）工作流**：
   - 商品新增 `run_status`；后台「质检中心」：列表按 run_status 筛选 → 查看文件清单/运行环境 → 一键标记"已验证可运行/有问题"，填写 qa_note。
   - 计划任务 `jobs/qaReminderJob`：超过 N 天未验证的自动置顶提醒。
5. **增量（增量同步升级 sync-products.js v2）**：
   - 保留按 source_path 增量；增加 `--merge` 模式（先归并再同步）；
   - 新入库商品默认 run_status=0（未验证）且**不上架**（status=0），质检通过后一键上架 → 杜绝"没验证的代码在卖"。
   - 删除的源目录自动标记（--disable-missing 已有，扩展到文件级）。

#### 1.2 交付体系（自动发货）

| 方案 | 说明 | 选型建议 |
|---|---|---|
| A. 网盘链接 | 后台为商品维护网盘链接+提取码（百度/夸克/阿里），购买后自动把链接+码+使用说明发给买家 | ✅ 首选（省带宽） |
| B. 服务器直存 | 源码上传到 `server/uploads/files`（支持大文件、断点续传可选），签名下载链接（限时/限用户/防抓取） | 备选（商品文件<500MB 时） |
| C. 混合 | 大文件走网盘、小文件走直存 | 推荐最终形态 |

- **自动发货流程**：订单支付成功 → 校验商品已配置交付资料 → 生成 `delivery_logs` + 站内信通知 → 订单状态 `paid→shipped`（自动）。未配置的走人工兜底。
- **买家侧**：订单详情展示"下载源码"卡片（网盘链接复制按钮 / 直存下载按钮 + 使用说明 + qa_note）。
- **防滥用**：直存链接 24h 签名 + 单用户限制 + 下载审计；网盘链接后台可一键更换（旧链接失效提醒）。

#### 1.3 在线演示（远期增强，P4 评估）

- web 类商品可挂 `demo_url`（演示站）或 `video_url`（演示视频，用户已有大量 mp4 素材）；详情页新增"在线演示/演示视频"Tab。
- 远期：Docker 沙箱一键拉起演示（成本高，需独立环境，暂缓）。

**验收标准**：1528 商品去重后 ≈1300 商品；全部含材料标签与运行环境；新增源码 10 分钟内部署完成；支付后自动发货成功率 100%（已配置商品）。

---

### 阶段 2（P1）：强搜索 —— "搜索要做到很好"

#### 2.1 索引方案（MySQL ngram 全文，已满足）

- MySQL 5.7.17 已启用 `ngram_token_size=2`，中文 2-gram 分词开箱可用，无需改配置。
- 建索引（幂等迁移）：
```sql
ALTER TABLE products ADD FULLTEXT INDEX ft_search (title, keywords, description, category) WITH PARSER ngram;
```
- 权重排序：`MATCH AGAINST` 天然按相关度；再叠加业务权重：
```sql
SELECT id, title, tech, price, cover,
       MATCH(title, keywords, description, category) AGAINST(? IN NATURAL LANGUAGE MODE) AS score,
       (MATCH(title) AGAINST(?) * 3 + MATCH(keywords) AGAINST(?) * 1.5
        + MATCH(description) AGAINST(?) * 0.5) AS weighted
FROM products
WHERE MATCH(title, keywords, description, category) AGAINST(? IN NATURAL LANGUAGE MODE)
  AND status=1 AND is_deleted=0
ORDER BY weighted DESC, sort_weight DESC, sales DESC
LIMIT ? OFFSET ?;
```
- **降级兜底**：ngram 对短词（<2 字）不命中，短查询走 `title LIKE 'kw%'` 前缀 + `FULLTEXT` 并集；保证"搜什么都出结果"。

#### 2.2 搜索接口升级（/api/products v2）

- **新增参数**：`priceMin/priceMax`、`hasPaper/hasPpt/hasVideo/hasDb`、`type`、`kind`、`sort=relevance|latest|price_asc|price_desc|sales`
- **新增返回**：`facets`（技术栈分布 / 材料分布 / 价格区间分布，一次查询给全，前端渲染筛选侧栏）、`suggest`（联想词）、`highlight`（命中片段，前端高亮渲染 `<em>`）
- **新增接口**：
  - `GET /api/search/suggest?keyword=` — 联想（热门词前缀 + 标题 ngram 前缀，限 8 条，输入防抖 200ms）
  - `GET /api/search/hot` — 热门词（hot_words 表，自动统计+人工置顶）
  - `POST /api/search/log` — 搜索日志（防抖 3s 合并上报，只记非空词）
  - `GET /api/products/related?id=` — 相关推荐（同 tech + ngram 相似度 TOP6）

#### 2.3 前端搜索体验升级

- **首页/顶栏搜索框**：聚焦下拉联想（高亮匹配部分）+ 热门搜索词标签云 + "直达分类"快捷入口。
- **结果页**：
  - 左侧筛选栏（facet）：技术栈 / 价格区间 / 材料（论文/PPT/视频/数据库）/ 类型；多选联动、URL 同步可分享。
  - 结果卡：关键词高亮、材料标记、销量/浏览量、运行状态角标（已验证可运行 ✅）。
  - 排序 Tab：综合 / 最新 / 销量 / 价格。
  - **空结果策略**：展示"未找到，为您推荐"+ 相关词联想 + 联系客服定制入口。
- **搜索历史**：localStorage 最近 10 条，可清除。

#### 2.4 搜索统计与运营

- search_logs → 后台"搜索分析"：热词榜（近7天/30天）、无结果词榜（→ 提示补货或上定制服务）、转化漏斗（搜索→详情→下单）。
- 无结果词自动沉淀为"定制需求线索"（可一键转为定制服务需求单）。

**验收标准**：搜"图书"出图书类全部商品且权重合理；搜"tushu"（拼音）能兜底到结果；联想延迟 <100ms；无结果页有引导；后台可见热词/无结果词报表。

---

### 阶段 3（P2）：定制服务 —— "支持定制"

#### 3.1 业务模型与状态机

```
用户提交需求 ──▶ submitted(待报价)
                    │ 管理员报价
                    ▼
                 quoted(已报价) ──拒绝──▶ rejected
                    │ 用户付定金(30%-50%)
                    ▼
               deposit_paid(开发中)
                    │ 中途沟通(messages)
                    ▼
                 delivered(已交付) ──用户验收──▶ accepted(已完成)
                    │                                │
                    └──用户不满意──▶ revising(返工)──┘
                    │ 用户取消
                    ▼
                 cancelled(已取消，定金规则按后台配置)
```

#### 3.2 功能设计

**用户侧（前台 `/custom`）**
- 定制服务首页：服务说明（毕设代做/功能定制/改 bug/论文指导）、报价参考表、流程引导、成功案例（已交付商品）。
- 需求提交表单：标题、项目类型、技术栈、功能描述（富文本）、预算区间、期望时间、附件上传（需求文档/参考图）。
- 我的定制单：列表（状态徽标）+ 详情（时间线：提交/报价/付定金/开发/交付/验收 + 沟通留言区 + 附件）。
- 支付：定金支付（复用支付 Provider）、交付后支付尾款。
- 验收：交付后"确认验收/提出修改意见"按钮。

**后台（`/admin/custom`）**
- 需求单管理：列表（状态/金额/时间筛选）、详情（完整需求+沟通记录）、报价表单（金额、周期、说明）、标记交付（上传交付文件/网盘链接）、验收处理。
- 消息通知：新需求/新留言/待验收 → 站内信 + （可选）邮件/企微推送。
- 报价模板：常用需求类型预设报价（可编辑）。
- 数据看板：定制单转化率、客单价、周期统计。

**技术要点**
- `custom_orders` + `custom_messages` + `attachments` 三表；状态流转全部后端校验（防前端绕过）。
- 定金/尾款与 `pay_records` 打通；取消规则（未付定金可自由取消；已付定金按配置比例退/扣）后台可配。
- 附件上传复用 multer，限类型/大小（文档/图片/压缩包）。

**验收标准**：用户 5 分钟可提交需求单；管理员报价后用户收到通知；全流程状态可追踪；支付流水可对账。

---

### 阶段 4（P3）：交易与运营闭环

#### 4.1 支付（Provider 化）

- 抽象 `services/payProvider.js`：`create(order, channel) / verifyCallback(payload) / query(tradeNo)`。
- 实现顺序：`mock`（现状）→ `epay`（易支付/码支付，个人可接入）→ `wxpay/alipay`（官方，需商户号）。
- 支付回调验签 + 幂等（pay_records 防重）；支付成功 → 触发自动发货 + 站内信 + 订单状态流转。
- 卡密支付保留；"模拟支付"仅开发环境可用（后台开关）。

#### 4.2 售后与退款

- 售后单（refunds）：买家发起（原因/说明/附件）→ 管理员审核 → 同意退款（原路/手动）+ 收回已发卡密/关闭下载链接 → 关闭订单。
- 退款状态与 pay_records 关联，人工确认制（当前量级够用）。

#### 4.3 评价体系

- 订单 `completed` 后可评价（星级 1-5 + 文字 + 图片可选），仅限已购买。
- 商品详情展示评分 + 评价列表；后台可回复/隐藏违规评价。

#### 4.4 营销与运营

- 优惠券（coupons）：后台生成码（满减/折扣），结算页使用；可限制商品/用户。
- 公告（notices）：首页 Banner + 列表页公告条 + 后台编辑。
- 收藏扩展：收藏夹批量移动、分享链接。
- 后台增强：
  - **批量操作**：商品批量改价/上下架/删除/质检状态；订单批量发货（粘贴发货信息）。
  - **数据看板**：销售趋势折线（ECharts 引入）、TOP 商品/技术栈、转化漏斗、近 7 天订单/用户增长。
  - **操作日志**（admin_logs）：关键操作审计（登录、改价、发货、禁用用户）。
  - **管理员账号管理**：多管理员 + 角色（superadmin / admin / ops）。

**验收标准**：真实支付可收款（选定渠道后）；退款流程可走通；商品页有评分；后台批量操作 5 分钟完成 100 条改价。

---

### 阶段 5（P4）：体验与工程化

#### 5.1 前端体验

- **移动端响应式**：顶栏折叠抽屉菜单、商品网格卡片化、后台列表页移动断点（侧栏收起为抽屉）、结算/支付流程单列化。目标：手机浏览器可用。
- **细节**：商品列表骨架屏、图片懒加载+占位、详情目录锚点、分享（复制链接/二维码）、返回顶部。
- **修复已知 Bug**：401 重复弹窗、路由守卫校验 token、下单幂等（前端禁用双击 + 后端 order_no 唯一重试）、购物车校验商品状态与价格、补充 404 页面。
- **SEO**：`vue-meta` 动态 title/description/keywords；预渲染（vite-plugin-prerender）首页/详情/列表关键路由；`sitemap.xml` + `robots.txt`（后端生成）。

#### 5.2 工程化

- **日志**：winston（request/error/access 三类），日志轮转，敏感字段脱敏。
- **统一响应与错误**：`{code, message, data}` 包装 + 全局错误中间件（不再回显 err.message 内部细节）。
- **缓存**：热点接口（首页/techs/热门词）内存 TTL 缓存 5-30s；可选 Redis 升级路径。
- **性能**：列表只查必要列（现状已基本如此）；`bcrypt.hashSync`→`bcrypt.hash`（异步）；慢查询日志。
- **测试**：扩充 regression-test.js 覆盖新接口（搜索/定制/发货/支付回调）；关键流程冒烟脚本。
- **代码规范**：ESLint + Prettier 一次性引入（先只报错不强制）。

#### 5.3 部署与运维

- **Docker Compose**（生产）：`nginx(HTTPS) + app(node) + mysql(5.7, 挂载数据卷) + redis(可选)`；一键 `docker compose up -d`。
- **本机运行**：PM2 守护 `server` + 构建 `web`；开机自启脚本。
- **备份**：每日凌晨 `mysqldump code_shop` 保留 7 天 + 商品文件目录 rsync；恢复演练文档。
- **安全**：上传白名单校验；下载签名链接；管理后台 IP 白名单（可选）；HTTPS 证书（Let's Encrypt）。

**验收标准**：手机访问核心流程可用；百度收录关键页；日志可查错；`docker compose up -d` 一条命令起全套；备份可恢复。

---

## 六、里程碑与排期建议

| 里程碑 | 内容 | 预估工作量 |
|---|---|---|
| M1（P0） | 归并清洗 + 字段改造 + 质检工作流 + 自动发货 | 2-3 天 |
| M2（P1） | ngram 全文 + 联想/高亮/facet + 搜索统计 | 2-3 天 |
| M3（P2） | 定制服务全流程（前后端） | 3-4 天 |
| M4（P3） | 支付 Provider + 售后 + 评价 + 营销 + 后台增强 | 3-5 天 |
| M5（P4） | 移动端 + SEO + 工程化 + Docker 部署 + 备份 | 3-5 天 |

> 建议顺序执行，每完成一个里程碑即可上线使用；M1+M2 组合后网站即可对外销售。

---

## 七、需要你决策的点

| # | 决策点 | 选项 | 我的建议 |
|---|---|---|---|
| 1 | 支付渠道 | ① 保持模拟 ② 易支付/码支付（个人可接）③ 微信/支付宝官方（需营业执照+商户号） | 先做 Provider 架构，上线初期用② |
| 2 | 源码交付 | ① 纯网盘链接 ② 服务器直存 ③ 混合 | ③ 混合（<500MB 直存，大的走网盘） |
| 3 | 是否需要"在线演示" | ① 挂截图/视频即可 ② 要一键 demo 部署（成本高） | 先 ① |
| 4 | 搜索技术 | ① MySQL ngram 全文（当前足够）② 上 Elasticsearch | ①，预留接口以后可换 |
| 5 | 移动端 | ① 响应式网页 ② 额外做微信小程序 | 先 ① |
| 6 | 部署环境 | ① 本机长期跑（PM2）② 云服务器 Docker | 上线前切 ② |
| 7 | 管理员 | ① 单管理员 ② 多管理员+角色权限 | 先 ①，架构留角色字段 |
| 8 | 商品数据清洗 | ① 自动规则清洗+后台人工复核 ② 全自动直接改 | ①（安全，可审计） |
