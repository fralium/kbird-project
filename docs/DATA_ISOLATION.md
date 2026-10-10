# 个人数据隔离与自动备份

目标：代码与可公开名录进 Gitee，隐私数据留在本机数据根。

**本仓库目录只当程序用。** 个人媒体、备份、完整种子、`.env` 均在忽略列表或仓库外 `KBird-Data`。推送前可跑：`node scripts/check-share-hygiene.js`。

## 三层数据模型

| 层 | 是否进 Gitee | 内容 |
|---|---|---|
| **程序** | 是 | `app/`、`components/`、`server/`、静态参考（分类翻译、保护等级、别名、行政区等） |
| **可公开数据** | 是 | **鸟种文字种子** [`seeds/birds-public.json`](../seeds/birds-public.json)；AI 封面（`public/hero-*.png`）；首页 [`public/background/`](../public/background/) |
| **个人** | 否 | 地点、各地鸟种、自留地、探索 demo 真实数据、观察记录/清单/目标、uploads 与鸟种照片、`KBird-Data` |

### 版权与照片策略

- 公开种子**只含文字**（中文名、学名、分类、保护等级、描述等），**不含**照片、鸣声、观察记录。
- 鸟种照片由使用者在本机自行添加。
- **未来升级**：可逐步替换为无版权公开图并纳入公开种子；当前不做。

### 导出公开种子

在项目根目录执行：

```powershell
node scripts/export-public-bird-seed.js
# 或从 Mongo：node scripts/export-public-bird-seed.js --mongo
```

初始化优先读取 `seeds/birds-public.json`，兼容本机完整种子 `seeds/birds-array.json`（后者 gitignore，勿推）。

### 探索 demo

仓库内 [`data/exploreDemo/`](../data/exploreDemo/) 仅为空 stub。个人数据建议放在数据根：

```text
<KBIRD_DATA_ROOT>/personal/exploreDemo/
```

恢复方式见 [`data/exploreDemo/README.md`](../data/exploreDemo/README.md)。

## 数据根布局

与仓库**同级**（不要写进仓库目录）。安装脚本会自动创建并写入 `.env`：

```text
…/KBird/                 ← 代码 + 可公开数据（可推 Gitee）
…/KBird-Data/            ← 个人数据（勿推；install / ensure-kbird-data 自动建）
  uploads/               照片 / 头像 / 项目附件
  backups/               自动 zip 备份包
  mongo-dumps/           mongodump 临时目录
  personal/              其它个人导出（含 exploreDemo）
```

```powershell
node scripts/ensure-kbird-data.js
```

会设置 `KBIRD_DATA_ROOT` 与 `UPLOAD_PATH`（绝对路径，仅本机 `.env`，勿提交）。一般用户不必手改。
## 一次迁移（已有 uploads 时）

在项目根目录：

```powershell
.\scripts\migrate-uploads-to-data-root.ps1
```

会把仓库内 `uploads/` 挪到 `KBird-Data/uploads`，并写入 `KBIRD_DATA_ROOT`。然后重启服务。

## 定期备份（含 MongoDB）

双击根目录 **`KBird-Backup.bat`**（或跑下方脚本）：备份 **uploads + MongoDB**，打成 zip。

需已安装 MongoDB 服务，以及 [MongoDB Database Tools](https://www.mongodb.com/try/download/database-tools)（`mongodump`）。缺任一者时脚本会**停止并提示安装**（可打开下载页）；仅备文件时可加 `-SkipMongo`。

```batch
KBird-Backup.bat
```

```powershell
.\scripts\backup-personal-data.ps1
# 只保留最近 14 份：
.\scripts\backup-personal-data.ps1 -Keep 14
```

输出：`<KBIRD_DATA_ROOT>\backups\kbird-backup-YYYYMMDD-HHMMSS.zip`  
内容含：`mongo/` dump + `uploads/` + `backup-meta.json`。

### Windows 计划任务（建议每天）

1. 打开「任务计划程序」→ 创建基本任务  
2. 触发器：每天（如 02:30）  
3. 操作：启动程序  
   - 程序：`powershell.exe`  
   - 参数：`-NoProfile -ExecutionPolicy Bypass -File "<你的项目路径>\scripts\backup-personal-data.ps1" -NoPause`  

## 与应用内「数据管理 → 备份」的关系

| 方式 | 内容 | 用途 |
|------|------|------|
| 应用内 JSON 档案包 | 记录/清单/设置等（可选嵌媒体） | 账号级导入导出 |
| `backup-personal-data.ps1` | 整库 mongodump + 磁盘 uploads | 整机灾难恢复 |

两者都建议做；计划任务跑脚本即可防丢。
