# KBird - 鸟类收集整理网站

KBird是一个专注于鸟类信息收集、整理和分享的现代化网站平台。用户可以记录鸟类的发现地点、上传照片、查询鸟类信息，并与其他鸟类爱好者分享观鸟经验。

## ✨ 功能特点

- 🦜 **鸟类信息库**：包含1500+种鸟类的详细信息，支持中文名、拉丁学名、分类信息
- 📷 **照片上传与分享**：支持多图片上传，自动压缩和格式转换
- 🗺️ **观鸟记录**：完整的观鸟记录系统，支持多鸟类记录和详细描述
- 🔍 **智能搜索**：支持拼音搜索、分类筛选、保护等级筛选等多种搜索方式
- 📊 **数据统计**：鸟类观察统计、地点热度分析、用户贡献排行
- 📄 **数据导出**：支持PDF、CSV等多种格式的数据导出
- 🎨 **现代化UI**：响应式设计，支持移动端访问
- 🔐 **用户系统**：完整的用户注册、登录、权限管理系统

## 🛠️ 技术栈

### 前端技术
- **框架**：React.js 18 + Next.js 13.5.11
- **样式**：CSS Modules + 响应式设计
- **状态管理**：React Hooks + Context API
- **UI组件**：自定义组件库
- **PDF生成**：jsPDF + html2canvas
- **图标**：SVG图标系统

### 后端技术
- **运行时**：Node.js 16+
- **框架**：Express.js
- **数据库**：MongoDB + Mongoose
- **认证**：JWT (JSON Web Tokens)
- **文件上传**：Multer + Formidable
- **缓存**：Node-cache
- **日志**：Winston

### 开发工具
- **包管理**：npm
- **进程管理**：PM2
- **容器化**：Docker + Docker Compose
- **代码规范**：ESLint

## 🚀 快速开始

### 方法一：Docker部署（推荐）

```bash
# 1. 克隆项目
git clone https://github.com/yourusername/KBird.git
cd KBird-release

# 2. 配置环境变量
cp env.example .env
# 编辑 .env 文件，设置您的配置

# 3. 启动服务
docker-compose up -d

# 4. 访问应用
# 前端：http://localhost:3000
# 后端API：http://localhost:3002
```

### 方法二：本地安装

#### 前提条件

- **Node.js**: 版本 16.x 或更高
- **npm**: 版本 8.x 或更高（通常随Node.js一起安装）
- **MongoDB**: 版本 4.4 或更高
- **Git**: 用于代码版本管理

#### 安装步骤

1. **克隆仓库**
```bash
git clone https://github.com/yourusername/KBird.git
cd KBird-release
```

2. **安装依赖**
```bash
# 安装项目依赖（这可能需要几分钟时间，约600-700MB）
npm install
```

3. **配置环境变量**
```bash
# 复制环境变量模板
cp env.example .env

# 编辑环境变量文件
# Windows: notepad .env
# Linux/macOS: nano .env
```

主要配置项：
```env
# 数据库连接
MONGODB_URI=mongodb://localhost:27017/kbird

# 服务器端口
PORT=3002

# JWT密钥（生产环境请使用强密码）
JWT_SECRET=your-strong-jwt-secret-here

# API地址
NEXT_PUBLIC_API_URL=http://localhost:3002
```

#### 生成JWT密钥

项目提供了多种生成强JWT密钥的方法：

**方法一：使用Node.js脚本（推荐）**
```bash
node scripts/generate-jwt-secret.js
```

**方法二：使用OpenSSL命令行**
```bash
# Linux/macOS
openssl rand -hex 64

# Windows (需要安装OpenSSL)
openssl rand -hex 64
```

**方法三：使用PowerShell（Windows）**
```powershell
.\scripts\generate-jwt-secret.ps1
```

**方法四：在线生成**
```bash
# 使用Node.js命令行
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

**安全建议**：
- 生产环境使用至少64字符的密钥
- 定期更换JWT密钥
- 不要将密钥提交到版本控制系统

4. **启动MongoDB**

**Windows:**
```bash
# 如果MongoDB已安装为服务
net start MongoDB

# 或者手动启动
mongod --dbpath "C:\data\db"
```

**Linux:**
```bash
sudo systemctl start mongod
```

**macOS:**
```bash
brew services start mongodb-community
```

5. **构建和启动应用**
```bash
# 构建前端应用
npm run build

# 启动开发服务器
npm run dev

# 或者分别启动前后端
npm run server  # 后端 (端口3002)
npm run dev     # 前端 (端口3000)
```

6. **访问网站**
- 前端：http://localhost:3000
- 后端API：http://localhost:3002

## 📋 系统要求与安装

### Node.js安装

**Windows:**
1. 访问 [Node.js官网](https://nodejs.org/)
2. 下载LTS版本（推荐）
3. 运行安装程序，按默认选项安装

**Linux (Ubuntu/Debian):**
```bash
# 使用NodeSource仓库安装最新LTS版本
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt-get install -y nodejs
```

**macOS:**
```bash
# 使用Homebrew安装
brew install node
```

### MongoDB安装

**Windows:**
1. 访问 [MongoDB官网](https://www.mongodb.com/try/download/community)
2. 下载Windows版本
3. 运行安装程序，选择"Complete"安装

**Linux:**
```bash
# Ubuntu/Debian
wget -qO - https://www.mongodb.org/static/pgp/server-6.0.asc | sudo apt-key add -
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/6.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-6.0.list
sudo apt-get update
sudo apt-get install -y mongodb-org

# 启动MongoDB服务
sudo systemctl start mongod
sudo systemctl enable mongod
```

**macOS:**
```bash
# 使用Homebrew安装
brew tap mongodb/brew
brew install mongodb-community
brew services start mongodb/brew/mongodb-community
```

### Docker安装（可选）

**Windows:**
1. 下载 [Docker Desktop for Windows](https://www.docker.com/products/docker-desktop)
2. 安装并启动Docker Desktop

**Linux:**
```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install -y docker.io docker-compose
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker $USER
```

**macOS:**
1. 下载 [Docker Desktop for Mac](https://www.docker.com/products/docker-desktop)
2. 安装并启动Docker Desktop

## 🔧 生产环境部署

### 使用PM2管理进程

```bash
# 安装PM2
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

### 数据库初始化

访问 `http://localhost:3000/init` 页面，系统会自动：
- 创建数据库索引
- 初始化基础数据
- 设置管理员账户

### 安全配置

#### 1. 更改默认密码
```bash
# 使用 MongoDB 客户端更新管理员密码
mongo kbird
db.users.updateOne(
  { email: "admin@kbird.com" },
  { $set: { password: "new-secure-password" } }
)
```

#### 2. 配置 HTTPS（生产环境）
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

## 📊 数据库模型

### 鸟类模型 (Bird)
- **基本信息**：中文名、拉丁学名、英文名
- **分类信息**：目、科、属、种（支持中英文对照）
- **生态信息**：栖息地、分布区域、形态特征、行为习性
- **保护状态**：IUCN保护等级、中国保护等级
- **媒体资源**：图片集、音频文件
- **统计信息**：观察次数、图片数量、记录数量

### 观鸟记录模型 (Record)
- **记录信息**：标题、描述、观察日期、地点
- **鸟类信息**：观察的鸟类列表、数量统计
- **观察者**：用户信息、观察者备注
- **媒体文件**：照片、音频、视频
- **状态管理**：审核状态、可见性设置
- **地理信息**：精确坐标、地点描述

### 用户模型 (User)
- **账户信息**：用户名、邮箱、密码
- **个人资料**：头像、个人简介、联系方式
- **权限管理**：角色权限（普通用户/贡献者/管理员）
- **活动统计**：贡献记录、收藏列表、积分系统
- **偏好设置**：通知设置、隐私设置

### 地点模型 (Location)
- **地理信息**：名称、坐标、海拔、行政区划
- **生态环境**：栖息地类型、气候特征
- **鸟类统计**：观察记录数量、鸟类种类统计
- **用户互动**：热门程度、用户评价

## 🔍 验证安装

### 检查Node.js和npm
```bash
node --version  # 应该显示 v16.x.x 或更高
npm --version   # 应该显示 8.x.x 或更高
```

### 检查MongoDB
```bash
mongod --version  # 应该显示MongoDB版本信息
```

### 检查Docker（如果使用）
```bash
docker --version
docker-compose --version
```

## 🚨 常见问题与故障排除

### 1. npm install 失败

**问题**: 网络连接超时或下载失败
**解决方案**:
```bash
# 使用国内镜像源
npm config set registry https://registry.npmmirror.com

# 或者使用cnpm
npm install -g cnpm --registry=https://registry.npmmirror.com
cnpm install
```

### 2. MongoDB连接失败

**问题**: 无法连接到MongoDB数据库
**解决方案**:
```bash
# 检查MongoDB服务状态
# Windows: net start MongoDB
# Linux: sudo systemctl status mongod

# 检查端口是否被占用
netstat -an | grep 27017
```

### 3. 端口被占用

**问题**: 3000或3002端口已被其他程序使用
**解决方案**:
```bash
# 查看端口占用情况
netstat -ano | findstr :3000
netstat -ano | findstr :3002

# 杀死占用端口的进程（Windows）
taskkill /PID <进程ID> /F
```

### 4. 权限问题（Linux/macOS）

**问题**: 权限不足导致安装失败
**解决方案**:
```bash
# 不要使用sudo安装npm包
# 配置npm全局目录
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc
```

### 5. 数据库连接失败
```bash
# 检查 MongoDB 状态
sudo systemctl status mongod

# 检查连接字符串
echo $MONGODB_URI
```

### 6. 内存使用过高
```bash
# 检查内存使用
free -h
top -p <node-pid>

# 调整 Node.js 内存限制
node --max-old-space-size=4096 server/index.js
```

## 📊 安装后检查清单

- [ ] Node.js版本 >= 16.x
- [ ] npm版本 >= 8.x
- [ ] MongoDB已安装并运行
- [ ] 项目依赖已安装（node_modules文件夹存在）
- [ ] 环境变量已配置（.env文件存在）
- [ ] 前端可以访问（http://localhost:3000）
- [ ] 后端API可以访问（http://localhost:3002）
- [ ] 数据库连接正常

## 🚀 开发者工具

### 自动同步脚本

项目提供了自动化脚本来帮助开发者管理代码同步：

#### Git智能同步脚本（推荐）
```powershell
# 预览模式（不实际复制文件）
.\sync-with-git.ps1 -DryRun

# 同步到指定版本
.\sync-with-git.ps1 -Version "v1.2.0"

# 强制同步所有重要文件
.\sync-with-git.ps1 -Version "v1.2.0" -Force
```

#### 简单批处理脚本
```batch
# 直接双击运行
update-release.bat

# 或命令行运行
.\update-release.bat
```

**特点**:
- ✅ 基于Git状态检测修改的文件
- ✅ 自动排除临时文件和调试文件
- ✅ 智能文件哈希比较，只同步真正修改的文件
- ✅ 自动Git提交和标签创建
- ✅ 支持预览模式（DryRun）

### 开发工作流程

1. **克隆项目**
```bash
# 克隆项目到本地
git clone https://github.com/yourusername/KBird.git
cd KBird-release
```

2. **安装依赖并开发**
```bash
# 安装项目依赖
npm install

# 进行功能开发和修改
# ... 开发工作 ...
```

3. **提交更改**
```bash
# 添加修改的文件
git add .

# 提交更改
git commit -m "Add new feature: description"

# 推送到远程仓库
git push origin master
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

## 📚 版本历史

### v1.4.0 - 2025-10-04
- 🔐 添加JWT密钥生成工具
- 📝 新增多种JWT密钥生成方法（Node.js、OpenSSL、PowerShell）
- 🛠️ 提供跨平台密钥生成脚本
- 📚 完善安全配置文档
- 🔒 增强生产环境安全建议

### v1.3.0 - 2025-10-04
- 🧹 移除个人化信息和路径
- 📝 标准化开源项目文档
- 🔄 更新版权信息为通用格式
- 🌐 优化仓库地址格式
- 📋 创建标准开源项目结构

### v1.2.0 - 2025-10-04
- 📄 更新许可证为CC BY-NC 4.0
- 🚫 明确禁止商业使用条款
- 📝 添加详细使用条款说明
- 🔒 强制署名要求
- 📚 提供正确的使用示例

### v1.1.0 - 2025-10-04
- ✨ 添加自动化同步脚本
- 📚 完善文档和安装指南
- 🚀 优化发布包大小（从800MB减少到119MB）
- 🔧 改进部署流程

### v1.0.0 - 2025-10-04
- 🎉 首次发布
- 🦜 完整的鸟类信息库（1500+种鸟类）
- 🔍 智能搜索系统
- 📷 照片管理和上传
- 📊 数据导出功能
- 🔐 用户认证系统
- 🎨 现代化响应式UI

## 项目结构

```
KBird-release/
├── components/       # React组件
├── pages/            # Next.js页面
│   ├── api/          # API路由
│   ├── birds/        # 鸟类相关页面
│   └── ...
├── public/           # 静态资源
├── server/           # 后端服务器
│   ├── config/       # 配置文件
│   ├── controllers/  # 控制器
│   ├── models/       # 数据模型
│   └── routes/       # API路由
├── styles/           # CSS样式
├── data/             # 数据文件
├── utils/            # 工具函数
├── scripts/          # 脚本文件
│   ├── generate-jwt-secret.js    # JWT密钥生成脚本(Node.js)
│   ├── generate-jwt-secret.sh    # JWT密钥生成脚本(Bash)
│   └── generate-jwt-secret.ps1   # JWT密钥生成脚本(PowerShell)
├── sync-with-git.ps1 # Git智能同步脚本
├── update-release.bat # 批处理同步脚本
├── package.json      # 项目配置
├── docker-compose.yml # Docker配置
├── Dockerfile        # Docker镜像配置
├── ecosystem.config.js # PM2配置
└── README.md         # 项目文档
```

## 未来规划

- [ ] 移动应用开发
- [ ] AI鸟类识别功能
- [ ] 地图集成与可视化
- [ ] 社区功能增强
- [ ] 多语言支持
- [ ] 实时通知系统
- [ ] 数据分析面板
- [ ] 第三方集成

## 贡献指南

欢迎提交问题和功能请求！如果您想为项目做出贡献，请遵循以下步骤：

1. Fork 仓库
2. 创建您的功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交您的更改 (`git commit -m 'Add some amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 打开一个 Pull Request

## 许可证

本项目采用 **CC BY-NC 4.0**（知识共享署名-非商业性使用 4.0 国际许可协议） - 详情请参阅 [LICENSE](LICENSE) 文件

### 使用条款

✅ **允许的行为**：
- 自由复制、分发、展示本项目
- 修改和创作衍生作品
- 用于教育、研究、个人学习
- 必须注明原作者和来源

❌ **禁止的行为**：
- 商业用途（包括但不限于销售、租赁、广告等）
- 移除署名信息
- 以任何方式暗示原作者认可您的使用

### 如何正确使用

如果您使用了本项目，请在您的项目中包含以下信息：

```
基于 KBird 项目开发
原作者：[原作者名称]
许可证：CC BY-NC 4.0
项目地址：[项目地址]
```

## 🆘 获取帮助

如果您在安装或使用过程中遇到问题：

1. **查看日志**: 检查终端输出的错误信息
2. **检查版本**: 确保所有软件版本符合要求
3. **网络连接**: 确保网络连接稳定，可以访问npm仓库
4. **权限设置**: 确保有足够的文件系统权限
5. **防火墙**: 检查防火墙设置，确保端口未被阻挡
6. **提交Issue**: 在项目仓库提交问题报告

---

**KBird Project** - 欢迎使用和贡献！🎉