# KBird 分享到 Gitee 指南

将 **程序 + 可公开数据** 同步到 Gitee；个人观鸟数据留在本机。分层说明见 [DATA_ISOLATION.md](./DATA_ISOLATION.md)。

仓库示例：`https://gitee.com/fralium/kbird.git`（以你账号下实际仓库为准）。

## 推送前检查清单（必做）

在**项目根目录**执行：

1. **刷新公开鸟种种子（文字 only）**
   ```powershell
   node scripts/export-public-bird-seed.js
   ```
2. **确认探索 demo 仍是 stub**（勿把 `KBird-Data/personal/exploreDemo` 覆盖后的个人内容提交）
3. **`git status` 确认不会进入暂存区的内容**
   - `uploads/`、`public/images/`、`KBird-Data/`
   - `seeds/birds-array.json`（本机完整种子）
   - `.env`、Mongo dump、地点/记录导出、xlsx
4. **确认可以进仓库的内容**
   - `seeds/birds-public.json`
   - `public/hero-*.png`、`public/background/`
   - 程序与静态参考 `data/*.js`（非 explore 个人内容）
5. 抽查公开种子若干条：无 `images` / `calls` / `sightings` / `createdBy`

```powershell
git check-ignore -v seeds/birds-array.json uploads KBird-Data
git status --short
```

可选自检（扫本机路径 / 密钥字面量）：

```powershell
node scripts/check-share-hygiene.js
```

确认无误后再 `git add` / `commit` / `push`（本指南不自动推送）。

## 仓库应包含 / 不应包含

| 应包含 | 不应包含 |
|--------|----------|
| 应用代码、文档、脚本 | 地点库、各地鸟种（Mongo） |
| `seeds/birds-public.json` | `seeds/birds-array.json`、鸟种照片 |
| AI 封面与首页背景图 | 自留地、探索 demo 真实数据 |
| 分类/保护等级等静态参考 | 观察记录、清单、目标、uploads |

他人 clone 后：有鸟种**文字名录**，无你的照片与地点；地点与记录各自在本机积累。

## 准备工作

1. 注册 [Gitee](https://gitee.com) 并新建空仓库（不要勾选初始化 README）
2. 记下 HTTPS 或 SSH 地址
3. 本机已安装 Git、Node.js ≥ 20.9

## 方法一：使用自动化脚本

若仓库内仍有 `scripts/gitee-share.ps1`，可在完成上方检查清单后，于项目根目录运行（把地址换成你的仓库）：

```powershell
.\scripts\gitee-share.ps1 -GiteeRepo "https://gitee.com/<user>/kbird.git"
```

脚本会提交当前已跟踪变更；**仍须先保证个人数据被 .gitignore 挡住**。不确定时改用下方手动步骤。

## 方法二：手动推送（推荐）

在项目根目录：

```powershell
# 1) 导出公开种子
node scripts/export-public-bird-seed.js

# 2) 查看将要提交的文件
git status

# 3) 按需添加（示例）
git add seeds/birds-public.json public/hero-*.png public/background
git add .gitignore docs README.md scripts/export-public-bird-seed.js
# …以及本次要分享的程序变更

# 4) 提交并推送（需你确认）
git commit -m "Share program and public bird text seed"
git remote add origin https://gitee.com/<user>/kbird.git  # 若尚无 remote
git push -u origin HEAD
```

切勿 `git add -f` 强制添加已被忽略的个人文件。

文档与示例中的路径一律用「项目根 / 相对路径 / 环境变量」，不要写死本机盘符目录。

## 用户下载和使用

```bash
git clone https://gitee.com/<user>/kbird.git
cd kbird
npm install
cp env.example .env
# 配置 MongoDB 等
```

Windows 可用 `scripts/windows/install.ps1` 与 `KBird-Start.bat`。数据库初始化会优先导入 `seeds/birds-public.json`（无名录照片）。

详见根目录 [README.md](../README.md)。

## 常见问题

### 认证失败

使用 HTTPS 时配置 Gitee 私人令牌，或改用 SSH 公钥（Gitee → 设置 → SSH 公钥）。

### 误提交了个人数据

立即停止继续推送；从 Git 历史中移除该文件并轮换任何泄露的密钥。本地用 `KBird-Data` 备份恢复业务数据。

### 公开种子需要更新

改完本机名录文字字段后重新运行 `node scripts/export-public-bird-seed.js`，再提交 `seeds/birds-public.json`。
