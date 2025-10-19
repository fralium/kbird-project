#!/bin/bash

# 修复构建超时问题的脚本
# 解决Next.js构建卡住的问题

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
    echo "    修复构建超时问题"
    echo "========================================"
    echo -e "${NC}"
}

print_header

# 检查当前状态
print_message "检查当前构建状态..."

# 检查是否有构建进程在运行
if pgrep -f "next build" > /dev/null; then
    print_warning "发现正在运行的构建进程，正在终止..."
    pkill -f "next build" || true
    sleep 2
fi

# 检查内存使用情况
print_message "检查系统资源..."
echo "内存使用情况:"
free -h
echo ""
echo "磁盘使用情况:"
df -h /var/www/kbird

# 方法1: 增加内存限制
print_message "方法1: 增加Node.js内存限制..."

# 设置环境变量
export NODE_OPTIONS="--max-old-space-size=4096"
export NEXT_TELEMETRY_DISABLED=1

# 创建优化的next.config.js
print_message "创建优化的Next.js配置..."
cat > next.config.js << 'EOF'
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['localhost'],
  },
  // 禁用SWC，使用webpack
  swcMinify: false,
  // 优化构建
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  // 减少构建时间
  experimental: {
    optimizeCss: false,
    optimizePackageImports: ['antd'],
  },
  webpack: (config, { isServer, dev }) => {
    // 优化webpack配置
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }
    
    // 减少构建时间
    if (!dev) {
      config.optimization.splitChunks = {
        chunks: 'all',
        cacheGroups: {
          default: {
            minChunks: 1,
            priority: -20,
            reuseExistingChunk: true,
          },
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            priority: -10,
            chunks: 'all',
          },
        },
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

# 方法2: 清理并重新安装
print_message "方法2: 清理并重新安装依赖..."
rm -rf node_modules package-lock.json .next
npm cache clean --force

# 分批安装依赖
print_message "分批安装依赖..."
npm install --omit=optional --no-audit --no-fund

# 方法3: 使用超时和重试机制
print_message "方法3: 使用超时构建..."

# 创建构建脚本
cat > build-with-timeout.sh << 'EOF'
#!/bin/bash

# 设置超时时间（10分钟）
TIMEOUT=600

# 构建函数
build_app() {
    echo "开始构建应用..."
    timeout $TIMEOUT npm run build
    return $?
}

# 重试机制
MAX_RETRIES=3
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    echo "尝试构建 (第 $((RETRY_COUNT + 1)) 次)..."
    
    if build_app; then
        echo "✅ 构建成功！"
        exit 0
    else
        RETRY_COUNT=$((RETRY_COUNT + 1))
        if [ $RETRY_COUNT -lt $MAX_RETRIES ]; then
            echo "⚠️ 构建失败，等待30秒后重试..."
            sleep 30
            
            # 清理可能的残留进程
            pkill -f "next build" || true
            sleep 5
        fi
    fi
done

echo "❌ 构建失败，已尝试 $MAX_RETRIES 次"
exit 1
EOF

chmod +x build-with-timeout.sh

# 执行构建
print_message "执行超时构建..."
./build-with-timeout.sh || {
    print_warning "标准构建失败，尝试Docker构建..."
    
    # 方法4: 使用Docker构建
    print_message "方法4: 使用Docker构建..."
    
    cat > Dockerfile.build << 'EOF'
FROM node:18-alpine

WORKDIR /app

# 复制package文件
COPY package*.json ./

# 安装依赖
RUN npm install --omit=optional

# 复制源代码
COPY . .

# 构建应用
RUN npm run build

# 复制构建结果
RUN cp -r .next /build-output
EOF

    # 使用Docker构建
    docker build -f Dockerfile.build -t kbird-build .
    docker run --name kbird-build-container kbird-build
    docker cp kbird-build-container:/build-output ./next-build
    docker rm kbird-build-container
    
    # 复制构建结果
    cp -r next-build/.next ./
    rm -rf next-build Dockerfile.build
}

# 清理临时文件
rm -f build-with-timeout.sh

print_message "✅ 构建修复完成！"
