#!/bin/bash

# 设置UTF-8编码
export LANG=zh_CN.UTF-8
export LC_ALL=zh_CN.UTF-8

echo "========================================"
echo "           KBird 服务重启脚本"
echo "========================================"
echo

echo "[1/3] 停止现有服务..."
./stop.sh
echo

echo "[2/3] 等待服务完全停止..."
sleep 2

echo "[3/3] 重新启动服务..."
./start.sh
