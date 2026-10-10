# KBird 故障排除指南

## 🔧 常见问题及解决方案

### 1. API请求失败 (Failed to fetch)

**症状**：
- 浏览器控制台显示 `TypeError: Failed to fetch`
- 所有API请求都失败
- 前端页面无法加载数据

**原因**：
- 后端服务（端口13082）未启动
- MongoDB服务未运行
- 端口被占用
- 防火墙阻止连接

**解决方案**：

#### 检查后端服务
```powershell
# 检查端口13082是否在监听
netstat -ano | findstr :13082

# 如果没有输出，说明后端服务未启动
```

#### 启动后端服务
```bash
# 方法1：使用npm脚本
npm run server

# 方法2：使用启动脚本
.\scripts\windows\KBird-Desktop.bat

# 方法3：同时启动前后端
npm run dev:all
```

#### 检查MongoDB服务
```powershell
# 检查MongoDB服务状态
Get-Service MongoDB

# 启动MongoDB服务
net start MongoDB

# 如果服务不存在，运行配置脚本
.\scripts\windows\setup-mongodb.ps1
```

#### 检查端口占用
```powershell
# 查看端口占用情况
netstat -ano | findstr :13082

# 如果端口被占用，可以：
# 1. 停止占用端口的进程
# 2. 修改.env文件中的PORT配置
```

### 2. Token验证失败

**症状**：
- 控制台显示 "Token无效，清除认证状态"
- 用户无法登录
- 已登录用户被强制退出

**原因**：
- JWT密钥不匹配
- Token过期
- 后端服务重启导致密钥变化

**解决方案**：

#### 清除本地存储
```javascript
// 在浏览器控制台执行
localStorage.clear();
sessionStorage.clear();
// 然后刷新页面
```

#### 重新登录
- 清除存储后，重新登录即可

#### 检查JWT密钥
```env
# 确保.env文件中的JWT_SECRET配置正确
JWT_SECRET=your-jwt-secret-key-here
```

### 3. MongoDB连接失败

**症状**：
- 后端日志显示 "MongoDB 连接错误"
- 数据库操作失败
- API返回500错误

**解决方案**：

#### 检查MongoDB服务
```powershell
# 检查服务状态
Get-Service MongoDB

# 启动服务
net start MongoDB
```

#### 检查连接配置
```env
# .env文件中的MongoDB URI
MONGODB_URI=mongodb://localhost:27017/kbird
```

#### 测试MongoDB连接
```powershell
# 使用MongoDB客户端测试
mongosh mongodb://localhost:27017/kbird
```

#### 重新配置MongoDB
```powershell
# 运行配置脚本
.\scripts\windows\setup-mongodb.ps1
```

### 4. 前端页面空白或错误

**症状**：
- 页面显示空白
- 控制台有JavaScript错误
- 页面无法加载

**解决方案**：

#### 清除Next.js缓存
```bash
# 删除.next目录
rmdir /s /q .next

# 重新启动
npm run dev
```

#### 重新安装依赖
```bash
# 删除node_modules
rmdir /s /q node_modules

# 清除npm缓存
npm cache clean --force

# 重新安装
npm install
```

#### 检查环境变量
```env
# 确保.env文件存在且配置正确
NEXT_PUBLIC_API_URL=http://localhost:13082
```

### 5. 端口被占用

**症状**：
- 服务启动失败
- 显示 "Port 13080 is in use" 或类似错误

**解决方案**：

#### 查找占用端口的进程
```powershell
# 查找占用 13080（前端）端口的进程
netstat -ano | findstr :13080

# 查找占用 13082（后端）端口的进程
netstat -ano | findstr :13082
```

#### 停止占用进程
```powershell
# 使用PID停止进程（替换PID为实际进程ID）
taskkill /F /PID <PID>
```

#### 修改端口配置
```env
# .env文件中修改端口
PORT=13083  # 后端端口
# Next.js端口在package.json或命令行参数中修改
```

### 6. 文件上传失败

**症状**：
- 图片上传失败
- 显示文件大小超限
- 上传进度卡住

**解决方案**：

#### 检查文件大小限制
```env
# .env文件中的配置
MAX_FILE_SIZE=5242880  # 5MB
```

#### 检查uploads目录权限
```powershell
# 确保uploads目录存在且有写权限
if (-not (Test-Path "uploads")) {
    New-Item -ItemType Directory -Path "uploads"
}
```

#### 检查磁盘空间
```powershell
# 检查磁盘空间
Get-PSDrive C | Select-Object Used,Free
```

### 7. 依赖安装失败

**症状**：
- `npm install` 失败
- 显示网络错误或权限错误

**解决方案**：

#### 使用国内镜像
```bash
# 使用淘宝镜像
npm config set registry https://registry.npmmirror.com

# 或使用cnpm
npm install -g cnpm --registry=https://registry.npmmirror.com
cnpm install
```

#### 清除缓存
```bash
npm cache clean --force
```

#### 使用管理员权限
```powershell
# 以管理员身份运行PowerShell
# 然后执行npm install
```

### 8. 开发模式热重载不工作

**症状**：
- 代码修改后页面不自动刷新
- 需要手动刷新浏览器

**解决方案**：

#### 检查Next.js配置
```javascript
// next.config.js
module.exports = {
  // 确保没有禁用热重载
}
```

#### 重启开发服务器
```bash
# 停止当前服务（Ctrl+C）
# 重新启动
npm run dev
```

#### 清除浏览器缓存
- 按 `Ctrl + Shift + R` 强制刷新
- 或清除浏览器缓存

## 🚀 快速诊断命令

### 一键检查所有服务
```powershell
# 检查所有服务状态
Write-Host "=== 服务状态检查 ===" -ForegroundColor Cyan
Write-Host "`nNode.js进程:" -ForegroundColor Yellow
tasklist | findstr node
Write-Host "`n端口监听:" -ForegroundColor Yellow
netstat -ano | findstr :13080 :13082
Write-Host "`nMongoDB服务:" -ForegroundColor Yellow
Get-Service MongoDB -ErrorAction SilentlyContinue
```

### 一键重启所有服务
```batch
# 停止所有服务
.\scripts\windows\KBird-Stop.bat

# 等待几秒
timeout /t 3

# 启动所有服务
.\scripts\windows\KBird-Desktop.bat
```

## 📞 获取更多帮助

如果以上方法都无法解决问题：

1. **查看日志文件**
   - 后端日志：查看运行后端的命令行窗口
   - 前端日志：浏览器控制台（F12）
   - MongoDB日志：`C:\ProgramData\MongoDB\log\mongod.log`

2. **检查配置文件**
   - `.env` 文件配置
   - `package.json` 脚本配置
   - `next.config.js` 配置

3. **查看文档**
   - [Windows快速开始指南](WINDOWS_QUICK_START.md)
   - [数据隔离与备份](DATA_ISOLATION.md)
   - [文档索引](README.md)
