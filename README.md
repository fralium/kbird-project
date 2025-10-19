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
# 克隆项目
git clone <your-repo-url>
cd KBird

# 使用Docker Compose启动
docker-compose up -d

# 访问应用
# 前端：http://localhost:3000
# 后端：http://localhost:3002
```

### 方法二：本地开发环境

**Windows:**
```bash
# 安装依赖
npm install

# 启动开发环境
npm run dev

# 或分别启动前后端
npm run server  # 后端
npm run dev     # 前端
```

**Linux/macOS:**
```bash
# 安装依赖
npm install

# 启动开发环境
npm run dev
```

### 方法二：手动安装

#### 前提条件

- Node.js 16.0 或更高版本
- MongoDB 4.4 或更高版本

#### 安装步骤

1. **克隆仓库**
```bash
git clone <your-repo-url>
cd KBird
```

2. **安装依赖**
```bash
npm install
```

3. **配置环境变量**
```bash
# 复制环境变量模板
cp env.example .env

# 编辑 .env 文件，修改以下配置：
# MONGODB_URI=mongodb://localhost:27017/kbird
# PORT=3002
# NEXT_PUBLIC_API_URL=http://localhost:3002
# JWT_SECRET=your-jwt-secret-here
```

4. **启动MongoDB**
```bash
# Windows
net start MongoDB

# macOS
brew services start mongodb-community

# Linux
sudo systemctl start mongod
```

5. **启动应用**
```bash
# 终端1 - 启动后端服务器
npm run server

# 终端2 - 启动前端服务器
npm run dev
```

6. **访问网站**
- 前端：http://localhost:3000
- 后端API：http://localhost:3002

## 生产环境部署

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
```

### Docker部署（可选）

```bash
# 构建镜像
docker build -t kbird .

# 运行容器
docker run -p 3000:3000 -p 3002:3002 kbird
```

## 项目结构

```
kbird/
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
└── ...
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

## 未来规划

- 移动应用开发
- AI鸟类识别功能
- 地图集成与可视化
- 社区功能增强
- 多语言支持

## 贡献指南

欢迎提交问题和功能请求！如果您想为项目做出贡献，请遵循以下步骤：

1. Fork 仓库
2. 创建您的功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交您的更改 (`git commit -m 'Add some amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 打开一个 Pull Request

## 许可证

本项目采用 MIT 许可证 - 详情请参阅 [LICENSE](LICENSE) 文件