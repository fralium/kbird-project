#!/bin/bash

# Linux服务器构建修复脚本
# 解决Next.js在Linux服务器上的SWC下载问题

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_message() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo -e "${BLUE}"
    echo "========================================"
    echo "    Linux服务器构建修复脚本"
    echo "========================================"
    echo -e "${NC}"
}

print_header

print_message "分析问题原因："
echo "1. Windows: 本地开发环境，网络稳定，SWC包自动下载"
echo "2. Linux: 服务器环境，网络可能受限，SWC包下载失败"
echo "3. Next.js 13.4.19: 旧版本，SWC包在npm registry中可能不完整"
echo ""

# 方法1: 降级到稳定版本
print_message "方法1: 使用Next.js 12.x稳定版本..."

# 备份package.json
cp package.json package.json.backup

# 修改为Next.js 12.x
cat > package.json << 'EOF'
{
  "name": "kbird",
  "version": "1.1.0",
  "description": "鸟类收集整理网站",
  "main": "index.js",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "server": "nodemon server/index.js",
    "start:all": "./start.sh",
    "stop:all": "./stop.sh",
    "restart:all": "./restart.sh",
    "dev:all": "concurrently \"npm run server\" \"npm run dev\"",
    "pm2:start": "pm2 start ecosystem.config.js",
    "pm2:stop": "pm2 stop ecosystem.config.js",
    "pm2:restart": "pm2 restart ecosystem.config.js"
  },
  "keywords": [
    "鸟类",
    "收集",
    "整理",
    "摄影"
  ],
  "author": "",
  "license": "ISC",
  "dependencies": {
    "@fontsource/noto-sans-sc": "^5.2.8",
    "antd": "^5.8.4",
    "axios": "^1.4.0",
    "bcryptjs": "^3.0.2",
    "compression": "^1.8.1",
    "cors": "^2.8.5",
    "dotenv": "^16.3.1",
    "express": "^4.18.2",
    "express-rate-limit": "^6.11.2",
    "express-validator": "^7.2.1",
    "form-data": "^4.0.4",
    "formidable": "^3.5.4",
    "html2canvas": "^1.4.1",
    "iconv-lite": "^0.7.0",
    "jsonwebtoken": "^9.0.2",
    "jspdf": "^3.0.3",
    "moment": "^2.29.4",
    "mongoose": "^7.4.3",
    "multer": "^2.0.0-rc.4",
    "next": "^12.3.4",
    "node-cache": "^5.1.2",
    "node-fetch": "^3.3.2",
    "pdfkit": "^0.17.2",
    "pinyin": "^4.0.0",
    "pinyin-pro": "^3.27.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "winston": "^3.17.0"
  },
  "devDependencies": {
    "concurrently": "^8.2.0",
    "cross-env": "^7.0.3",
    "rimraf": "^5.0.0",
    "glob": "^10.0.0",
    "eslint": "^8.57.0",
    "eslint-config-next": "^12.3.4",
    "nodemon": "^3.0.1"
  }
}
EOF

print_message "重新安装依赖..."
rm -rf node_modules package-lock.json
npm install

print_message "尝试构建..."
npm run build || {
    print_warning "Next.js 12.x构建失败，尝试方法2..."
    
    # 恢复原始package.json
    mv package.json.backup package.json
    
    # 方法2: 使用Docker构建
    print_message "方法2: 使用Docker构建..."
    
    # 创建Dockerfile.build
    cat > Dockerfile.build << 'EOF'
FROM node:18-alpine

WORKDIR /app

# 复制package文件
COPY package*.json ./

# 安装依赖
RUN npm install

# 复制源代码
COPY . .

# 构建应用
RUN npm run build

# 复制构建结果
RUN cp -r .next /build-output
EOF

    # 使用Docker构建
    print_message "使用Docker构建应用..."
    docker build -f Dockerfile.build -t kbird-build .
    docker run --name kbird-build-container kbird-build
    docker cp kbird-build-container:/build-output ./next-build
    docker rm kbird-build-container
    
    print_message "Docker构建完成，复制构建结果..."
    cp -r next-build/.next ./
    rm -rf next-build Dockerfile.build
}

print_message "✅ 构建修复完成！"
