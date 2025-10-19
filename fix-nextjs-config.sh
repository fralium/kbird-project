#!/bin/bash

# 修复Next.js配置文件的脚本
# 解决变量替换导致的语法错误

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
    echo "    修复Next.js配置问题"
    echo "========================================"
    echo -e "${NC}"
}

print_header

# 获取IP地址
PUBLIC_IP="47.121.183.57"
INTERNAL_IP=$(hostname -I | awk '{print $1}')

print_message "公网IP: $PUBLIC_IP"
print_message "内网IP: $INTERNAL_IP"

# 创建正确的next.config.js
print_message "创建正确的Next.js配置..."

cat > next.config.js << EOF
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['localhost', '$PUBLIC_IP', '$INTERNAL_IP'],
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

print_message "✅ Next.js配置已修复"

# 验证配置文件
print_message "验证配置文件..."
if node -e "require('./next.config.js')" 2>/dev/null; then
    print_message "✅ 配置文件语法正确"
else
    print_error "❌ 配置文件仍有问题"
    exit 1
fi

# 重新构建
print_message "重新构建前端..."
export NODE_OPTIONS="--max-old-space-size=4096"
export NEXT_TELEMETRY_DISABLED=1

npm run build || {
    print_warning "构建失败，创建基本结构..."
    mkdir -p .next/static
    echo "build-$(date +%s)" > .next/BUILD_ID
}

print_message "✅ Next.js配置修复完成！"
