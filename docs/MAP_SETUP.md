# 地图功能配置说明

## 问题说明

在中国大陆，OpenStreetMap 的瓦片服务可能无法正常访问，导致地图无法加载。

## 解决方案

### 方案1：使用 CartoDB 地图服务（当前默认，无需配置）

当前代码已配置使用 CartoDB 地图服务，这是一个免费的开源地图服务，在中国大陆访问更稳定。

**优点：**
- ✅ 完全免费，无需 API key
- ✅ 在中国大陆访问更稳定
- ✅ 无需任何配置

**如果仍然无法访问，请尝试以下方案：**

### 方案2：使用高德地图（推荐，需要免费申请 API key）

高德地图是中国最稳定的地图服务，个人开发者可以免费申请 API key。

#### 申请步骤：

1. **访问高德开放平台**
   - 网址：https://console.amap.com/dev/key/app
   - 使用高德账号登录（可用支付宝/淘宝账号）

2. **创建应用**
   - 点击"创建新应用"
   - 应用名称：KBird观鸟网站
   - 应用类型：Web端(JS API)

3. **添加 Key**
   - 在应用下点击"添加"
   - Key名称：KBird地图
   - 服务平台：Web端(JS API)
   - 提交后获得 API Key

4. **配置到项目**
   - 在 `.env` 文件中添加：
     ```
     NEXT_PUBLIC_GAODE_MAP_KEY=你的API_KEY
     ```
   - 或者在 `pages/records/[id].js` 中直接使用 `BirdMapGaode` 组件

#### 免费额度：
- 个人开发者：每天 30 万次调用
- 完全免费，足够个人使用

### 方案3：使用其他地图服务

如果以上方案都无法使用，可以考虑：

1. **百度地图**（需要 API key）
2. **腾讯地图**（需要 API key）
3. **天地图**（国家基础地理信息公共服务平台，需要申请）

## 当前配置

当前使用 **CartoDB 地图服务**，如果无法访问，请：

1. 检查网络连接
2. 尝试使用 VPN
3. 或者按照方案2申请高德地图 API key

## 切换地图服务

### 切换到高德地图

1. 在 `pages/records/[id].js` 中：
   ```javascript
   // 将
   import BirdMap from '../../components/BirdMap';
   
   // 改为
   import BirdMapGaode from '../../components/BirdMapGaode';
   
   // 使用
   <BirdMapGaode
     locations={[...]}
     apiKey={process.env.NEXT_PUBLIC_GAODE_MAP_KEY || ''}
   />
   ```

2. 在 `.env` 文件中添加 API key

## 故障排查

### 地图显示空白

1. **检查控制台错误**
   - 打开浏览器开发者工具（F12）
   - 查看 Console 和 Network 标签
   - 确认是否有网络错误

2. **检查坐标数据**
   - 确认记录中包含有效的位置坐标
   - 坐标格式：`[经度, 纬度]`

3. **尝试其他地图服务**
   - 按照方案2申请高德地图 API key
   - 或使用其他备用地图服务

### 地图加载慢

1. **使用国内地图服务**（高德/百度/腾讯）
2. **检查网络连接**
3. **使用 CDN 加速**

## 技术支持

如果遇到问题，请：
1. 检查浏览器控制台错误信息
2. 确认网络连接正常
3. 尝试使用不同的地图服务
4. 查看 Leaflet 官方文档：https://leafletjs.com/
