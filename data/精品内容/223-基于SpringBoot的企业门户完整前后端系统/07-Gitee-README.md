# 07 · Gitee README

## 仓库名建议
- `springboot-company-portal`
- `company-portal-springboot`
- `enterprise-portal-ssm`（若强调 SSM 风格分层）

> 命名原则：小写 + 连字符，突出「SpringBoot」与「企业门户/前后端」。

---

## README 正文（可直接粘贴）

# 基于 SpringBoot 的企业门户完整前后端系统

一套「前台企业官网 + 后台管理系统」一体化的前后端完整项目，基于 SpringBoot 2.0.3 开发，前台对外展示，后台统一维护内容，无需改动代码即可更新网站。

## 一、项目简介

- **项目定位**：企业门户 / 官网 + 后台管理系统（B/S 架构）
- **角色**：前台访客、后台管理员（多角色，权限可配）
- **运行端口**：默认 80（如被占用或权限不足，可改为 8080/18080 等，修改 `application.yml` 的 `server.port`）
- **数据库**：MySQL，库名 `admin1`，脚本共 44 张表（含示例数据）

## 二、演示视频与文件清单

- 演示视频：真机操作录屏，完整走一遍前台栏目与后台管理
- 文件清单：
  - `company-portal/` 完整源码工程（Maven）
  - `admin1.sql` MySQL 数据库脚本
  - `运行必读.txt` 运行说明
  - `运行截图/` 运行截图 8 张
  - 演示视频（约 3 分半）

> 演示视频与完整资料获取方式见仓库主页简介。

## 三、功能模块

### 前台栏目
| 栏目 | 说明 |
|---|---|
| 首页 | 轮播图、公司简介、产品展示、公司新闻、网站公告、客户案例 |
| 关于我们 | 公司简介 / 企业文化 / 经营理念（图文） |
| 产品展示 | 产品列表（卡片分栏）+ 产品详情 |
| 新闻中心 | 按类型展示：公司新闻 / 行业资讯 / 客户案例 / 公告，点标题阅读正文 |
| 联系我们 | 公司地址、联系电话、在线留言表单 |

### 后台功能
| 分组 | 菜单 |
|---|---|
| 基础管理 | 文件管理、数据字典 |
| 系统管理 | 系统菜单、用户管理、角色管理、部门管理 |
| 系统工具 | 代码生成、计划任务（Quartz） |
| 系统监控 | 系统日志、运行监控（Druid）、在线用户 |
| 文章管理 | 文章信息管理（富文本编辑） |
| 产品管理 | 产品图片管理 |
| 轮播图管理 | 首页轮播图管理、轮播图类型管理 |
| 基础信息配置 | 公司简介设置、企业文化设置、经营理念设置 |

## 四、技术栈

**后端**
- 核心框架：SpringBoot 2.0.3.RELEASE
- 持久层：MyBatis 3.4.4（mybatis-spring-boot-starter 1.1.1）
- 安全框架：Apache Shiro 1.3.2
- 模板引擎：Thymeleaf（LEGACYHTML5 + nekohtml）
- 数据库连接池：Alibaba Druid 1.0.28
- 工作流：Activiti 5.22.0（engine / spring / modeler / diagram-rest）
- 定时任务：Quartz 2.2.1
- 缓存：Ehcache + Redis（spring-boot-starter-data-redis + jedis 2.9.0）
- 其他：fastjson、commons-lang3、commons-configuration、commons-io、velocity（代码生成）、jsoup（XSS 过滤）
- 运行环境：JDK 1.8

**前端**
- JS 框架：jQuery
- 表单验证：jQuery Validation
- 富文本：summernote
- 数据表格：bootstrapTable
- 弹出层：layer
- 树结构：jsTree

## 五、数据库设计

MySQL 数据库 `admin1`，共 44 张表，按用途分为三类：

**1. 门户业务表**
| 表名 | 用途 |
|---|---|
| `a_news` | 文章内容（用 `type` 区分公司新闻/行业资讯/客户案例/公告） |
| `a_product_pic` | 产品图片与简介 |
| `a_index_pic` | 首页轮播图 |
| `a_pic_type` | 轮播图类型 |

**2. 系统 / 权限表（sys_*）**
| 表名 | 用途 |
|---|---|
| `sys_user` / `sys_user_role` / `sys_user_plus` | 用户、用户-角色、用户扩展 |
| `sys_role` / `sys_role_menu` | 角色、角色-菜单权限 |
| `sys_menu` | 菜单（目录/菜单/按钮三级，含 perms 权限标识） |
| `sys_dept` | 部门 |
| `sys_dict` | 数据字典 |
| `sys_file` | 文件管理 |
| `sys_log` | 系统操作日志 |
| `sys_task` | 计划任务 |

**3. 工作流与其他表**
| 表名 | 用途 |
|---|---|
| `act_*`（25 张） | Activiti 工作流引擎表 |
| `oa_notify` / `oa_notify_record` | 站内通知与已读记录 |
| `salary` | 薪资流程演示表 |
| `blog_content` | 博客内容表（模板自带） |

## 六、快速运行步骤

1. 准备环境：JDK 1.8+、MySQL（5.5/5.7/8.0）、Maven
2. 导入数据库：创建库 `admin1`，执行 `admin1.sql`（脚本已含 DROP/CREATE 与示例数据）
3. 修改配置 `src/main/resources/application-dev.yml`：数据库账号密码、Redis 地址（默认本机 6379）、上传目录 `bootdo.uploadPath`
4. 如需修改端口：编辑 `src/main/resources/application.yml` 的 `server.port`（默认 80；如被占用或权限不足，可改为 8080/18080 等）
5. 启动项目：在 `company-portal` 目录执行
   ```bash
   mvn spring-boot:run
   ```
   或打包运行：
   ```bash
   mvn clean package -DskipTests
   java -jar target/bootdo-2.0.0.jar
   ```
6. 访问（按默认端口 80）：
   - 前台：http://localhost/home
   - 后台：http://localhost/index
   - 后台管理员账号见项目内 `运行必读.txt` 与数据库 `sys_user` 表（默认 admin / 1；另有测试账号 test / 111111，登录页可能预填 111111，请以 admin / 1 登录）

## 七、项目截图

> 截图位（在此粘贴运行截图）

- `![前台首页](docs/screenshots/home.png)` 前台首页
- `![关于我们](docs/screenshots/about.png)` 关于我们
- `![产品展示](docs/screenshots/product.png)` 产品展示
- `![后台首页](docs/screenshots/admin-index.png)` 后台首页
- `![用户管理](docs/screenshots/user.png)` 用户管理
- `![文章管理](docs/screenshots/article.png)` 文章管理
- `![轮播图管理](docs/screenshots/indexpic.png)` 轮播图管理
- `![文件管理](docs/screenshots/file.png)` 文件管理

## 八、说明与致谢

- 本项目基于开源后台脚手架二次开发，前台为企业门户定制，仅用于学习与技术交流。
- 源码、数据库脚本可自由学习参考，请勿用于商业用途。
- 如果这个项目对你有帮助，欢迎点个 **Star** ⭐ 支持一下，也方便后续更新。
