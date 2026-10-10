# 探索 Demo 数据

本目录在公开仓库中只保留**空 stub**，避免地点调查等个人数据进入 Gitee。

## 本机恢复个人数据

若已备份到数据根（与仓库同级的 `KBird-Data`，或 `.env` 中的 `KBIRD_DATA_ROOT`）：

```text
<KBIRD_DATA_ROOT>/personal/exploreDemo/
  leping.js
  projects.js
  speciesOrders.js
```

在**项目根目录**覆盖回本目录即可（覆盖后勿 `git add` 这些文件的个人内容）：

```powershell
$root = $env:KBIRD_DATA_ROOT
if (-not $root) { $root = Join-Path (Split-Path (Get-Location)) 'KBird-Data' }
Copy-Item (Join-Path $root 'personal\exploreDemo\*.js') .\data\exploreDemo\ -Force
```

推送前请确认 `git diff data/exploreDemo` 仍是 stub，或先还原 stub 再提交。
