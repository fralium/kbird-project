# KBird 第三方审核报告（第 6 轮 · 严格复审至无明显问题）

- **日期：** 2026-10-14  
- **版本：** v1.1.1（主干）  
- **方法：** 第 5 轮收口后再扫残留 P0–P2，当场修复可修项  
- **交互报告：** [Canvas](file:///C:/Users/frali/.cursor/projects/d-CADD-AIDD-KBird/canvases/kbird-third-party-audit-r6.canvas.tsx)

---

## 总评（诚实分）

| 项 | 第 5 轮 | 第 6 轮后 |
|----|--------|----------|
| **综合 /100** | ~95 | **~97** |
| 安全 | ~95 | **~97** |
| 后端 | ~94 | **~97** |
| 前端/设计 | ~94 | **~94** |
| 运维/桌面 | ~93 | **~93** |

威胁模型：本机单用户桌面。LAN/公网另计（约再低 10–15 分）。**无明显 P0；无新安全漏洞级问题。**

---

## 本轮审核发现并已修

| ID | 问题 | 修复 |
|----|------|------|
| BE | `applyImport` 写库后未清公开缓存 | 三路径统一 `bustCachesAfterImport()`（含 locations/birds/排行榜） |
| BE | 导入 preview/apply 向客户端抛 `error.message` | `sendControllerError` |
| BE | 搜索 `/hot`、`/` 500 响应带 `error.message` | 同上 |
| BE | 热门地点 enrichment 无界 `Location.find({status:'active'})` | 仅对聚合结果（≤50）`findActiveLocationByFlexibleName` |
| BE | 地点按统计排序无硬顶 | `LOCATION_STATS_SORT_CAP=3000` + `capped` 标记 |
| BE | 地图点坐标回退加载全部活跃地点 | 仅对缺坐标的唯一地名灵活查找 |
| BE | 备份合并恢复写记录后缓存陈旧 | `recordsAdded>0` 时清 records/locations/birds/排行榜缓存 |
| BE | 文件夹照片错误参数误用 `message`/`code` | 改为 `defaultMessage`/`defaultCode` |

---

## 仍残留（诚实，非满分）

| 级别 | 项 |
|------|----|
| P2 | JWT 在 localStorage + CSP `unsafe-inline` / `unsafe-eval`（Next 需要） |
| P2 | 鸟种默认列表：轻量全量字段 + 内存排序后再 hydrate 当前页（中国名录体量可接受） |
| P2 | `hasRecordsOnly`/年份筛选每次全量观测聚合；记录列表每页算 `uniqueSpecies` |
| P2 | ExploreDemo / 静态 ECharts 体积 |
| P2 | AUTO_LOGIN 本机默认开（非本机绑定已强制关） |
| P3 | 地点统计样本 `.limit(5000)`；排行榜扫描 cap 8000；备份无 Mongo 事务 |

---

## 核验仍通过

回环仅 socket；`getRecord` 挡 `isPublic:false`；公开聚合带 `isPublic`；媒体删/主图鉴权；区域名录写 admin；Prod `-H 127.0.0.1`；弱 INIT 令牌轮换；Update 不杀全局 node；导入/恢复后缓存失效。

---

## 边界

公开已发布观察含坐标属产品设计。若要冲 99+：HttpOnly Cookie 会话、鸟种/年份统计完全下推或缓存、拆分 ExploreDemo。
