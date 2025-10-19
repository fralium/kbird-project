#!/bin/bash

# 修复环境变量问题的脚本
# 确保前端使用正确的API地址

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
    echo "    修复环境变量问题"
    echo "========================================"
    echo -e "${NC}"
}

print_header

# 获取公网IP
PUBLIC_IP="47.121.183.57"
print_message "公网IP: $PUBLIC_IP"

# 1. 停止服务
print_message "停止当前服务..."
./stop.sh || true
sleep 2

# 2. 删除旧的环境变量文件
print_message "清理旧的环境变量文件..."
rm -f .env.local
rm -f .env

# 3. 创建新的环境变量文件
print_message "创建环境变量文件..."
cat > .env.local << EOF
# API配置
NEXT_PUBLIC_API_URL=http://$PUBLIC_IP:3002

# 网站配置
NEXT_PUBLIC_SITE_URL=http://$PUBLIC_IP:3000
EOF

# 4. 创建后端环境变量文件
cat > .env << EOF
# Database Configuration
MONGODB_URI=mongodb://localhost:27017/kbird

# JWT Secret Key
JWT_SECRET=tKe2ADRHR/Bnp4695IVBng2Ij8wmDM2s8cxw2iBrFTg=

# Server Port
PORT=3002

# File Upload Configuration
UPLOAD_PATH=./uploads
MAX_FILE_SIZE=5242880

# Frontend API URL
NEXT_PUBLIC_API_URL=http://$PUBLIC_IP:3002

# Website Configuration
SITE_NAME=KBird
SITE_DESCRIPTION=鸟类收集整理网站
SITE_URL=http://$PUBLIC_IP:3000

# Feature Toggles
ENABLE_REGISTRATION=true
ENABLE_COMMENTS=true
ENABLE_UPLOAD=true

# Theme Configuration
THEME=default
PRIMARY_COLOR=#4CAF50
SECONDARY_COLOR=#2196F3

# Node Environment
NODE_ENV=production
EOF

print_message "✅ 环境变量文件已创建"

# 5. 验证文件内容
print_message "验证环境变量文件内容:"
echo "=== .env.local ==="
cat .env.local
echo ""
echo "=== .env ==="
cat .env
echo ""

# 6. 重新构建前端（如果需要）
print_message "重新构建前端..."
npm run build || {
    print_warning "构建失败，尝试清理缓存..."
    rm -rf .next
    npm run build
}

# 7. 启动服务
print_message "启动服务..."
./start-production.sh

print_message "✅ 环境变量修复完成！"
print_message "现在前端应该使用正确的API地址: http://$PUBLIC_IP:3002"
