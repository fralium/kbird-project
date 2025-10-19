#!/bin/bash

# KBird 服务启动脚本 (PM2管理)

# 设置UTF-8编码
export LANG=zh_CN.UTF-8
export LC_ALL=zh_CN.UTF-8

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 打印信息函数
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
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}        KBird 服务启动脚本 (PM2)        ${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo
}

print_header

# 检查是否在正确的目录
if [ ! -f "package.json" ]; then
    print_error "❌ 请在项目根目录运行此脚本"
    exit 1
fi

# 检查PM2是否安装
if ! command -v pm2 &> /dev/null; then
    print_error "❌ PM2 未安装，请先运行 ./deploy.sh"
    exit 1
fi

# 检查是否已构建
if [ ! -d ".next" ]; then
    print_warning "⚠️  前端未构建，正在构建..."
    npm run build || { print_error "构建失败"; exit 1; }
fi

# 停止所有现有服务
print_message "停止所有现有服务..."
pm2 stop all 2>/dev/null || true
pm2 delete all 2>/dev/null || true
sleep 3

# 启动后端服务
print_message "启动后端服务..."
pm2 start server/index.js --name "kbird-backend" --env production

# 等待后端启动
print_message "等待后端服务启动..."
sleep 5

# 检查后端服务
if pm2 list | grep -q "kbird-backend.*online"; then
    print_message "✅ 后端服务启动成功"
else
    print_error "❌ 后端服务启动失败"
    pm2 logs kbird-backend --lines 10
    exit 1
fi

# 启动前端服务
print_message "启动前端服务..."
pm2 start npm --name "kbird-frontend" -- run start

# 等待前端启动
print_message "等待前端服务启动..."
sleep 10

# 检查前端服务
if pm2 list | grep -q "kbird-frontend.*online"; then
    print_message "✅ 前端服务启动成功"
else
    print_error "❌ 前端服务启动失败"
    pm2 logs kbird-frontend --lines 10
    exit 1
fi

# 保存PM2配置
pm2 save

# 获取IP信息
PUBLIC_IP=""
if command -v curl &> /dev/null; then
    PUBLIC_IP=$(curl -s --connect-timeout 5 http://ipinfo.io/ip 2>/dev/null)
    if [ $? -ne 0 ] || [ -z "$PUBLIC_IP" ]; then
        PUBLIC_IP=$(curl -s --connect-timeout 5 http://icanhazip.com 2>/dev/null)
    fi
fi

if [ -z "$PUBLIC_IP" ]; then
    PUBLIC_IP="localhost"
fi

INTERNAL_IP=$(hostname -I | awk '{print $1}')

# 测试服务连接
print_message "测试服务连接..."
if curl -s http://localhost:3002/api/check-init > /dev/null; then
    print_message "✅ 后端API正常"
else
    print_warning "⚠️  后端API可能有问题"
fi

if curl -s http://localhost:3000 > /dev/null; then
    print_message "✅ 前端服务正常"
else
    print_warning "⚠️  前端服务可能有问题"
fi

# 显示服务状态
print_message "服务状态:"
pm2 status

echo
print_message "========================================"
print_message "🎉 KBird 服务启动完成！"
print_message "========================================"
echo
print_message "📊 服务信息:"
print_message "  • 前端: http://$PUBLIC_IP:3000"
print_message "  • 后端: http://$PUBLIC_IP:3002"
print_message "  • 内网: http://$INTERNAL_IP:3000 (前端)"
print_message "  • 内网: http://$INTERNAL_IP:3002 (后端)"
echo
print_message "🛠️ 管理命令:"
print_message "  • 查看状态: pm2 status"
print_message "  • 查看日志: pm2 logs"
print_message "  • 重启服务: pm2 restart all"
print_message "  • 停止服务: pm2 stop all"
print_message "  • 停止脚本: ./stop.sh"
echo
print_message "✅ 服务启动完成！"