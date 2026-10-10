#!/bin/bash

# KBird 服务停止脚本 (PM2管理)

# 设置UTF-8编码
export LANG=zh_CN.UTF-8
export LC_ALL=zh_CN.UTF-8

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
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
    echo -e "${GREEN}        KBird 服务停止脚本 (PM2)        ${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo
}

print_header

# 检查PM2是否安装
if ! command -v pm2 &> /dev/null; then
    print_error "❌ PM2 未安装"
    exit 1
fi

# 显示当前服务状态
print_message "当前服务状态:"
pm2 status

# 停止所有KBird服务
print_message "停止所有KBird服务..."
pm2 stop all 2>/dev/null || { print_warning "⚠️  停止服务失败，可能没有运行中的服务"; }

# 删除所有PM2进程
print_message "删除PM2进程..."
pm2 delete all 2>/dev/null || { print_warning "⚠️  删除PM2进程失败"; }

# 等待进程完全停止
print_message "等待进程完全停止..."
sleep 3

# 检查端口是否释放
print_message "检查端口状态..."
if lsof -i :13080 > /dev/null 2>&1; then
    print_warning "⚠️  端口3000仍被占用"
else
    print_message "✅ 端口3000已释放"
fi

if lsof -i :13082 > /dev/null 2>&1; then
    print_warning "⚠️  端口3002仍被占用"
else
    print_message "✅ 端口3002已释放"
fi

# 显示最终状态
print_message "最终服务状态:"
pm2 status

echo
print_message "========================================"
print_message "🎉 KBird 服务已停止！"
print_message "========================================"
echo
print_message "🛠️ 管理命令:"
print_message "  • 启动服务: ./start.sh"
print_message "  • 查看状态: pm2 status"
print_message "  • 查看日志: pm2 logs"
echo
print_message "✅ 服务停止完成！"