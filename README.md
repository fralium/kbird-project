# KBird

本机观鸟笔记本：整理鸟种名录、记观察、存照片、看地区名录与个人统计。默认**单机自用**（本机账号、不开放多人社交）。

仓库地址：https://gitee.com/fralium/kbird.git

## 数据怎么分

| 层 | 是否进仓库 | 内容 |
|---|---|---|
| 程序 | 是 | 代码、分类/保护等级/别名等静态参考 |
| 可公开数据 | 是 | 鸟种**文字**种子、AI 封面、首页背景 |
| 个人 | 否 | 地点、各地鸟种、自留地、探索 demo、记录、照片、MongoDB |

Clone 后只有名录文字，**没有**别人的照片和地点。MongoDB 在各自本机自动建库（见 `.env` 里的 `MONGODB_URI`）。说明见 [docs/DATA_ISOLATION.md](docs/DATA_ISOLATION.md)。

## 功能概览

- 鸟种名录（中文名 / 学名 / 分类 / 保护等级 / 别名）
- 观察记录、地点、自留地与个人项目
- 照片与鸣声（本机上传）
- 个人统计、清单、目标；可选导出 eBird / CBRC
- 各地鸟种名录；可选地图（天地图 / 百度等，需自备 Key）
- 可选 AI 识鸟与对话草稿（自备兼容 API Key）

## 环境要求

- Windows 10/11（推荐；一键脚本按 Windows 写）
- Node.js **≥ 20.9**
- MongoDB 4.4+（本机服务）

## 安装（新人 / 空库）

```powershell
git clone https://gitee.com/fralium/kbird.git
cd kbird

# 检查 Node / 引导依赖（建议管理员 PowerShell）
.\scripts\windows\install.ps1

# 如未安装 MongoDB
.\scripts\windows\setup-mongodb.ps1

npm install
copy env.example .env
# 按需改 MONGODB_URI；库名不存在时首次写入会自动创建

# 导入公开鸟种文字种子（seeds/birds-public.json）
.\scripts\windows\init-database.ps1
```

启动：

```batch
KBird-Desktop.bat
```

浏览器打开 http://localhost:13080 ，首次走 `/init` 创建本机管理员。

更细的 Windows 说明：[docs/WINDOWS_QUICK_START.md](docs/WINDOWS_QUICK_START.md)

### 开发时分别启动

需同时开后端（13082）和前端（13080）：

```powershell
npm run server
npm run dev
```

## 配置要点

复制 `env.example` 为 `.env`。常用项：

- `MONGODB_URI` — 本机库，例如 `mongodb://localhost:27017/kbird`
- `KBIRD_DATA_ROOT` — 个人数据根（建议仓库外；不配则默认同级 `../KBird-Data`），含 uploads / 备份
- `PORT` / `NEXT_PUBLIC_API_URL` / `SITE_URL` — 默认 13082 / 13080
- AI、地图 Key — 见 `env.example` 注释与 [docs/MAP_SETUP.md](docs/MAP_SETUP.md)

## 备份

个人数据在 MongoDB + `KBIRD_DATA_ROOT`（或仓库内 `uploads/`）。推荐：

```powershell
.\scripts\backup-personal-data.ps1
```

详见 [docs/DATA_ISOLATION.md](docs/DATA_ISOLATION.md)。

## 把代码推到 Gitee

推送前导出公开种子、确认无个人文件：见 [docs/GITEE_SHARE_GUIDE.md](docs/GITEE_SHARE_GUIDE.md)。

```powershell
node scripts/export-public-bird-seed.js
```

## 文档索引

见 [docs/README.md](docs/README.md)。

## 许可证

个人观鸟工具；分发与使用时请遵守第三方地图 / AI API 与鸟种资料的版权约定。公开种子仅含文字名录。
