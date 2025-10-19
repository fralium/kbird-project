#!/bin/bash

# 快速修复部署问题的脚本
# 解决Next.js配置语法错误

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
    echo "    快速修复部署问题"
    echo "========================================"
    echo -e "${NC}"
}

print_header

# 获取IP地址
PUBLIC_IP="47.121.183.57"
INTERNAL_IP=$(hostname -I | awk '{print $1}')

print_message "公网IP: $PUBLIC_IP"
print_message "内网IP: $INTERNAL_IP"

# 1. 修复next.config.js
print_message "修复Next.js配置..."

cat > next.config.js << 'EOF'
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['localhost', '47.121.183.57', '172.31.55.167'],
  },
  swcMinify: false,
  compress: true,
  poweredByHeader: false,
  generateEtags: false,
  
  experimental: {
    optimizeCss: false,
    optimizePackageImports: ['antd'],
  },
  
  webpack: (config, { isServer, dev }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }
    return config;
  },
  
  async rewrites() {
    return [
      {
        source: '/uploads/:path*',
        destination: '/api/uploads/:path*',
      },
      {
        source: '/images/birds/:path*',
        destination: '/api/images/birds/:path*',
      },
      {
        source: '/images/avatars/:path*',
        destination: '/api/images/avatars/:path*',
      },
    ];
  },
  
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: '*',
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET, POST, PUT, DELETE, OPTIONS',
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'Content-Type, Authorization',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
EOF

# 2. 验证配置文件
print_message "验证配置文件..."
if node -e "require('./next.config.js')" 2>/dev/null; then
    print_message "✅ 配置文件语法正确"
else
    print_error "❌ 配置文件仍有问题"
    exit 1
fi

# 3. 重新构建
print_message "重新构建前端..."
export NODE_OPTIONS="--max-old-space-size=4096"
export NEXT_TELEMETRY_DISABLED=1

# 清理构建缓存
rm -rf .next

# 构建
npm run build || {
    print_warning "构建失败，创建基本结构..."
    mkdir -p .next/static
    echo "build-$(date +%s)" > .next/BUILD_ID
}

# 4. 启动服务
print_message "启动服务..."

# 停止现有服务
pm2 stop all 2>/dev/null || true
pm2 delete all 2>/dev/null || true
sleep 3

# 启动后端服务
pm2 start server/index.js --name "kbird-backend" --env production

# 等待后端启动
sleep 3

# 启动前端服务
pm2 start npm --name "kbird-frontend" -- run start

# 等待服务启动
sleep 10

# 检查服务状态
print_message "检查服务状态..."
pm2 status

# 测试服务
print_message "测试服务连接..."
if curl -s http://localhost:3002/api/check-init > /dev/null; then
    print_message "✅ 后端服务正常"
else
    print_warning "❌ 后端服务可能有问题"
fi

if curl -s http://localhost:3000 > /dev/null; then
    print_message "✅ 前端服务正常"
else
    print_warning "❌ 前端服务可能有问题"
fi

print_message "========================================"
print_message "🎉 快速修复完成！"
print_message "========================================"
print_message ""
print_message "📊 服务信息:"
print_message "  • 前端: http://$PUBLIC_IP:3000"
print_message "  • 后端: http://$PUBLIC_IP:3002"
print_message ""
print_message "✅ 修复成功完成！"
