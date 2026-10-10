#!/bin/bash

# KBird Windows开发环境启动脚本

echo "========================================"
echo "        KBird Windows开发环境启动"
echo "========================================"
echo

# 检查是否在正确的目录
if [ ! -f "package.json" ]; then
    echo "❌ 请在项目根目录运行此脚本"
    exit 1
fi

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

echo "[1/3] 检查依赖..."
if [ ! -d "node_modules" ]; then
    echo "📦 安装依赖包..."
    npm install
    if [ $? -ne 0 ]; then
        echo "❌ 依赖安装失败"
        exit 1
    fi
else
    echo "✅ 依赖已存在"
fi

echo
echo "[2/3] 构建前端应用..."
# 检查是否已构建
if [ ! -d ".next" ] || [ ! -f ".next/BUILD_ID" ]; then
    echo "⚠️  前端未构建，正在构建..."
    npm run build
    if [ $? -ne 0 ]; then
        echo "❌ 前端构建失败"
        exit 1
    fi
    echo "✅ 前端构建完成"
else
    echo "✅ 前端已构建"
fi

echo
echo "[3/3] 启动服务..."
echo "启动后端服务 (端口 3002)..."
npm run server &
BACKEND_PID=$!
echo "✅ 后端服务已启动 (PID: $BACKEND_PID)"

# 等待后端服务启动
echo "⏳ 等待后端服务启动..."
sleep 3

echo
echo "启动前端服务 (端口 3000)..."
npm run dev &
FRONTEND_PID=$!
echo "✅ 前端服务已启动 (PID: $FRONTEND_PID)"

echo
echo "========================================"
echo "🎉 KBird 开发环境启动完成！"
echo "========================================"
echo
echo "📊 服务信息:"
echo "  • 前端服务: http://localhost:13080 (PID: $FRONTEND_PID)"
echo "  • 后端服务: http://localhost:13082 (PID: $BACKEND_PID)"
echo
echo "🛑 停止服务: 按 Ctrl+C 或运行 ./stop.sh"
echo
echo "✅ 开发环境启动完成！"

