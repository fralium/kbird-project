# KBird 脚本说明

日常启动请用仓库根目录的 `KBird-Start.bat` / `KBird-Start-Prod.bat` / `KBird-Stop.bat`（薄封装，实际逻辑在 `scripts/windows/`）。

## Windows 本地运行

- **windows/install.ps1** — 首次安装（Node、依赖、`KBird-Data`）
- **windows/setup-mongodb.ps1** — 配置/安装 MongoDB 服务
- **windows/init-database.ps1** — 导入公开鸟种文字种子
- **windows/KBird-Start.bat** / **KBird-Start-Prod.bat** / **KBird-Stop.bat** — 启停（根目录同名 bat 会转调这里）
- **windows/update.ps1** — `git pull` + `npm install`（根目录 `KBird-Update.bat`）
- **windows/create-desktop-shortcut.ps1** — 桌面快捷方式
- **windows/kill-port.ps1** / **kill-port.bat** — 按端口结束进程
- **start-windows.ps1** / **.bat**、**stop-windows.ps1** / **.bat** — 其它启停入口

## 生产 / 缓存

- **start-production-windows.ps1** / **.bat** — Windows 生产启动
- **start-production.sh** — Linux 生产启动（concurrently / 非根目录 PM2 旧脚本）
- **clear-cache.ps1** / **.bat** — 清除 `.next` 等缓存
- **tag-stable.ps1** / **.sh**、**rollback-to-stable.ps1** / **.sh** — 稳定标签与回滚

## 数据与运维

- **backup-personal-data.ps1** / **.bat** — 备份个人数据（根目录 `KBird-Backup.bat`）
- **ensure-kbird-data.js**、**migrate-uploads-to-data-root.ps1** — 数据根目录
- **export-public-bird-seed.js**、**export-birds*.js** — 种子导出
- **sync-birds-from-cnbirdlist-2024.js**、**normalize-*.js**、**merge-record-locations-by-name.js** 等 — 名录/地址维护
- **reset-admin-password.js**、**reset-user-password.js** — 密码重置
- **check-share-hygiene.js**、**check-imports.js**、**check-missing-taxonomy-names.js** — 检查
- **generate-jwt-secret.js** — 生成 JWT 密钥
- **sync-to-server.ps1** / **.sh** — 同步到服务器（按需）

## 已归档（本机 `temp/`，不进 git）

- **temp/scripts-archive/** — 一次性数据整理脚本（sanyou、stub 统计等）
- **temp/linux-pm2/** — 原根目录 PM2 版 `start.sh` / `stop.sh` / `restart.sh`
- **temp/docs-archive/** — 旧部署/回归文档

环境变量见根目录 `env.example` 与 `README.md`。
