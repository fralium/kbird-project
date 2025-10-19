#!/bin/bash

# KBird 优化部署脚本
# 解决npm安装卡死问题

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 配置变量
APP_NAME="kbird"
SERVER_IP=""
DOMAIN=""

# 函数：打印彩色消息
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
    echo "=========================================="
    echo "🚀 KBird 优化部署脚本 (解决npm卡死问题)"
    echo "=========================================="
    echo -e "${NC}"
}

# 显示欢迎信息
show_welcome() {
    print_header
    echo
    print_message "此脚本专门解决远程服务器npm安装卡死问题"
    print_message "采用多种优化策略确保部署成功"
    echo
}

# 获取用户输入
get_user_input() {
    echo
    print_message "请输入部署配置信息："
    echo
    
    # 获取服务器 IP
    while [[ -z "$SERVER_IP" ]]; do
        read -p "请输入服务器 IP 地址: " SERVER_IP
        if [[ -z "$SERVER_IP" ]]; then
            print_error "IP 地址不能为空"
        fi
    done
    
    # 获取域名 (可选)
    read -p "域名 (可选，直接回车跳过): " DOMAIN
    
    echo
    print_message "配置确认："
    print_message "  服务器 IP: $SERVER_IP"
    print_message "  域名: ${DOMAIN:-"未设置"}"
    echo
    
    read -p "确认开始部署？(y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_message "部署已取消"
        exit 0
    fi
}

# 检查系统要求
check_requirements() {
    print_message "检查系统要求..."
    
    # 检查是否为 root 用户
    if [[ $EUID -eq 0 ]]; then
        print_error "请不要使用 root 用户运行此脚本"
        exit 1
    fi
    
    # 检查内存
    TOTAL_MEM=$(free -m | awk 'NR==2{printf "%.0f", $2}')
    if [[ $TOTAL_MEM -lt 1024 ]]; then
        print_warning "系统内存不足1GB，npm安装可能会很慢"
        print_warning "建议使用Docker部署方案"
    fi
    
    print_message "系统要求检查完成"
}

# 安装基础环境
install_basics() {
    print_message "安装基础环境..."
    
    # 修复 MongoDB 仓库配置问题
    print_message "修复 MongoDB 仓库配置..."
    sudo rm -f /etc/apt/sources.list.d/mongodb-org-7.0.list 2>/dev/null || true
    echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu noble/mongodb-org/8.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-8.0.list
    
    # 更新系统
    sudo apt update && sudo apt upgrade -y
    
    # 安装必要软件
    print_message "安装必要软件..."
    sudo apt install -y \
        curl \
        wget \
        git \
        nginx \
        certbot \
        python3-certbot-nginx \
        ufw \
        fail2ban \
        htop \
        unzip \
        openssl \
        build-essential
    
    # 升级到 Node.js 20 (解决cross-env兼容性问题)
    print_message "升级到 Node.js 20..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt install -y nodejs
    
    # 验证Node.js版本
    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [[ $NODE_VERSION -ge 20 ]]; then
        print_message "Node.js 升级成功: $(node -v)"
    else
        print_error "Node.js 升级失败，当前版本: $(node -v)"
        exit 1
    fi
    
    # 检查并安装 PM2
    if ! command -v pm2 &> /dev/null; then
        print_message "安装 PM2..."
        sudo npm install -g pm2
    else
        print_message "PM2 已安装: $(pm2 -v)"
    fi
    
    # 检查并安装 MongoDB
    if ! command -v mongod &> /dev/null; then
        print_message "安装 MongoDB..."
        sudo apt install -y mongodb-org
    else
        print_message "MongoDB 已安装: $(mongod --version | head -n1)"
    fi
    
    # 确保 MongoDB 服务运行
    print_message "启动 MongoDB 服务..."
    sudo systemctl start mongod
    sudo systemctl enable mongod
    
    # 配置防火墙
    sudo ufw default deny incoming
    sudo ufw default allow outgoing
    sudo ufw allow ssh
    sudo ufw allow 80/tcp
    sudo ufw allow 443/tcp
    sudo ufw --force enable
    
    # 配置 fail2ban
    sudo systemctl enable fail2ban
    sudo systemctl start fail2ban
    
    print_message "基础环境安装完成"
}

# 优化npm配置
optimize_npm_config() {
    print_message "优化npm配置..."
    
    # 设置npm配置以减少内存使用
    npm config set maxsockets 1
    npm config set fetch-retry-mintimeout 20000
    npm config set fetch-retry-maxtimeout 120000
    npm config set fetch-retries 3
    npm config set fetch-timeout 300000
    
    # 设置npm缓存目录
    npm config set cache /tmp/.npm-cache
    
    # 清理npm缓存
    npm cache clean --force
    
    print_message "npm配置优化完成"
}

# 部署应用 (优化版本)
deploy_app() {
    print_message "开始部署应用..."
    
    # 确保 /var/www 目录存在并有正确权限
    print_message "设置应用目录权限..."
    sudo mkdir -p /var/www
    sudo chown $USER:$USER /var/www
    
    # 如果 kbird 目录已存在，删除并重新创建
    if [[ -d "/var/www/kbird" ]]; then
        print_message "清理现有应用目录..."
        sudo rm -rf /var/www/kbird
    fi
    
    # 克隆代码
    print_message "克隆应用代码..."
    cd /var/www
    git clone https://gitee.com/fralium/kbird-project.git kbird
    sudo chown -R $USER:$USER kbird
    cd /var/www/kbird
    zenzen
    # 生成 JWT 密钥
    JWT_SECRET=$(openssl rand -base64 32)
    
    # 配置环境变量
    print_message "配置环境变量..."
    cat > .env << EOF
# Database Configuration
MONGODB_URI=mongodb://localhost:27017/kbird

# JWT Secret Key
JWT_SECRET=$JWT_SECRET

# Server Port
PORT=3002

# File Upload Configuration
UPLOAD_PATH=./uploads
MAX_FILE_SIZE=5242880

# Frontend API URL
NEXT_PUBLIC_API_URL=http://${SERVER_IP}:3002
${DOMAIN:+NEXT_PUBLIC_API_URL=https://${DOMAIN}/api}

# Website Configuration
SITE_NAME=KBird
SITE_DESCRIPTION=鸟类收集整理网站
SITE_URL=http://${SERVER_IP}:3000
${DOMAIN:+SITE_URL=https://${DOMAIN}}

# Feature Toggles
ENABLE_REGISTRATION=true
ENABLE_COMMENTS=true
ENABLE_UPLOAD=true

# Theme Configuration
THEME=default
PRIMARY_COLOR=#4CAF50
SECONDARY_COLOR=#2196F3

# Node Environment
NODE_ENV=production
EOF
    
    # 创建必要目录
    print_message "创建必要目录..."
    mkdir -p uploads public/images logs backups
    
    # 优化npm安装过程
    print_message "开始优化npm安装过程..."
    
    # 设置npm配置以减少内存使用
    npm config set maxsockets 1
    npm config set fetch-retry-mintimeout 20000
    npm config set fetch-retry-maxtimeout 120000
    npm config set fetch-retries 3
    npm config set fetch-timeout 300000
    
    # 方法1: 使用--omit=optional减少依赖
    print_message "尝试方法1: 安装核心依赖..."
    timeout 300 npm install --omit=optional --no-audit --no-fund || {
        print_warning "方法1失败，尝试方法2..."
        
        # 方法2: 分批安装依赖
        print_message "尝试方法2: 分批安装依赖..."
        
        # 先安装核心依赖
        timeout 180 npm install --omit=dev --omit=optional --no-audit --no-fund || {
            print_warning "方法2失败，尝试方法3..."
            
            # 方法3: 使用yarn替代npm
            print_message "尝试方法3: 使用yarn安装..."
            if ! command -v yarn &> /dev/null; then
                npm install -g yarn
            fi
            
            timeout 300 yarn install --production --ignore-engines || {
                print_error "所有安装方法都失败了"
                print_message "建议使用Docker部署方案"
                exit 1
            }
        }
    }
    
    # 安装开发依赖（如果需要构建）
    if [[ -f "package.json" ]] && grep -q "devDependencies" package.json; then
        print_message "安装开发依赖..."
        timeout 120 npm install --include=dev --omit=optional --no-audit --no-fund || {
            print_warning "开发依赖安装失败，跳过..."
        }
    fi
    
    # 修复next.config.js配置问题
    print_message "检查并修复Next.js配置..."
    if [[ -f "next.config.js" ]]; then
        # 移除可能存在的无效api配置
        sed -i '/api:/d' next.config.js 2>/dev/null || true
        # 确保配置文件格式正确
        if ! node -e "require('./next.config.js')" 2>/dev/null; then
            print_warning "next.config.js配置有问题，使用默认配置..."
            cat > next.config.js << 'EOF'
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['localhost'],
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
        fi
    fi
    
    # 修复SWC下载问题
    print_message "修复SWC下载问题..."
    
    # 方法1: 降级到Next.js 12.x稳定版本
    print_message "降级到Next.js 12.x稳定版本..."
    
    # 备份package.json
    cp package.json package.json.backup
    
    # 修改package.json使用稳定版本
    sed -i 's/"next": "^14.0.0"/"next": "^12.3.4"/' package.json
    sed -i 's/"eslint-config-next": "^14.0.0"/"eslint-config-next": "^12.3.4"/' package.json
    sed -i 's/"eslint": "^9.0.0"/"eslint": "^8.57.0"/' package.json
    
    # 重新安装依赖
    print_message "重新安装依赖..."
    rm -rf node_modules package-lock.json
    npm install
    
    # 设置环境变量
    export NEXT_TELEMETRY_DISABLED=1
    export NODE_OPTIONS="--max-old-space-size=2048"
    
    # 构建应用
    print_message "构建应用..."
    
    # 设置构建环境变量
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
    
    # 使用超时构建
    print_message "使用超时构建 (10分钟)..."
    timeout 600 npm run build || {
        print_warning "标准构建失败，尝试使用webpack构建..."
        
        # 创建next.config.js备份
        cp next.config.js next.config.js.backup
        
        # 修改配置使用webpack
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
    removeConsole: process.env.NODE_ENV === 'production',
  },
  webpack: (config, { isServer }) => {
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
        timeout 300 npm run build || {
            print_error "应用构建失败"
            # 恢复原始配置
            mv next.config.js.backup next.config.js 2>/dev/null || true
            exit 1
        }
        
        # 恢复原始配置
        mv next.config.js.backup next.config.js 2>/dev/null || true
    }
    
    # 确保 MongoDB 正在运行
    print_message "启动 MongoDB..."
    sudo systemctl start mongod
    sudo systemctl enable mongod
    
    # 停止现有进程
    print_message "停止现有应用进程..."
    pm2 delete kbird-backend 2>/dev/null || true
    pm2 delete kbird-frontend 2>/dev/null || true
    
    # 启动应用
    print_message "启动应用服务..."
    pm2 start server/index.js --name "kbird-backend" --env production
    pm2 start npm --name "kbird-frontend" -- start
    
    # 保存 PM2 配置
    pm2 save
    pm2 startup
    
    print_message "应用部署完成"
}

# 配置 Nginx
configure_nginx() {
    print_message "配置 Nginx..."
    
    # 创建 Nginx 配置
    sudo tee /etc/nginx/sites-available/$APP_NAME << EOF
server {
    listen 80;
    server_name ${SERVER_IP} ${DOMAIN};
    
    # 安全头
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    
    # 客户端配置
    client_max_body_size 10M;
    
    # 静态文件
    location /_next/static/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_cache_valid 200 1d;
        add_header Cache-Control "public, immutable";
    }
    
    location /uploads/ {
        alias /var/www/kbird/uploads/;
        expires 1d;
        add_header Cache-Control "public";
    }
    
    location /images/ {
        alias /var/www/kbird/public/images/;
        expires 1d;
        add_header Cache-Control "public";
    }
    
    # API 代理
    location /api/ {
        proxy_pass http://127.0.0.1:3002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }
    
    # 前端代理
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF
    
    # 启用站点
    sudo ln -sf /etc/nginx/sites-available/$APP_NAME /etc/nginx/sites-enabled/
    sudo rm -f /etc/nginx/sites-enabled/default
    
    # 测试并重启 Nginx
    sudo nginx -t
    sudo systemctl restart nginx
    sudo systemctl enable nginx
    
    print_message "Nginx 配置完成"
}

# 配置 SSL (如果有域名)
configure_ssl() {
    if [[ -n "$DOMAIN" ]]; then
        print_message "配置 SSL 证书..."
        
        # 安装 Certbot
        sudo snap install --classic certbot
        sudo ln -sf /snap/bin/certbot /usr/bin/certbot
        
        # 申请证书
        sudo certbot --nginx -d $DOMAIN --non-interactive --agree-tos --email admin@$DOMAIN
        
        print_message "SSL 证书配置完成"
    else
        print_warning "未设置域名，跳过 SSL 配置"
    fi
}

# 创建管理脚本
create_management_scripts() {
    print_message "创建管理脚本..."
    
    cd /var/www/kbird
    
    # PM2 管理脚本
    cat > start.sh << 'EOF'
#!/bin/bash
pm2 start all
echo "KBird 已启动"
EOF
    
    cat > stop.sh << 'EOF'
#!/bin/bash
pm2 stop all
echo "KBird 已停止"
EOF
    
    cat > restart.sh << 'EOF'
#!/bin/bash
pm2 restart all
echo "KBird 已重启"
EOF
    
    cat > logs.sh << 'EOF'
#!/bin/bash
pm2 logs
EOF
    
    # 通用备份脚本
    cat > backup.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="./backups/$(date +%Y%m%d_%H%M%S)"
mkdir -p $BACKUP_DIR

# 备份数据库
if command -v mongodump &> /dev/null; then
    mongodump --db kbird --archive | gzip > $BACKUP_DIR/mongodb_backup.gz
fi

# 备份上传文件
cp -r uploads $BACKUP_DIR/
cp -r public/images $BACKUP_DIR/

echo "备份完成: $BACKUP_DIR"
EOF
    
    # 设置执行权限
    chmod +x *.sh
    
    print_message "管理脚本已创建"
}

# 显示完成信息
show_completion() {
    echo
    print_message "🎉 部署完成！"
    echo
    print_message "访问地址："
    if [[ -n "$DOMAIN" ]]; then
        print_message "  https://$DOMAIN"
    else
        print_message "  http://$SERVER_IP"
    fi
    echo
    print_message "管理命令："
    print_message "  启动: ./start.sh"
    print_message "  停止: ./stop.sh"
    print_message "  重启: ./restart.sh"
    print_message "  查看日志: ./logs.sh"
    print_message "  备份: ./backup.sh"
    echo
    print_message "应用目录: /var/www/kbird"
    print_message "配置文件: /var/www/kbird/.env"
    print_message "Nginx 配置: /etc/nginx/sites-available/$APP_NAME"
    echo
    print_message "下一步："
    print_message "  1. 访问网站确认部署成功"
    print_message "  2. 注册管理员账户"
    print_message "  3. 开始添加鸟类数据"
    echo
}

# 主函数
main() {
    show_welcome
    get_user_input
    check_requirements
    install_basics
    optimize_npm_config
    deploy_app
    configure_nginx
    configure_ssl
    create_management_scripts
    show_completion
}

# 运行主函数
main
