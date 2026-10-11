KBird 支持用**百度地图 JavaScript API 3.0**展示观测点，以及地点编辑页的选点与地名搜索。配置后优先于天地图。

未配置百度 AK 时，地点编辑页仍可回退到天地图（展示用 `NEXT_PUBLIC_TIANDITU_TK`，搜索用 `TIANDITU_SERVER_TK`）。

标记使用自定义鸟类水滴图标（`public/map-marker-bird.png`，品牌色 `#219EBC`），通过 `BMap.Icon` 以**绝对 URL**加载（百度对 SVG / 相对路径支持不佳）。

---

## 一、申请 AK

1. 打开 [百度地图开放平台 - 控制台](https://lbsyun.baidu.com/apiconsole/key) 并登录。
2. 创建应用 / 添加密钥：
   - **应用类型**：浏览器端
   - **启用服务**：JavaScript API
3. **白名单**（本地开发建议）：
   - `localhost`
   - `127.0.0.1`
   - 若填写带端口，可用 `127.0.0.1:13080`（与 `KBird-Start.bat` 前端端口一致）
4. 复制得到的 **AK**。

个人非商业用途一般有免费配额；以控制台当前说明为准。

---

## 二、在 KBird 中启用

在项目根目录 `.env` 或 `.env.local` 中：

```bash
NEXT_PUBLIC_BAIDU_MAP_AK=你的浏览器端AK
```

修改后**重启前端**（关掉再运行 `KBird-Start.bat`）。Next.js 只在启动时读入 `NEXT_PUBLIC_*`。

优先级：`NEXT_PUBLIC_BAIDU_MAP_AK` → `NEXT_PUBLIC_TIANDITU_TK` → Leaflet 开源底图。

---

## 三、坐标说明

库内坐标按 WGS84 存储；百度底图展示与选点会经 BD-09 ↔ WGS84 转换，避免标记明显偏移。

地点编辑页启用百度后，搜索按钮为「百度搜索」（浏览器端 LocalSearch），无需额外服务端 Key。
