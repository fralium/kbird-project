# KBird Windows 本地快速开始指南

## 🚀 快速安装（5分钟）

### 方法一：一键安装（推荐）

1. **运行安装脚本**
   ```powershell
   # 以管理员身份打开 PowerShell，进入克隆后的项目目录
   .\scripts\windows\install.ps1
   ```

2. **配置 MongoDB**（如果未安装）
   ```powershell
   .\scripts\windows\setup-mongodb.ps1
   ```

3. **导入公开鸟种文字种子**（空库首次）
   ```powershell
   copy env.example .env
   .\scripts\windows\init-database.ps1
   ```

4. **启动应用**
   ```batch
   KBird-Desktop.bat
   ```

### 方法二：手动安装

#### 1. 安装依赖

**Node.js**
- 下载：https://nodejs.org/zh-cn/download/
- 安装 **20.9 或更高**（推荐 LTS；Next.js 16 要求 ≥ 20.9）
- 验证：`node --version`（应 ≥ v20.9.0）

**MongoDB**
- 下载：https://www.mongodb.com/try/download/community
- 安装 MongoDB Community Edition
- 配置为 Windows 服务

#### 2. 安装项目依赖

```bash
npm install
```

#### 3. 配置环境变量

```bash
# 复制环境变量模板
copy env.example .env

# 编辑 .env 文件（可选）
# 默认配置已适合本地使用
```

#### 4. 初始化数据库（空库建议必做）

导入仓库内 `seeds/birds-public.json`（仅文字名录）：

```powershell
.\scripts\windows\init-database.ps1
```

#### 5. 启动应用

```bash
# 开发模式
npm run dev

# 或使用启动脚本
.\scripts\windows\KBird-Desktop.bat
```

## 📋 使用说明

### 启动应用

**方式一：使用批处理脚本（推荐）**
```batch
KBird-Desktop.bat
```
- 自动检查依赖
- 自动启动 MongoDB 服务
- 自动启动前后端服务
- 自动打开浏览器

**方式二：使用 PowerShell 脚本**
```powershell
.\scripts\windows\KBird-Desktop.bat
```

**方式三：手动启动**
```bash
# 终端1 - 启动后端
npm run server

# 终端2 - 启动前端
npm run dev
```

### 停止应用

**方式一：使用批处理脚本**
```batch
KBird-Stop.bat
```

**方式二：手动停止**
- 关闭命令行窗口
- 或按 `Ctrl+C` 停止服务

### 访问应用

- **前端界面**：http://localhost:13080
- **后端API**：http://localhost:13082

## ⚙️ 配置选项

### 单用户模式（个人使用）

编辑 `.env` 文件：

```env
# 启用单用户模式
SINGLE_USER_MODE=true
DEFAULT_USER=admin
AUTO_LOGIN=true

# 禁用注册功能
ENABLE_REGISTRATION=false
```

### 数据库与密钥

库名、地图/AI Key 优先用 GUI（`/init` 或 **个人设置 → 服务与密钥**），不必手改。手改时：

```env
# MongoDB 连接（默认本地）
MONGODB_URI=mongodb://localhost:27017/kbird

# 如果使用远程数据库
# MONGODB_URI=mongodb://username:password@host:port/database
```

改完后重启 `KBird-Desktop.bat`。

### 端口配置

```env
# 后端端口
PORT=13082

# 前端端口（在 package.json 中配置）
# 默认: 13080
```

## 🔧 常见问题

### 1. MongoDB 服务无法启动

**解决方案**：
```powershell
# 检查服务状态
Get-Service MongoDB

# 手动启动服务
net start MongoDB

# 如果服务不存在，运行配置脚本
.\scripts\windows\setup-mongodb.ps1
```

### 2. 端口被占用

**解决方案**：
```bash
# 查看端口占用
netstat -ano | findstr :13080
netstat -ano | findstr :13082

# 修改端口（在 .env 文件中）
PORT=13083  # 修改后端端口
```

### 3. 依赖安装失败

**解决方案**：
```bash
# 清除缓存
npm cache clean --force

# 删除 node_modules 重新安装
rmdir /s /q node_modules
npm install
```

### 4. 数据库连接失败

**检查清单**：
- [ ] MongoDB 服务是否运行：`net start MongoDB`
- [ ] 端口是否正确：默认 27017
- [ ] `.env` 文件中的 `MONGODB_URI` 是否正确
- [ ] 防火墙是否阻止连接

## 📦 数据管理

### 备份数据

推荐双击根目录：

```batch
KBird-Backup.bat
```

会备份照片（uploads）+ 数据库（mongodump），zip 在同级 `KBird-Data\backups\`。  
未装 MongoDB 或 Database Tools 时会提示安装。仅备文件：`.\scripts\backup-personal-data.ps1 -SkipMongo`。

### 恢复数据

```powershell
# 恢复数据库
mongorestore --db kbird ./backups/backup-20250101/kbird
```

### 导入种子数据

```powershell
.\scripts\windows\init-database.ps1
```

## 更新程序（git 安装）

已 clone 并在用的电脑，收到新版本后：

1. 关闭本机 KBird（或先让升级脚本停 Node）
2. 双击根目录 `KBird-Update.bat`，或运行：

```powershell
.\scripts\windows\update.ps1
```

3. 再开 `KBird-Desktop.bat`

说明：

- 只更新程序与依赖；`.env`、同级 `KBird-Data`、Mongo 个人数据保留
- **一般不必**重新 `/init`
- 本地有未提交改动时脚本会询问；可用 `-Force` 继续
- 可选：`.\scripts\windows\update.ps1 -SkipNpm`（仅 pull）

## 下一步

1. 运行 `init-database.ps1` 导入公开鸟种文字种子（空库建议）
2. 启动后访问 `/init`：创建管理员；可在向导里写库名与可选地图/AI Key（写入本机 `.env`）
3. 以后更新密钥：管理员本机打开 **个人设置 → 服务与密钥**（仅 127.0.0.1）
4. 改完 `.env`（GUI 或手改）后重启 `KBird-Desktop.bat` 才会生效
5. 数据目录等仍可由 `install.ps1` / `env.example` 中的 `KBIRD_DATA_ROOT` 管理，不走 GUI

## 相关文档

- [数据隔离与备份](DATA_ISOLATION.md)
- [Gitee 推送检查](GITEE_SHARE_GUIDE.md)
- [故障排除](TROUBLESHOOTING.md)
- [文档索引](README.md)

## 提示

- 首次：先跑 `install.ps1`，再 `init-database.ps1`
- 日常：双击根目录 `KBird-Desktop.bat`
- 开发：后端 `npm run server`，前端 `npm run dev`
