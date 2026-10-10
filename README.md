# KBird

本机观鸟笔记本：整理鸟种名录、记观察、存照片、看地区名录与个人统计。默认**单机自用**。

仓库：https://gitee.com/fralium/kbird.git

## 你会得到什么

Clone 后有程序和鸟种**文字**名录；**没有**别人的照片、地点和观察记录。那些都在各自本机积累。

| 进仓库 | 不进仓库（本机私有） |
|--------|----------------------|
| 程序、文字名录、AI 封面 / 首页背景 | 地点、各地鸟种、自留地、探索数据、记录、照片、MongoDB |

## 功能

- 鸟种名录（中文名 / 学名 / 分类 / 保护等级 / 别名）
- 观察记录、地点、自留地与个人项目
- 照片与鸣声（本机上传）
- 个人统计、清单、目标；可选导出 eBird / CBRC
- 各地鸟种名录；可选地图、AI（需自备 Key）

## 环境

- Windows 10 / 11
- Node.js **≥ 20.9**
- MongoDB 4.4+（本机服务）

## 安装与启动（到这里即可日常使用）

在**管理员** PowerShell 中：

```powershell
git clone https://gitee.com/fralium/kbird.git
cd kbird

.\scripts\windows\install.ps1
# 若还没有 MongoDB：
.\scripts\windows\setup-mongodb.ps1

# 空库首次：导入公开鸟种文字种子
.\scripts\windows\init-database.ps1
```

`install.ps1` 会自动在仓库**同级**创建 `KBird-Data`（含 `uploads` 等），并写入 `.env`，一般不用手改路径。

之后每次启动只需双击（或在项目根目录运行）：

```batch
KBird-Desktop.bat
```

浏览器打开 http://localhost:13080 即可使用。后端会按默认自动就绪本机数据与管理员（单机自动登录）；密码可在 **个人设置** 里修改。地图/AI Key 可在 **设置 → 服务与密钥** 补。`/init` 仅为特殊重配页，会提示覆盖原有设置，日常不必打开。

停止可用 `KBird-Stop.bat`。

## 更新程序（已安装用户）

有新版本时，先关掉本机 KBird，再双击或在项目根目录运行：

```batch
KBird-Update.bat
```

等价 PowerShell：

```powershell
.\scripts\windows\update.ps1
```

脚本会：停止 Node → `git pull` → `npm install` → 检查 `KBird-Data` 路径。  
**不会**覆盖 `.env`、个人数据、MongoDB 记录；一般**不必**再走 `/init`。完成后重新运行 `KBird-Desktop.bat`。

更细的步骤：[docs/WINDOWS_QUICK_START.md](docs/WINDOWS_QUICK_START.md)  
数据与备份：[docs/DATA_ISOLATION.md](docs/DATA_ISOLATION.md)  
全部文档：[docs/README.md](docs/README.md)

## 可选配置

`install.ps1` 会生成 `.env` 并自动设好与仓库同级的 `KBird-Data`。日常不必手改 `.env`：

- 管理员在本机打开 **个人设置 → 服务与密钥** 更新地图/AI（仅 127.0.0.1）
- 保存后重启 `KBird-Desktop.bat`，`NEXT_PUBLIC_*` 与多数服务端配置才会生效
- 手改说明仍见 `env.example` 与 [docs/MAP_SETUP.md](docs/MAP_SETUP.md)

备份个人数据（照片 uploads + MongoDB，打成 zip）：

```batch
KBird-Backup.bat
```

或：`.\scripts\backup-personal-data.ps1`  
zip 在同级 `KBird-Data\backups\`。若未装 MongoDB / Database Tools（`mongodump`），脚本会提示安装下载页。

## 版权说明

公开种子只含文字名录；照片请本机自加。使用地图 / AI 时请遵守对应服务商条款。

---

## 开发说明（一般用户可忽略）

以下供改代码、排障或非 bat 启动时使用。日常观鸟**不必**看本节。

### 手动分进程启动

`KBird-Desktop.bat` 内部等价于同时开：

```powershell
npm run server   # 后端 API，端口 13082
npm run dev      # 前端 Next，端口 13080
```

两个都要开着；只开前端会出现连不上服务端。

### 常用开发命令

```powershell
npm install
npm run lint
npm test
npm run build
npm run start          # 生产模式前端（配合已构建产物）
```

生产向一键启动（若使用）：`KBird-Desktop-Prod.bat`。

### 环境变量（开发）

| 变量 | 含义 |
|------|------|
| `MONGODB_URI` | 默认 `mongodb://localhost:27017/kbird` |
| `PORT` | 后端，默认 `13082` |
| `NEXT_PUBLIC_API_URL` | 前端访问的 API，默认 `http://localhost:13082` |
| `SITE_URL` | 前端地址，默认 `http://localhost:13080` |
| `KBIRD_DATA_ROOT` | 个人 uploads / 备份根目录 |

完整注释见 `env.example`。

### 公开名录与推送 Gitee

更新可分享的鸟种文字种子：

```powershell
node scripts/export-public-bird-seed.js
```

推送前检查个人路径 / 密钥字面量：

```powershell
node scripts/check-share-hygiene.js
```

清单见 [docs/GITEE_SHARE_GUIDE.md](docs/GITEE_SHARE_GUIDE.md)。
