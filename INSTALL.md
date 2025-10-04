# KBird 安装指南

## 📋 系统要求

在开始安装之前，请确保您的系统满足以下要求：

- **Node.js**: 版本 16.x 或更高
- **npm**: 版本 8.x 或更高（通常随Node.js一起安装）
- **MongoDB**: 版本 4.4 或更高
- **Git**: 用于代码版本管理

## 🚀 快速安装

### 方法一：Docker部署（推荐）

如果您已经安装了Docker和Docker Compose，这是最简单的部署方式：

```bash
# 1. 克隆或下载项目代码
git clone <your-repo-url>
cd KBird

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

#### 1. 安装Node.js依赖

```bash
# 安装项目依赖（这可能需要几分钟时间）
npm install
```

**注意**: 首次安装可能需要下载约600-700MB的依赖包，请确保网络连接稳定。

#### 2. 配置环境变量

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

#### 3. 启动MongoDB

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

#### 4. 构建和启动应用

```bash
# 构建前端应用
npm run build

# 启动开发服务器
npm run dev

# 或者分别启动前后端
npm run server  # 后端 (端口3002)
npm run dev     # 前端 (端口3000)
```

## 🔧 详细安装步骤

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

## 🚨 常见问题

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

## 📊 安装后检查清单

- [ ] Node.js版本 >= 16.x
- [ ] npm版本 >= 8.x
- [ ] MongoDB已安装并运行
- [ ] 项目依赖已安装（node_modules文件夹存在）
- [ ] 环境变量已配置（.env文件存在）
- [ ] 前端可以访问（http://localhost:3000）
- [ ] 后端API可以访问（http://localhost:3002）
- [ ] 数据库连接正常

## 🆘 获取帮助

如果您在安装过程中遇到问题：

1. **查看日志**: 检查终端输出的错误信息
2. **检查版本**: 确保所有软件版本符合要求
3. **网络连接**: 确保网络连接稳定，可以访问npm仓库
4. **权限设置**: 确保有足够的文件系统权限
5. **防火墙**: 检查防火墙设置，确保端口未被阻挡

## 📚 相关文档

- [README.md](./README.md) - 项目概述和功能说明
- [DEPLOYMENT.md](./DEPLOYMENT.md) - 部署和运维指南
- [CHANGELOG.md](./CHANGELOG.md) - 版本更新历史

---

**KBird Team** - 祝您安装顺利！🎉
