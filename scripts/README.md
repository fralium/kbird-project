# KBird 脚本说明

本目录包含开发、部署与运维相关脚本，按用途分类如下。

## Windows 本地运行

- **windows/install.ps1** - 首次安装（Node、依赖等）
- **windows/setup-mongodb.ps1** - 配置/安装 MongoDB 服务
- **windows/KBird-Desktop.bat** - 启动前后端并打开浏览器（推荐从项目根目录运行 `KBird-Desktop.bat`）
- **windows/KBird-Stop.bat** - 停止前后端窗口
- **windows/kill-port.ps1** / **kill-port.bat** - 按端口结束进程
- **start-windows.ps1** / **start-windows.bat** / **stop-windows.ps1** 等 - 启动/停止的其它入口

## 生产/部署

- **start-production.sh** - Linux 生产启动
- **start-production-windows.ps1** / **.bat** - Windows 生产启动
- **deploy.sh** - 通用部署
- **docker-deploy.sh** - Docker 部署
- **deploy-to-gitee.ps1** - 部署到 Gitee
- **get-public-ip.sh** - 获取本机公网 IP（部署时有用）
- **tag-stable.ps1** / **tag-stable.sh** - 创建稳定版本标签并记录到 `.last-stable-tag`
- **rollback-to-stable.ps1** / **rollback-to-stable.sh** - 快速切换到最近稳定标签

## 缓存与维护

- **clear-cache.ps1** / **clear-cache.bat** - 清除 Next.js `.next` 等缓存
- **reset-admin-password.js** - 重置管理员密码（需配置好 MongoDB 与 .env）
- **reset-user-password.js** - 按用户名或邮箱重置任意用户密码（忘记密码时用）
- **auto-update.ps1** - 自动更新相关逻辑

## 数据与同步

- **compare_csv.py** - 比较 CSV 文件
- **extract-birds.js** - 从数据中提取鸟类信息
- **sync-to-server.ps1** / **sync-to-server.sh** - 同步到服务器
- **sync-git.ps1**、**sync-changes.ps1**、**sync-to-release.ps1** 等 - 各类 Git/发布同步，按需选用

## Git 与 Gitee

- **git-config-setup.ps1** / **git-config-setup.sh** - 仓库与 Git 配置
- **gitee-share.ps1** / **gitee-share-simple.ps1** - Gitee 分享相关

脚本如需环境变量，请参考项目根目录 `env.example` 与 `README.md`。
