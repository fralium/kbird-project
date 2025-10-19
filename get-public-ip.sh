#!/bin/bash

# 获取公网IP的脚本
# 支持多种方法获取公网IP

get_public_ip() {
    local public_ip=""
    
    # 方法1: 使用curl获取
    if command -v curl &> /dev/null; then
        public_ip=$(curl -s --connect-timeout 5 http://ipinfo.io/ip 2>/dev/null)
        if [ $? -eq 0 ] && [ -n "$public_ip" ]; then
            echo "$public_ip"
            return 0
        fi
    fi
    
    # 方法2: 使用wget获取
    if command -v wget &> /dev/null; then
        public_ip=$(wget -qO- --timeout=5 http://ipinfo.io/ip 2>/dev/null)
        if [ $? -eq 0 ] && [ -n "$public_ip" ]; then
            echo "$public_ip"
            return 0
        fi
    fi
    
    # 方法3: 使用其他服务
    if command -v curl &> /dev/null; then
        public_ip=$(curl -s --connect-timeout 5 http://icanhazip.com 2>/dev/null)
        if [ $? -eq 0 ] && [ -n "$public_ip" ]; then
            echo "$public_ip"
            return 0
        fi
    fi
    
    # 方法4: 使用ifconfig获取（作为备选）
    if command -v ifconfig &> /dev/null; then
        public_ip=$(ifconfig | grep -oP 'inet \K(?:[0-9]{1,3}\.){3}[0-9]{1,3}' | grep -v '127.0.0.1' | head -1)
        if [ -n "$public_ip" ]; then
            echo "$public_ip"
            return 0
        fi
    fi
    
    # 如果所有方法都失败，返回默认值
    echo "47.121.183.57"
    return 1
}

# 获取公网IP
PUBLIC_IP=$(get_public_ip)
echo "检测到的公网IP: $PUBLIC_IP"
echo "$PUBLIC_IP"
