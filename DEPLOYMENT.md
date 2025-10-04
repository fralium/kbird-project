# KBird 部署指南

## 🚀 快速部署

### 方法一：Docker 部署（推荐）

```bash
# 1. 克隆项目
git clone <your-repo-url>
cd KBird-release

# 2. 配置环境变量
cp env.example .env
# 编辑 .env 文件，修改数据库连接等配置

# 3. 使用 Docker Compose 启动
docker-compose up -d

# 4. 访问应用
# 前端：http://localhost:3000
# 后端：http://localhost:3002
```

### 方法二：传统部署

#### 前提条件
- Node.js 16.0 或更高版本
- MongoDB 4.4 或更高版本
- npm 或 yarn

#### 部署步骤

1. **安装依赖**
```bash
npm install
```

2. **配置环境变量**
```bash
cp env.example .env
# 编辑 .env 文件
```

3. **配置数据库**
```bash
# 确保 MongoDB 正在运行
# Windows
net start MongoDB

# macOS
brew services start mongodb-community

# Linux
sudo systemctl start mongod
```

4. **初始化数据库**
```bash
# 访问 http://localhost:3000/init
# 或使用 API 端点
curl http://localhost:3000/api/init
```

5. **启动应用**
```bash
# 开发环境
npm run dev

# 生产环境
npm run build
npm start
```

## 🔧 生产环境配置

### 使用 PM2 管理进程

```bash
# 安装 PM2
npm install -g pm2

# 构建应用
npm run build

# 启动生产服务器
pm2 start ecosystem.config.js

# 查看状态
pm2 status

# 查看日志
pm2 logs

# 重启应用
pm2 restart ecosystem.config.js
```

### 环境变量配置

创建 `.env` 文件：

```env
# 数据库配置
MONGODB_URI=mongodb://localhost:27017/kbird

# 服务器配置
PORT=3002
NEXT_PUBLIC_API_URL=http://localhost:3002

# JWT 密钥（生产环境请使用强密钥）
JWT_SECRET=your-super-secret-jwt-key-here

# 文件上传配置
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=10485760

# 缓存配置
CACHE_TTL=300
```

## 📊 数据库初始化

### 自动初始化
访问 `http://localhost:3000/init` 页面，系统会自动：
- 创建数据库索引
- 初始化基础数据
- 设置管理员账户

### 手动初始化
```bash
# 使用 MongoDB 客户端
mongo kbird

# 创建索引
db.birds.createIndex({ "name": 1 })
db.birds.createIndex({ "scientificName": 1 })
db.records.createIndex({ "date": -1 })
db.users.createIndex({ "email": 1 }, { unique: true })
```

## 🔒 安全配置

### 1. 更改默认密码
```bash
# 使用 MongoDB 客户端更新管理员密码
mongo kbird
db.users.updateOne(
  { email: "admin@kbird.com" },
  { $set: { password: "new-secure-password" } }
)
```

### 2. 配置 HTTPS（生产环境）
```bash
# 使用 Nginx 反向代理
server {
    listen 443 ssl;
    server_name your-domain.com;
    
    ssl_certificate /path/to/certificate.crt;
    ssl_certificate_key /path/to/private.key;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### 3. 防火墙配置
```bash
# 只开放必要端口
sudo ufw allow 22    # SSH
sudo ufw allow 80    # HTTP
sudo ufw allow 443   # HTTPS
sudo ufw enable
```

## 📈 性能优化

### 1. 数据库优化
```bash
# 创建复合索引
db.birds.createIndex({ "category": 1, "name": 1 })
db.records.createIndex({ "location": 1, "date": -1 })
```

### 2. 缓存配置
```bash
# 启用 Redis 缓存（可选）
npm install redis
# 配置 Redis 连接
```

### 3. 静态资源优化
```bash
# 使用 CDN 加速静态资源
# 配置图片压缩
# 启用 Gzip 压缩
```

## 🔍 监控和日志

### 1. 应用监控
```bash
# 使用 PM2 监控
pm2 monit

# 查看性能报告
pm2 show kbird
```

### 2. 日志管理
```bash
# 查看应用日志
tail -f server/logs/combined.log
tail -f server/logs/error.log

# 日志轮转
pm2 install pm2-logrotate
```

## 🚨 故障排除

### 常见问题

1. **数据库连接失败**
```bash
# 检查 MongoDB 状态
sudo systemctl status mongod

# 检查连接字符串
echo $MONGODB_URI
```

2. **端口占用**
```bash
# 检查端口占用
netstat -tulpn | grep :3000
netstat -tulpn | grep :3002

# 杀死占用进程
kill -9 <PID>
```

3. **权限问题**
```bash
# 检查文件权限
ls -la uploads/
chmod 755 uploads/
```

### 性能问题

1. **内存使用过高**
```bash
# 检查内存使用
free -h
top -p <node-pid>

# 调整 Node.js 内存限制
node --max-old-space-size=4096 server/index.js
```

2. **数据库查询慢**
```bash
# 启用 MongoDB 慢查询日志
db.setProfilingLevel(1, { slowms: 100 })
db.system.profile.find().sort({ ts: -1 }).limit(5)
```

## 📝 维护指南

### 日常维护

1. **数据备份**
```bash
# 每日自动备份
./scripts/backup-database.js

# 手动备份
mongodump --db kbird --out ./backups/$(date +%Y%m%d)
```

2. **日志清理**
```bash
# 清理旧日志
find ./logs -name "*.log" -mtime +30 -delete
```

3. **性能监控**
```bash
# 运行性能测试
./scripts/monitor-performance.js
```

### 更新部署

1. **代码更新**
```bash
git pull origin main
npm install
npm run build
pm2 restart ecosystem.config.js
```

2. **数据库迁移**
```bash
# 备份数据库
mongodump --db kbird --out ./backups/before-update

# 运行迁移脚本（如果有）
node scripts/migrate.js

# 验证数据完整性
node scripts/verify-data.js
```

## 📞 技术支持

如遇到问题，请：
1. 查看日志文件
2. 检查环境配置
3. 参考故障排除部分
4. 提交 Issue 到项目仓库

---

**注意**: 生产环境部署前，请确保：
- 更改所有默认密码
- 配置 HTTPS
- 设置防火墙规则
- 定期备份数据
- 监控系统性能
