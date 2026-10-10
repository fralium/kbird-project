#!/bin/bash

# KBird 开发环境停止脚本

echo "========================================"
echo "           KBird 服务停止脚本"
echo "========================================"
echo

echo "[1/2] 停止所有服务..."
pkill -f "next dev" 2>/dev/null || true
pkill -f "nodemon server/index.js" 2>/dev/null || true
pkill -f "node server/index.js" 2>/dev/null || true
echo "✅ 服务已停止"

echo "[2/2] 检查并清理端口..."
PORT_FRONT=$(lsof -ti :13080 2>/dev/null)
PORT_BACK=$(lsof -ti :13082 2>/dev/null)

if [ ! -z "$PORT_FRONT" ]; then
    echo "⚠️  端口 13080 仍被占用，正在释放..."
    kill -9 $PORT_FRONT 2>/dev/null || true
fi

if [ ! -z "$PORT_BACK" ]; then
    echo "⚠️  端口 13082 仍被占用，正在释放..."
    kill -9 $PORT_BACK 2>/dev/null || true
fi

echo "✅ 端口清理完成"

echo
echo "========================================"
echo "🎉 KBird 服务已完全停止！"
echo "========================================"
echo
