#!/bin/bash

# 修复API配置的脚本
# 解决前端无法连接后端API的问题

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
    echo "    修复API配置问题"
    echo "========================================"
    echo -e "${NC}"
}

print_header

# 获取公网IP
PUBLIC_IP="47.121.183.57"
print_message "公网IP: $PUBLIC_IP"

# 1. 创建环境变量文件
print_message "创建环境变量文件..."
cat > .env.local << EOF
# API配置
NEXT_PUBLIC_API_URL=http://$PUBLIC_IP:3002

# 数据库配置
MONGODB_URI=mongodb://localhost:27017/kbird

# JWT密钥
JWT_SECRET=your-jwt-secret-key-here

# 服务器端口
PORT=3002

# 文件上传配置
UPLOAD_PATH=./uploads
MAX_FILE_SIZE=5242880
EOF

print_message "✅ 环境变量文件已创建"

# 2. 检查后端API是否可访问
print_message "检查后端API连接..."
if curl -s http://$PUBLIC_IP:3002/api/init > /dev/null; then
    print_message "✅ 后端API可访问"
else
    print_warning "❌ 后端API无法访问，检查后端服务状态"
    
    # 检查后端服务
    if pgrep -f "node server/index.js" > /dev/null; then
        print_message "✅ 后端服务正在运行"
    else
        print_error "❌ 后端服务未运行"
        print_message "启动后端服务..."
        nohup node server/index.js > logs/server.log 2>&1 &
        sleep 3
    fi
fi

# 3. 重启前端服务
print_message "重启前端服务..."
./stop.sh
sleep 2
./start-production.sh

print_message "✅ API配置修复完成！"
print_message "现在前端应该可以正常连接后端API了"
