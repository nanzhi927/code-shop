# code-shop 部署与运维文档

本文档说明 Windows / Linux 本机部署、一键启停、备份恢复及常见问题。

---

## 一、Windows 一键启动（推荐）

项目根目录双击：

| 文件 | 作用 |
|------|------|
| `启动.bat` | 启动商城（生产：读 `server/.env`，托管 `web/dist`） |
| `停止.bat` | 停止商城 |
| `开发启动.bat` | 本机开发（后端 + Vite 热更新） |

### 1.1 前置条件

- 已安装 Node.js 20+
- MySQL 可连，`server/.env` 已配置（参考 `server/.env.example`）
- 首次：`cd server && npm install && node src/init.js`
- 前端已构建：`cd web && npm install && npm run build`（产物在 `web/dist`）

### 1.2 更新代码（推荐：一键脚本）

把最新代码更新到服务器，双击仓库根目录的 `服务器更新.bat` 即可，它会依次完成：

1. 备份 `server\.env`
2. `git fetch` + `git reset --hard origin/main`
3. 还原 `server\.env`
4. `cd server && npm install --omit=dev`
5. 停止旧服务 → 启动新服务
6. 请求本机接口自检

> **⚠ 关键注意：`git pull/reset` 会删掉 `server\.env`**
>
> `.env` 已从版本控制移除（此前它带着数据库口令被推到了公开仓库）。
> 服务器上那份 `.env` 属于本地文件，**任何一次拉取都会把它删除**，
> 必须在拉取后立即还原，否则 `启动.bat` 会直接报「缺少 server\.env」而拒绝启动。
> `服务器更新.bat` 已内置「备份 → 拉取 → 还原」三步，手工操作时务必照做。

手工执行等价命令（在仓库根目录）：

```bat
copy /Y server\.env server\.env.keep
git fetch origin
git reset --hard origin/main
copy /Y server\.env.keep server\.env
cd server
npm install --omit=dev
cd ..
call 停止.bat quiet
start "code-shop商城" /D "%CD%\server" cmd /k "node src\index.js"
```

说明：

- 用 `git reset --hard origin/main` 而不是 `git pull`：服务器上可能因本地构建
  产生 `web/dist` 差异，`pull` 会因冲突中断，`reset --hard` 以远端为准更省事。
  该命令不会删除未跟踪文件，因此 `server\uploads\` 里的图片不受影响。
- **前端不需要在服务器上构建**：`web/dist` 构建产物已入库，
  拉取后即为最新前端。只有在服务器上改了前端源码才需要 `cd web && npm run build`。
- 仅当库表结构有变更时才需要 `node src/init.js`（它会补建缺失的表，
  例如 `visit_logs`；重复执行是安全的）。

### 1.3 可选：PM2（需常驻守护时）

```bat
npm install -g pm2
pm2 start ecosystem.config.js
pm2 save
```

---

## 二、Linux 一键启动

```bash
chmod +x start.sh stop.sh
./start.sh    # 后台启动，日志 server/logs/out.log
./stop.sh     # 停止
```

---

## 三、备份与恢复

### 3.1 手动备份

```bash
cd server
npm run backup
```

备份写入 `server/backups/`（SQL + uploads 副本，超过 7 天自动清理）。

### 3.2 Windows 每日备份计划任务

```bat
schtasks /create /tn "code-shop-backup" /tr "cmd /c cd /d D:\code-shop\server && npm run backup" /sc daily /st 02:00 /ru SYSTEM
```

路径按实际安装目录修改。

### 3.3 恢复

```bash
mysql -h 127.0.0.1 -u root -p code_shop < server/backups/code_shop-YYYYMMDD-HHmmss.sql
```

uploads：

```bat
robocopy server\backups\uploads-YYYYMMDD server\uploads /E
```

然后双击 `停止.bat` → `启动.bat`。

详细演练见 [backup-restore.md](./backup-restore.md)。

---

## 四、常见问题

### 4.1 端口占用

查看 `server/.env` 中的 `PORT`（常见 8080）。Windows：

```bat
netstat -ano | findstr :8080
```

### 4.2 MySQL 连接失败

- 确认 MySQL 已启动，账号密码与 `server/.env` 一致
- 服务与数据库同机时，`DB_HOST` 用 `127.0.0.1`
- 首次部署确认已执行 `node src/init.js`

### 4.3 前端空白或 404

- 确认存在 `web/dist/index.html`
- 后端会自动托管 `web/dist`，改前端后需重新 `npm run build`

### 4.4 JWT_SECRET 修改

改 `server/.env` 后重启服务；已登录用户需重新登录。

### 4.5 备份失败

确认 `mysqldump` 在 PATH 中，或设置环境变量 `MYSQLDUMP` 为完整路径。

---

## 五、慢查询日志

MySQL `my.ini` / `my.cnf`：

```ini
slow_query_log=ON
slow_query_log_file=mysql-slow.log
long_query_time=1
```

应用层：在 `server/.env` 设置 `SLOW_QUERY_MS=500`（毫秒），重启后生效。
