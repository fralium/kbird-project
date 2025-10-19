#!/bin/bash

# 修复外部访问问题的脚本
# 解决502错误和IP绑定问题

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
    echo "    修复外部访问问题"
    echo "========================================"
    echo -e "${NC}"
}

print_header

# 获取公网IP
PUBLIC_IP="47.121.183.57"
print_message "公网IP: $PUBLIC_IP"

# 1. 检查防火墙
print_message "检查防火墙设置..."
if command -v ufw &> /dev/null; then
    print_message "开放端口 3000 和 3002..."
    sudo ufw allow 3000
    sudo ufw allow 3002
    sudo ufw reload
fi

# 2. 检查服务状态
print_message "检查服务状态..."
if pgrep -f "next start" > /dev/null; then
    print_message "✅ 前端服务正在运行"
else
    print_warning "❌ 前端服务未运行"
fi

if pgrep -f "node server/index.js" > /dev/null; then
    print_message "✅ 后端服务正在运行"
else
    print_warning "❌ 后端服务未运行"
fi

# 3. 检查端口监听
print_message "检查端口监听状态..."
echo "端口 3000 状态:"
netstat -tlnp | grep :3000 || echo "端口 3000 未被监听"
echo ""
echo "端口 3002 状态:"
netstat -tlnp | grep :3002 || echo "端口 3002 未被监听"
echo ""

# 4. 测试本地访问
print_message "测试本地访问..."
if curl -s http://localhost:3000 > /dev/null; then
    print_message "✅ 前端服务本地访问正常"
else
    print_warning "❌ 前端服务本地访问失败"
fi

if curl -s http://localhost:3002/api/health > /dev/null; then
    print_message "✅ 后端服务本地访问正常"
else
    print_warning "❌ 后端服务本地访问失败"
fi

# 5. 重启服务
print_message "重启服务..."
./stop.sh
sleep 2
./start-production.sh

# 6. 等待服务启动
print_message "等待服务启动..."
sleep 10

# 7. 再次检查
print_message "最终检查..."
echo "端口监听状态:"
netstat -tlnp | grep -E ":(3000|3002)"

echo ""
print_message "🌐 访问地址:"
echo "  • 前端: http://$PUBLIC_IP:3000"
echo "  • 后端: http://$PUBLIC_IP:3002"
echo ""
print_message "如果仍然无法访问，请检查："
echo "  1. 云服务器安全组设置"
echo "  2. 服务器防火墙设置"
echo "  3. 服务是否正常运行"
