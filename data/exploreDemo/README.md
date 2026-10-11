# 探索 Demo 数据

本目录在公开仓库中只保留**空 stub**，避免地点调查等个人数据进入 Gitee。

## 本机如何生效

应用会优先从数据根读取：

```text
<KBIRD_DATA_ROOT>/personal/exploreDemo/
  leping.js
  projects.js
  speciesOrders.js
```

一般即仓库同级的 `KBird-Data/personal/exploreDemo/`（或 `.env` 里的 `KBIRD_DATA_ROOT`）。  
**不必再复制回 `data/exploreDemo/`**；接口 `GET /api/personal/explore-demo/projects` 会自动读个人目录，缺失时才回落仓库 stub。

## 推送前

确认不要把个人 `exploreDemo` 内容提交进仓库。可跑：

```bash
node scripts/check-share-hygiene.js
```
