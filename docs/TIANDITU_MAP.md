# 天地图地图接入说明

KBird 支持使用**天地图**在观鸟记录详情页展示观察地点。地图在**浏览器中加载和显示**，因此申请 Key 时请选择**浏览器端**。

---

## 一、应用类型：需要两个 Key（或至少浏览器端）

在 [天地图开放平台](https://cloudcenter.tianditu.gov.cn/center/development/myApp) 创建应用时：

| 类型 | 说明 | 在 KBird 中的用途 |
|------|------|-------------------|
| **浏览器端** | 在网页中加载地图、显示、标注等 | ✅ 记录详情页地图、地点编辑页地图展示 |
| **服务器端** | 由后端服务调用天地图 Web 接口（如地理编码） | ✅ **地名搜索**（地点编辑页「天地图搜索」） |

- **仅做地图展示**：只申请**浏览器端**，配置 `NEXT_PUBLIC_TIANDITU_TK` 即可。
- **需要地名搜索**（如搜索「五常湿地」自动填坐标）：地理编码接口由**服务端**请求，必须再申请一个**服务器端**应用，得到 Key 后配置 `TIANDITU_SERVER_TK`。否则会报 **「权限类型错误」**。

---

## 二、申请 API Key 步骤

1. 打开 **天地图开放平台**：  
   https://cloudcenter.tianditu.gov.cn/center/development/myApp  
   （或从 https://www.tianditu.gov.cn/ 进入「开发资源」→「地图API」）

2. 登录/注册账号。

3. 进入「我的应用」→「创建新应用」。

4. 填写应用信息：
   - **应用名称**：如「KBird 观鸟记录」
   - **应用类型**：选择 **浏览器端**
   - **域名白名单**：
     - **本地开发**：**留空不填**。平台只接受域名（如 `www.example.com`），不接受 `127.0.0.1` 或 `127.0.0.1:13080`；留空表示「无域名限制」，本地 localhost 可正常使用 Key。
     - **正式上线**：再填写你的网站域名（如 `www.yoursite.com`），多个用英文逗号分隔，防止 Key 被其他网站盗用。

5. 提交后获得 **Key（tk）**，复制保存。

---

## 三、在 KBird 中启用天地图

1. **配置环境变量**

   在项目根目录的 `.env` 或 `.env.local` 中配置（将示例值替换为你在天地图申请到的 Key）：

   ```bash
   # 浏览器端 Key（地图展示）
   NEXT_PUBLIC_TIANDITU_TK=你的浏览器端Key

   # 服务器端 Key（地名搜索，否则地点编辑页搜索会报「权限类型错误」）
   TIANDITU_SERVER_TK=你的服务器端Key
   ```

   若只配置了 `NEXT_PUBLIC_TIANDITU_TK`，地图可正常显示，但地点编辑页的「天地图搜索」会报错，需再申请服务器端 Key 并配置 `TIANDITU_SERVER_TK`。

2. **重启前端**

   修改环境变量后需重启 Next.js 开发/生产服务，例如：

   ```bash
   npm run dev
   ```

3. **效果**

   - 配置了 `NEXT_PUBLIC_TIANDITU_TK` 后，观鸟记录详情页（如 `/records/[id]`）的「观察地点」地图会使用**天地图**展示。
   - **地点编辑页**（`/locations/edit/[id]`）会显示天地图选点 + **地名搜索**：可输入「映月台」「西湖」等，点击「天地图搜索」获取坐标并在地图上定位；也可在地图上点击或拖拽标记设置精确坐标，经纬度会同步到表单。
   - 未配置或 Key 为空时，仍使用默认的 Leaflet + 开放图源（如 CARTO）地图，地点编辑页不显示地图选点与搜索。

---

## 四、记录地点与地图显示

- 地图依赖记录中的**地理坐标**（经度、纬度）。若记录里只有地点名称、没有有效坐标，会显示「暂无位置信息」。
- **正确做法**：添加/编辑观鸟记录时，在「地点」输入框中**从下拉列表选择**已有地点（或先在地点名录中创建带坐标的地点再选）。仅输入「映月台」等文字而不选择，不会保存坐标，地图无法显示。
- 若某条记录已只有名称、无坐标：进入该记录详情页后，点击编辑，在地点处从下拉**重新选择**带坐标的同一地点后保存，地图即可显示。

## 五、技术说明

- 使用 **天地图 JavaScript API 4.0**，通过脚本引入：  
  `https://api.tianditu.gov.cn/api?v=4.0&tk=您的Key`
- 地图组件：`components/BirdMapTianditu.js`，与现有 `BirdMap` 接口一致（`locations`、`center`、`zoom`、`height` 等）。
- Key 使用 `NEXT_PUBLIC_` 前缀，会随前端构建打包，仅用于浏览器端加载天地图，符合「浏览器端」应用类型。

---

## 六、常见问题

### 搜索提示「权限类型错误」

- **原因**：地名搜索（地理编码）由**服务端**请求天地图，天地图要求使用**服务器端**类型的 Key。
- **处理**：在 [天地图开放平台](https://cloudcenter.tianditu.gov.cn/center/development/myApp) 再创建一个应用，应用类型选择 **「服务器端」**，将得到的 Key 填入 `.env` 的 **`TIANDITU_SERVER_TK`**（不要用 `NEXT_PUBLIC_` 前缀），重启 Next.js 后重试搜索。

---

## 七、参考链接

- 天地图开放平台（申请 Key）：https://cloudcenter.tianditu.gov.cn/center/development/myApp  
- 天地图 JavaScript API 4.0 文档：http://lbs.tianditu.gov.cn/api/js4.0/guide.html  
