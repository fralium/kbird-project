#!/bin/bash

# KBird 生产环境启动脚本
# 包含构建功能

set -e

# 设置UTF-8编码
export LANG=zh_CN.UTF-8
export LC_ALL=zh_CN.UTF-8

echo "========================================"
echo "        KBird 生产环境启动脚本"
echo "========================================"
echo

# 检查Node.js是否安装
if ! command -v node &> /dev/null; then
    echo "❌ 错误: Node.js 未安装"
    exit 1
fi

# 检查npm是否安装
if ! command -v npm &> /dev/null; then
    echo "❌ 错误: npm 未安装"
    exit 1
fi

echo "[1/4] 检查依赖..."
if [ ! -d "node_modules" ]; then
    echo "📦 安装依赖包..."
    npm install --omit=optional --no-audit --no-fund
    if [ $? -ne 0 ]; then
        echo "❌ 依赖安装失败"
        exit 1
    fi
else
    echo "✅ 依赖已存在"
fi

echo
echo "[2/4] 构建前端应用..."
export NODE_OPTIONS="--max-old-space-size=4096"
export NEXT_TELEMETRY_DISABLED=1

# 构建前端应用
timeout 600 npm run build || {
    echo "❌ 前端构建失败，请检查日志"
    exit 1
}

echo "✅ 前端构建完成"
echo

echo "[3/4] 启动后端服务 (端口 3002)..."
# 启动后端服务，绑定到所有网络接口
nohup node server/index.js > logs/server.log 2>&1 &
BACKEND_PID=$!
echo "✅ 后端服务已启动 (PID: $BACKEND_PID)"

# 等待后端服务启动
echo "⏳ 等待后端服务启动..."
sleep 3

echo
echo "[4/4] 启动前端服务 (端口 3000)..."
# 启动前端服务，绑定到所有网络接口
nohup npx next start -H 0.0.0.0 -p 3000 > logs/frontend.log 2>&1 &
FRONTEND_PID=$!
echo "✅ 前端服务已启动 (PID: $FRONTEND_PID)"

# 等待前端服务启动
echo "⏳ 等待前端服务启动..."
sleep 5

# 获取服务器IP
SERVER_IP=$(hostname -I | awk '{print $1}')

echo
echo "========================================"
echo "🎉 KBird 生产环境启动完成！"
echo "========================================"
echo
echo "📊 服务信息:"
echo "  • 后端服务: http://0.0.0.0:13082 (PID: $BACKEND_PID)"
echo "  • 前端服务: http://0.0.0.0:13080 (PID: $FRONTEND_PID)"
echo
echo "🌐 外部访问地址:"
echo "  • 前端: http://$SERVER_IP:13080"
echo "  • 后端API: http://$SERVER_IP:13082"
echo
echo "📝 日志文件:"
echo "  • 后端日志: logs/server.log"
echo "  • 前端日志: logs/frontend.log"
echo
echo "🛑 停止服务: 按 Ctrl+C，或使用 scripts/stop-windows / 本机进程管理"
echo "🔄 重启服务: 重新运行本脚本（旧 PM2 脚本见 temp/linux-pm2/）"
echo

# 保存PID到文件
echo $BACKEND_PID > .backend.pid
echo $FRONTEND_PID > .frontend.pid

echo "✅ 服务启动完成！"