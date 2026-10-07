# Gitee｜305 网上点餐系统

> 【内部说明·不发布】
> - 适用层级：C（代码平台，技术文档风）
> - 适用平台：Gitee 开源仓库 README（教学版，用于技术背书与引导）
> - 事实依据：项目事实卡（三角色 / 前台6栏目 / 11张表=系统3+业务8 / db.sql 含建库与示例数据 / 端口8080 + 上下文 springboott01gx / 管理员 abo·abo（教学版不写入 README）/ SpringBoot 2.2.2.RELEASE + MyBatis-Plus 2.3 + Shiro 1.3.2 / 目录结构按实际工程整理）
> - ⚠️ 说明：README 中不写账号密码，避免滥用；完整版与自建站入口留给"仓库主页引导"占位，由运营侧填入自建站地址（本文件不编造 URL）
> - 引用：00-通用素材/12（分层合规）、02（违禁词自查表·C类）、03（关键词库）、04（Gitee 标题公式）、05（Issues 回复引导）、07（完整版引导，不在正文出现价格数字）、08（Gitee topics）
> - 合规自查结论：C 类 7 个禁词（代做/代写/包过/保毕业/出售/下单/价格）发布区 0 命中；全中文技术文档风；已注明"学习交流用，禁止商用"

---

## 【可直接复制发布区】

### 仓库名候选

1. **online-ordering-system-springboot** ✅（命中：online ordering system + springboot）
2. **springboot-meishi-dingcan** ✅（命中：springboot + 点餐拼音长尾）
3. **wangshang-diancan-springboot**（拼音长尾，中文搜索兜底）

> 仓库名可英文，README 全中文。topics 引用 00-通用素材/08（毕设、毕业设计、springboot、点餐系统、管理系统、java、mybatis、vue）。

### README（全中文，2000 字以上）

# 网上点餐系统-SpringBoot（学习交流版）

基于 SpringBoot 的网上点餐系统完整前后端工程**学习版**：一个 Maven 工程内实现**用户点餐端、美食店商家端、管理员后台**三端角色，前台 6 栏目、后台 9 组功能，数据库 **11 张表**导入即用，适合 Java Web 方向的学习参考与技术交流。

> 本仓库为学习交流版，仅供学习与技术交流使用，禁止商用。完整资料（含论文初稿、答辩 PPT、运行截图与答疑）获取方式见文末引导。

## 项目简介

- **前台（点餐端，6 栏目）**：首页（轮播图，后台可配）、美食店、美食信息、美食评价、美食资讯、个人中心。美食信息支持点餐与收藏，个人中心含个人信息、美食订单管理、美食评价管理、我的收藏管理。
- **三种角色**：
  - 用户：注册登录、维护个人资料、点餐提交订单、查看订单状态、写评价、管理收藏；
  - 美食店：维护本店美食信息、处理本店订单、查看与回复评价、维护店铺资料；
  - 管理员：用户管理、美食店管理、美食分类管理、美食信息管理、美食订单管理、美食评价管理、美食资讯、轮播图管理。
- **业务闭环**：浏览美食 → 点餐生成订单 → 订单审核与支付状态 → 评价 → 收藏。
- **数据库**：MySQL，库名 `springboott01gx`，11 张表（系统类 3 + 业务类 8），脚本自带建库语句与示例数据。
- **工程**：标准 Maven 结构，JDK 1.8，SpringBoot 2.2.2.RELEASE。

【项目截图】
- 前台首页（截图位）
- 美食信息列表与详情（截图位）
- 用户端订单列表（截图位）
- 美食店商家端管理页（截图位）
- 管理员后台订单管理（截图位）
- 数据库 11 张表分组（截图位）

【演示与文件清单】
- 运行截图：随完整资料提供 10 张（本仓库 README 用截图位占位）
- 文件清单：源码工程、`db.sql` 数据库脚本、运行必读与说明文档

## 功能清单

### 前台（点餐端，6 栏目）

| 栏目 | 说明 |
|---|---|
| 首页 | 轮播大图（后台可配）+ 栏目导航 |
| 美食店 | 店铺列表 + 详情（名称、照片、电话、介绍、地址、招牌美食、联系人） |
| 美食信息 | 美食列表 + 详情（名称、分类、所属店铺、电话、图片、口味、特色、单价、图文详情），支持点餐与收藏 |
| 美食评价 | 评价列表 + 详情（店铺、美食、用户、评分、内容、图片、评价时间） |
| 美食资讯 | 资讯列表 + 详情，后台发布即更新 |
| 个人中心 | 个人信息、美食订单管理、美食评价管理、我的收藏管理 |

### 后台（管理端，9 组功能）

| 模块 | 说明 |
|---|---|
| 用户管理 | 用户信息维护与删除 |
| 美食店管理 | 店铺资料维护（账号、名称、照片、电话、介绍、地址、招牌美食、联系人） |
| 美食分类管理 | 分类维护，与美食信息联动 |
| 美食信息管理 | 美食新增/修改/删除（名称、分类、店铺、口味、特色、单价、图文详情） |
| 美食订单管理 | 订单查看、审核与回复，维护审核与支付状态 |
| 美食评价管理 | 评价查看与维护（评分、内容、时间） |
| 美食资讯 | 资讯发布与维护 |
| 轮播图管理 | 首页轮播图配置（对应 `config` 表） |
| 个人中心 | 后台账号信息维护 |

权限体系：Apache Shiro 1.3.2 完成登录鉴权，配合令牌拦截器（`AuthorizationInterceptor`）在业务层之前校验身份，并按角色隔离数据范围——用户仅见本人订单，美食店仅见本店数据，管理员为全量视图。

## 技术栈

| 类别 | 技术 | 版本 |
|---|---|---|
| 语言 | Java | 1.8 |
| 框架 | SpringBoot | 2.2.2.RELEASE |
| ORM | MyBatis（mybatis-spring-boot-starter） | 2.1.1 |
| ORM 增强 | MyBatis-Plus | 2.3（starter 1.0.5） |
| 安全 | Apache Shiro（shiro-spring） | 1.3.2 |
| JSON | FastJSON | 1.2.8 |
| 工具库 | Hutool / commons-lang3 / commons-io | 4.0.12 / 3.0 / 2.5 |
| 前端 | Vue + layui + jQuery + ElementUI 资源 | — |
| 数据库 | MySQL | 5.7 / 8.0 |
| 构建 | Maven（另含 pom-war.xml 备用） | — |

## 目录结构

```
网上点餐系统/
├── springboott01gx/                     # Maven 工程
│   ├── pom.xml                          # 依赖与构建配置
│   ├── pom-war.xml                       # war 打包备用配置
│   ├── mvnw / mvnw.cmd                   # Maven Wrapper
│   ├── .mvn/wrapper/                     # Wrapper 配置
│   └── src/main/
│       ├── java/com/
│       │   ├── SpringbootSchemaApplication.java   # 启动类
│       │   ├── annotation/               # IgnoreAuth / LoginUser 等注解
│       │   ├── config/                   # InterceptorConfig、MybatisPlusConfig
│       │   ├── controller/               # 12 个控制器
│       │   │   ├── CommonController.java         # 通用查询、地图定位等
│       │   │   ├── ConfigController.java         # 配置与轮播图
│       │   │   ├── FileController.java           # 文件上传
│       │   │   ├── MeishidianController.java     # 美食店
│       │   │   ├── MeishidingdanController.java  # 美食订单
│       │   │   ├── MeishifenleiController.java   # 美食分类
│       │   │   ├── MeishipingjiaController.java  # 美食评价
│       │   │   ├── MeishixinxiController.java    # 美食信息
│       │   │   ├── NewsController.java           # 美食资讯
│       │   │   ├── StoreupController.java        # 收藏
│       │   │   ├── UserController.java           # 管理员账号
│       │   │   └── YonghuController.java         # 用户
│       │   ├── dao/                      # 12 个 Mapper 接口
│       │   ├── entity/                   # 实体（12 个）+ model / view / vo
│       │   ├── interceptor/              # AuthorizationInterceptor 令牌拦截
│       │   ├── service/ + service/impl/  # 业务接口与实现
│       │   └── utils/                    # MD5Util / FileUtil / PageUtils / R 等工具类
│       └── resources/
│           ├── application.yml           # 端口、数据源、MyBatis-Plus 配置
│           ├── mapper/                   # 12 个 MyBatis XML 映射文件
│           ├── admin/admin/              # 后台管理端（Vue 工程 + dist 打包产物）
│           ├── front/front/              # 点餐前台
│           │   ├── index.html            # 前台入口
│           │   └── pages/                # 各栏目页面（home / meishidian / meishixinxi 等）
│           └── static/upload/            # 上传与示例图片
├── db.sql                               # 数据库脚本（建库 + 11 张表 + 示例数据）
├── 运行必读.txt                          # 功能与技术说明
├── 说明文档.txt                          # 访问地址与配置位置
├── 运行截图/                             # 10 张运行截图
├── 论文.docx                             # 毕业设计论文初稿（完整资料）
└── ppt.pptx                              # 答辩 PPT（完整资料）
```

> 说明：以上结构按仓库实际目录整理；`dao`、`entity`、`service` 等目录下文件均按业务实体一一对应。

## 数据库设计

库名 `springboott01gx`，共 **11 张表**，按用途分两类：

| 分类 | 数量 | 表名 | 说明 |
|---|---|---|---|
| 系统类 | 3 | `users`、`token`、`config` | 管理员账号、登录令牌、配置（首页轮播图存 `config`） |
| 业务类 | 8 | `yonghu`、`meishidian`、`meishifenlei`、`meishixinxi`、`meishidingdan`、`meishipingjia`、`news`、`storeup` | 用户、美食店、美食分类、美食信息、美食订单、美食评价、美食资讯、收藏 |

其中**美食订单表**字段设计值得细看：`dingdanbianhao` 订单编号、`meishimingcheng` 美食名称、`dianpuzhanghao` / `dianpumingcheng` 店铺账号与名称、`lianxidianhua` 联系电话、`jiage` 单价、`goumaishuliang` 点餐数量、`zongjiage` 总金额、`yonghuzhanghao` / `yonghuxingming` / `yonghushouji` 用户信息、`peisongdizhi` 配送地址、`xiadanshijian` 提交时间、`sfsh` 是否审核（默认否）、`shhf` 审核回复、`ispay` 是否支付（默认未支付）。

脚本包含 `CREATE DATABASE`、各表 `DROP TABLE IF EXISTS` + `CREATE TABLE` 与示例数据，可重复导入。

## 环境要求

- JDK 1.8 及以上
- Maven 3.x
- MySQL 5.7 / 8.0
- 操作系统：Windows / macOS

## 快速开始

**1. 导入数据库**

脚本自带建库语句，命令行直接导入：

```bash
mysql -u root -p < db.sql
```

或在客户端中执行整份 `db.sql`。导入完成后应能看到 **11 张表**；表数量不足说明脚本未执行完，重新执行即可。

**2. 修改配置**

打开 `src/main/resources/application.yml`：

```yaml
server:
  port: 8080
  servlet:
    context-path: /springboott01gx

spring:
  datasource:
    driverClassName: com.mysql.jdbc.Driver
    url: jdbc:mysql://127.0.0.1:3306/springboott01gx?useUnicode=true&characterEncoding=utf-8&serverTimezone=GMT%2B8
    username: root
    password: 你的数据库密码
```

**3. 启动**

```bash
mvn spring-boot:run
```

或打包后运行：

```bash
mvn clean package -DskipTests
java -jar target/springboott01gx-0.0.1-SNAPSHOT.jar
```

**4. 访问验证**

- 前台（点餐端）：`http://localhost:8080/springboott01gx/front/index.html`
- 后台（管理端）：`http://localhost:8080/springboott01gx/admin/dist/index.html`

> 注意：端口为 8080，且**访问路径必须带上下文 `/springboott01gx`**；账号信息见完整资料中的说明文档。

## 常见问题（FAQ）

**Q1：启动后访问 404 或页面空白？**
多为遗漏上下文路径。必须访问 `http://localhost:8080/springboott01gx/...`，直接打开 `localhost:8080` 不会返回主页。

**Q2：启动报数据库连接失败（Access denied / Communications link failure）？**
检查三处：MySQL 服务是否已启动、`application.yml` 中用户名密码是否正确、库名是否为 `springboott01gx`。

**Q3：登录时报找不到账号或密码错误？**
先确认 11 张表已全部导入（含示例数据）；三种角色的账号来源不同，用户与美食店在点餐端登录，管理员在后台页面登录，不要混用入口。

**Q4：端口 8080 被占用怎么办？**
修改 `application.yml` 的 `server.port` 为其他端口，访问地址的端口号同步修改；上下文路径保持不变。

**Q5：为什么脚本执行提示表已存在？**
脚本对每张表都先 `DROP TABLE IF EXISTS` 再建表，重复执行会覆盖旧数据，属预期行为；如需保留数据请先备份。

**Q6：MyBatis 映射文件放在哪里？**
`src/main/resources/mapper/` 下按实体分文件（共 12 个），由 `application.yml` 中 `mybatis-plus.mapper-locations: classpath*:mapper/*.xml` 指定加载。

**Q7：前台内容在哪里维护？**
全部在后台：美食信息在"美食信息管理"，分类在"美食分类管理"，店铺在"美食店管理"，首页大图在"轮播图管理"；前台刷新即生效，无需改动代码。

**Q8：工程可以用于学习参考吗？**
可以。本工程基于现成脚手架工程二次开发，仅限学习与技术交流，禁止商用；建议在此基础上做自己的业务改造，并如实说明来源。

**Q9：完整资料包含哪些内容？**
除本仓库的源码与数据库脚本外，完整资料还包含论文初稿、答辩 PPT、10 张运行截图与运行说明；获取方式见文末与仓库主页引导。

**Q10：支持 MySQL 8 吗？**
支持，MySQL 5.7 / 8.0 均可；脚本的导出环境为 MySQL 5.7。

## 学习参考建议

1. **先跑通再动笔**：环境搭好、系统起来，对照页面把三端功能过一遍，系统分析部分的素材就有了；
2. **抓住三个技术点**：Shiro 登录鉴权与令牌拦截、三端角色的数据范围隔离、订单表的状态字段设计；
3. **数据库部分如实写**：11 张表 = 系统类 3 + 业务类 8，能说清分类思路本身就是加分项；
4. **演示提前彩排**：用户点餐 → 商家看到订单 → 处理订单 → 用户写评价，这条闭环演示比单点功能更完整；
5. **如实说明来源**：基于现成脚手架工程二次开发，能讲清每个模块原理比"从零手写"更经得起追问。

## 注意事项

1. 本仓库仅供**学习与技术交流**，禁止商用；
2. 本仓库为学习版，不含账号密码等完整资料，完整资料说明见仓库主页引导；
3. 论文与作业请独立完成，本仓库不提供相关服务。

## 更新记录

- 2026-09-13：整理 README，补充三端功能清单、数据库说明、目录结构、快速开始与常见问题；
- 后续更新：环境搭建教程、常见报错手册（计划中，欢迎 Issues 提问催更）。

## 交流与引导

环境搭建、运行报错、功能结构相关问题，欢迎在 Issues 提问，看到会回复；觉得有帮助欢迎 Star 收藏。完整资料（含论文初稿、答辩 PPT、运行截图与答疑）与按需改造说明，见仓库主页引导。

## 开源协议

仅学习交流使用，禁止商用。

---

## 【发布要点·不发布】

- **仓库设置**：topics 引用 00-通用素材/08（毕设、毕业设计、springboot、点餐系统、管理系统、java、mybatis、vue）；README 首行中文项目名 +（学习交流版）便于站内搜索命中
- **截图位**：发布前替换为真实截图（前台首页 / 美食信息详情 / 用户端订单 / 商家端管理页 / 后台订单管理 / 11 张表分组，系统 3 与业务 8 标色）
- **自建站入口**：README 顶部与文末的"仓库主页引导"占位处，由运营侧填入自建站地址（本文件不编造 URL）
- **Issues 维护**：报错类提问优先引导看 FAQ；结构/学习类交流回复模板引用 00-通用素材/05
- **发布时机**：开题季上线；答辩季前更新"学习参考建议"章节并重新提交，吃一次站内曝光
- **信任要素落点**：端口与上下文路径坑写进 FAQ / 11 张表如实拆解（不夸大）/ 明确"基于现成脚手架、仅学习交流、禁止商用"（≥2 ✅）
- **CTA**：Issues 交流 + Star 引导 + 完整资料与按需改造说明放仓库主页引导
