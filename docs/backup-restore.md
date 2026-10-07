# code-shop 备份与恢复演练

精简版操作手册，用于日常备份验证与灾难恢复演练。

---

## 备份清单

每次备份应包含以下两部分：

| 项目 | 路径 / 文件 | 说明 |
|------|-------------|------|
| 数据库 | `server/backups/code_shop-YYYYMMDD-HHmmss.sql` | mysqldump 全库导出 |
| 上传文件 | `server/backups/uploads-YYYYMMDD/` | 商品封面等 `server/uploads` 副本 |

执行命令：

```bash
cd D:\code-shop\server
npm run backup
```

---

## 每日备份建议

- **频率**：每天至少 1 次（建议凌晨低峰期）
- **保留**：脚本自动清理 7 天前的备份
- **异地**：定期将 `server/backups/` 复制到网盘或其他服务器
- **监控**：检查备份文件大小是否正常（空文件或极小文件说明导出失败）

Windows 计划任务示例：

```bat
schtasks /create /tn "code-shop-backup" /tr "cmd /c cd /d D:\code-shop\server && npm run backup" /sc daily /st 02:00
```

---

## 恢复演练步骤

建议在测试环境或非生产时段定期演练，确认备份可用。

### 步骤 1：准备测试库

```bash
mysql -u root -p123456 -e "CREATE DATABASE IF NOT EXISTS code_shop_restore_test;"
```

### 步骤 2：导入数据库备份

```bash
mysql -u root -p123456 code_shop_restore_test < D:\code-shop\server\backups\code_shop-YYYYMMDD-HHmmss.sql
```

验证表数量：

```bash
mysql -u root -p123456 -e "SELECT COUNT(*) AS products FROM code_shop_restore_test.products;"
```

### 步骤 3：恢复 uploads（可选）

```bash
# 演练时可恢复到临时目录
robocopy D:\code-shop\server\backups\uploads-YYYYMMDD D:\code-shop\server\uploads-restore-test /E
```

### 步骤 4：验证应用（可选）

临时修改 `.env` 中 `DB_NAME=code_shop_restore_test`，启动后端检查数据是否正常，完成后改回并删除测试库。

### 步骤 5：清理

```bash
mysql -u root -p123456 -e "DROP DATABASE code_shop_restore_test;"
```

---

## 验证方法

### 备份文件大小

```bash
# PowerShell
Get-ChildItem D:\code-shop\server\backups\*.sql | Sort-Object LastWriteTime -Descending | Select-Object -First 3 Name, Length, LastWriteTime
```

正常情况：SQL 文件应大于数 KB（有商品数据时通常为数 MB）。若文件为 0 字节或仅几百字节，备份失败。

### 可导入测试库

按上述「恢复演练步骤 1-2」导入到 `code_shop_restore_test`，确认：

- [ ] 导入无报错
- [ ] `products` 表有数据（`SELECT COUNT(*) FROM products`）
- [ ] `users` 表存在管理员记录
- [ ] `orders` 等核心业务表结构完整

### uploads 完整性

对比备份目录与源目录文件数量：

```bash
# PowerShell
(Get-ChildItem D:\code-shop\server\uploads -Recurse -File).Count
(Get-ChildItem D:\code-shop\server\backups\uploads-YYYYMMDD -Recurse -File).Count
```

两者应一致（或备份日为当日时接近）。

---

## 生产环境恢复（简要）

1. 停止服务：双击 `停止.bat`，或 `pm2 stop code-shop-server`
2. 导入最新 SQL 备份到 `code_shop` 库
3. 用备份的 `uploads-YYYYMMDD` 覆盖 `server/uploads`
4. 重启服务并验证前台页面、登录、商品列表

完整说明见 [deploy.md](./deploy.md) 第三节。
