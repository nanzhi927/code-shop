# 08 · GitHub README

## 仓库名建议
- `springboot-company-portal`
- `company-portal`
- `enterprise-portal-springboot`

> 命名原则：小写 + 连字符，英文语义清晰，避免拼音。

---

## README 正文（可直接粘贴）

# Company Portal — Full-Stack Enterprise Website (SpringBoot)

A full-stack enterprise portal system built with SpringBoot 2.0.3 — a public-facing company website plus a complete admin backend in one codebase. Front-end content (carousel, products, news, announcements, company profile) is fully managed from the admin panel without touching code.

一套基于 SpringBoot 的企业门户完整前后端系统：前台为企业官网，后台为管理系统，内容统一在后台维护，无需修改代码即可更新网站。

## 1. Overview

- **Type**: Enterprise portal (public website) + Admin management system, B/S architecture
- **Roles**: front-end visitor, back-end admin (multi-role, configurable permissions)
- **Server port**: default 80 (change `server.port` in `application.yml` if occupied or permission denied, e.g. 8080/18080)
- **Database**: MySQL, schema `admin1`, 44 tables with sample data

## 2. Demo Video & File List

- Demo video: real machine screen recording covering the full front-end and admin workflows
- Files included:
  - `company-portal/` — complete Maven source project
  - `admin1.sql` — MySQL database script
  - `运行必读.txt` — setup notes
  - `运行截图/` — 8 screenshots
  - Demo video (~3.5 min)

> How to get the demo video and full package: see the repository profile.

## 3. Features

### Front-end Pages
| Page | Description |
|---|---|
| Home | Carousel, company profile, products, company news, announcements, case studies |
| About Us | Company profile / corporate culture / business philosophy |
| Products | Product list (card layout) + product detail |
| News Center | Categorized: company news / industry news / customer cases / announcements |
| Contact Us | Address, phone, and an online message form |

### Admin Backend
| Group | Menus |
|---|---|
| Basic | File management, Data dictionary |
| System | Menu, User, Role, Department management |
| Tools | Code generator, Scheduled jobs (Quartz) |
| Monitoring | System log, Druid monitor, Online users |
| Article | Article management (rich-text editor) |
| Product | Product image management |
| Carousel | Home carousel management, Carousel type management |
| Site Config | Company profile / culture / philosophy settings |

## 4. Tech Stack

**Backend**
- SpringBoot 2.0.3.RELEASE
- MyBatis 3.4.4 (mybatis-spring-boot-starter 1.1.1)
- Apache Shiro 1.3.2
- Thymeleaf (LEGACYHTML5 + nekohtml)
- Alibaba Druid 1.0.28
- Activiti 5.22.0 (engine / spring / modeler / diagram-rest)
- Quartz 2.2.1
- Ehcache + Redis (spring-boot-starter-data-redis + jedis 2.9.0)
- Others: fastjson, commons-lang3, commons-configuration, commons-io, velocity (code generator), jsoup (XSS filter)
- JDK 1.8

**Frontend**
- jQuery · jQuery Validation · summernote · bootstrapTable · layer · jsTree

## 5. Database Design

MySQL schema `admin1`, 44 tables in three categories:

**Portal business tables**
| Table | Purpose |
|---|---|
| `a_news` | Articles (type distinguishes company news / industry news / cases / announcements) |
| `a_product_pic` | Product images and intro |
| `a_index_pic` | Home carousel |
| `a_pic_type` | Carousel type |

**System / permission tables (sys_*)**
| Table | Purpose |
|---|---|
| `sys_user` / `sys_user_role` / `sys_user_plus` | User, user-role, user extra |
| `sys_role` / `sys_role_menu` | Role, role-menu permissions |
| `sys_menu` | Menus (directory / menu / button with perms) |
| `sys_dept` | Department |
| `sys_dict` | Data dictionary |
| `sys_file` | File management |
| `sys_log` | Operation log |
| `sys_task` | Scheduled jobs |

**Workflow & others**
| Table | Purpose |
|---|---|
| `act_*` (25 tables) | Activiti workflow engine tables |
| `oa_notify` / `oa_notify_record` | Notifications and read records |
| `salary` | Salary workflow demo |
| `blog_content` | Blog content (bundled template) |

## 6. Quick Start

1. Prepare: JDK 1.8+, MySQL (5.5/5.7/8.0), Maven
2. Create database `admin1` and run `admin1.sql`
3. Edit `src/main/resources/application-dev.yml` (DB credentials, Redis host, `bootdo.uploadPath`)
4. Change port if needed: edit `server.port` in `src/main/resources/application.yml` (default 80; use 8080/18080 etc. if occupied or permission denied)
5. Run:
   ```bash
   mvn spring-boot:run
   ```
   or package and run:
   ```bash
   mvn clean package -DskipTests
   java -jar target/bootdo-2.0.0.jar
   ```
6. Visit (default port 80):
   - Front-end: http://localhost/home
   - Admin: http://localhost/index
   - Admin credentials: see `运行必读.txt` in the project and the `sys_user` table (default admin / 1; test account test / 111111, the login page may pre-fill 111111 — log in as admin / 1)

## 7. Screenshots

- `![Home](docs/screenshots/home.png)` Front-end home
- `![About](docs/screenshots/about.png)` About us
- `![Products](docs/screenshots/product.png)` Products
- `![Admin](docs/screenshots/admin-index.png)` Admin dashboard
- `![Users](docs/screenshots/user.png)` User management
- `![Articles](docs/screenshots/article.png)` Article management
- `![Carousel](docs/screenshots/indexpic.png)` Carousel management
- `![Files](docs/screenshots/file.png)` File management

## 8. Notes

- Built on an open-source admin scaffold with a customized portal front-end, for learning and technical exchange only.
- Please do not use it for commercial purposes.
- If this project helps you, please give it a **Star** ⭐ — it keeps the project maintained.
