#!/bin/bash

# 修复Next.js SWC下载问题的脚本
# 解决部署时SWC包下载失败的问题

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
    echo "    修复Next.js SWC下载问题"
    echo "========================================"
    echo -e "${NC}"
}

print_header

print_message "开始修复SWC下载问题..."

# 方法1: 清理npm缓存
print_message "清理npm缓存..."
npm cache clean --force

# 方法2: 设置npm镜像源
print_message "设置npm镜像源..."
npm config set registry https://registry.npmmirror.com

# 方法3: 手动下载SWC包
print_message "手动下载SWC包..."

# 创建临时目录
TEMP_DIR="/tmp/swc-fix"
mkdir -p $TEMP_DIR
cd $TEMP_DIR

# 下载SWC包
SWC_VERSION="13.5.11"
ARCH="linux-x64-gnu"

print_message "下载SWC包版本: $SWC_VERSION"
wget -O swc-package.tgz "https://registry.npmmirror.com/@next/swc-$ARCH/-/swc-$ARCH-$SWC_VERSION.tgz" || {
    print_warning "镜像源下载失败，尝试官方源..."
    wget -O swc-package.tgz "https://registry.npmjs.org/@next/swc-$ARCH/-/swc-$ARCH-$SWC_VERSION.tgz" || {
        print_error "SWC包下载失败"
        exit 1
    }
}

# 解压到Next.js目录
NEXT_DIR="/var/www/kbird/node_modules/@next"
mkdir -p "$NEXT_DIR/swc-$ARCH"

print_message "安装SWC包..."
tar -xzf swc-package.tgz -C "$NEXT_DIR/swc-$ARCH" --strip-components=1

# 清理临时文件
rm -rf $TEMP_DIR

# 方法4: 设置环境变量
print_message "设置环境变量..."
export NEXT_TELEMETRY_DISABLED=1
export SWC_BINARY_PATH="$NEXT_DIR/swc-$ARCH"

# 方法5: 使用替代构建方法
print_message "尝试替代构建方法..."

cd /var/www/kbird

# 设置构建环境变量
export NODE_OPTIONS="--max-old-space-size=2048"
export NEXT_TELEMETRY_DISABLED=1

# 尝试构建
print_message "重新尝试构建..."
npm run build || {
    print_warning "标准构建失败，尝试使用webpack构建..."
    
    # 创建next.config.js备份
    cp next.config.js next.config.js.backup
    
    # 修改next.config.js使用webpack
    cat > next.config.js << 'EOF'
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['localhost'],
  },
  // 禁用SWC，使用webpack
  swcMinify: false,
  compiler: {
    // 使用webpack编译器
    removeConsole: process.env.NODE_ENV === 'production',
  },
  webpack: (config, { isServer }) => {
    // 优化webpack配置
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
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

    # 再次尝试构建
    npm run build || {
        print_error "所有构建方法都失败了"
        # 恢复原始配置
        mv next.config.js.backup next.config.js
        exit 1
    }
}

print_message "✅ 构建成功完成！"

# 恢复原始配置（如果使用了webpack）
if [ -f "next.config.js.backup" ]; then
    print_message "恢复原始配置..."
    mv next.config.js.backup next.config.js
fi

print_message "🎉 SWC问题修复完成！"
