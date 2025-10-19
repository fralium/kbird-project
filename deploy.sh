#!/bin/bash

# KBird 部署脚本
# 最终版本 - 包含所有必要功能

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
    echo "        KBird 部署脚本"
    echo "========================================"
    echo -e "${NC}"
}

print_header

# 获取公网IP
print_message "检测公网IP..."
PUBLIC_IP=$(curl -s --connect-timeout 5 http://ipinfo.io/ip 2>/dev/null || curl -s --connect-timeout 5 http://icanhazip.com 2>/dev/null || echo "47.121.183.57")
print_message "检测到的公网IP: $PUBLIC_IP"

# 询问用户确认IP
read -p "请确认公网IP是否正确 (按Enter确认，或输入正确的IP): " USER_IP
if [ -n "$USER_IP" ]; then
    PUBLIC_IP="$USER_IP"
    print_message "使用用户指定的IP: $PUBLIC_IP"
fi

# 获取内网IP
INTERNAL_IP=$(hostname -I | awk '{print $1}')
print_message "内网IP: $INTERNAL_IP"

# 1. 检查是否在正确的目录
if [ ! -f "package.json" ]; then
    print_error "❌ 请在项目根目录运行此脚本"
    print_error "请先运行: git clone https://gitee.com/fralium/kbird-project.git"
    exit 1
fi

# 停止所有现有服务
print_message "停止所有现有服务..."
pm2 stop all 2>/dev/null || true
pm2 delete all 2>/dev/null || true
pkill -f "next start" 2>/dev/null || true
pkill -f "node server/index.js" 2>/dev/null || true
sleep 3

# 2. 清理环境
print_message "清理环境..."
rm -rf node_modules package-lock.json .next
npm cache clean --force

# 3. 安装依赖
print_message "安装依赖..."
npm install --omit=optional --no-audit --no-fund

# 4. 创建环境变量文件
print_message "配置环境变量..."
cat > .env << EOF
# Database Configuration
MONGODB_URI=mongodb://localhost:27017/kbird

# JWT Secret Key
JWT_SECRET=tKe2ADRHR/Bnp4695IVBng2Ij8wmDM2s8cxw2iBrFTg=

# Server Port
PORT=3002

# File Upload Configuration
UPLOAD_PATH=./uploads
MAX_FILE_SIZE=5242880

# Frontend API URL
NEXT_PUBLIC_API_URL=http://$PUBLIC_IP:3002

# Website Configuration
SITE_NAME=KBird
SITE_DESCRIPTION=鸟类收集整理网站
SITE_URL=http://$PUBLIC_IP:3000

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

# 5. 创建缺失的API路由
print_message "创建缺失的API路由..."
mkdir -p server/routes

cat > server/routes/initRoutes.js << 'EOF'
const express = require('express');
const router = express.Router();

// @desc    检查系统初始化状态
// @route   GET /api/check-init
// @access  Public
router.get('/check-init', async (req, res) => {
  try {
    const mongoose = require('mongoose');
    const isConnected = mongoose.connection.readyState === 1;
    
    if (!isConnected) {
      return res.status(500).json({
        success: false,
        message: '数据库连接失败',
        initialized: false
      });
    }
    
    const User = require('../models/userModel');
    const userCount = await User.countDocuments();
    
    res.json({
      success: true,
      message: '系统已初始化',
      initialized: true,
      userCount: userCount,
      database: 'connected'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '系统初始化检查失败',
      error: error.message,
      initialized: false
    });
  }
});

// @desc    系统初始化
// @route   POST /api/init
// @access  Public
router.post('/init', async (req, res) => {
  try {
    const { adminUsername, adminEmail, adminPassword } = req.body;
    const User = require('../models/userModel');
    const existingAdmin = await User.findOne({ role: 'admin' });
    
    if (existingAdmin) {
      return res.json({
        success: true,
        message: '系统已初始化',
        initialized: true
      });
    }
    
    if (adminUsername && adminEmail && adminPassword) {
      const bcrypt = require('bcryptjs');
      const hashedPassword = await bcrypt.hash(adminPassword, 12);
      
      const adminUser = new User({
        username: adminUsername,
        email: adminEmail,
        password: hashedPassword,
        role: 'admin',
        isVerified: true
      });
      
      await adminUser.save();
      
      res.json({
        success: true,
        message: '系统初始化完成',
        initialized: true,
        adminCreated: true
      });
    } else {
      res.json({
        success: true,
        message: '系统初始化完成',
        initialized: true,
        adminCreated: false
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '系统初始化失败',
      error: error.message,
      initialized: false
    });
  }
});

module.exports = router;
EOF

# 6. 更新server/index.js
print_message "更新后端服务配置..."
if [ -f "server/index.js" ]; then
    # 添加初始化路由（如果不存在）
    if ! grep -q "initRoutes" server/index.js; then
        sed -i '/app.use.*uploadRoutes.*/a app.use("/api", require("./routes/initRoutes")); // 初始化路由' server/index.js
    fi
    
    # 确保绑定到所有网络接口
    sed -i "s/app.listen(PORT,/app.listen(PORT, '0.0.0.0',/g" server/index.js
fi

# 7. 创建Next.js配置
print_message "配置Next.js..."
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

# 8. 跳过构建，交给start.sh处理
print_message "跳过构建，将在启动时进行构建..."

# 9. 启动MongoDB
print_message "启动MongoDB..."
sudo systemctl start mongod 2>/dev/null || true
sudo systemctl enable mongod 2>/dev/null || true

# 10. 创建logs目录
print_message "创建日志目录..."
mkdir -p logs

# 11. 部署完成，准备启动
print_message "部署完成，准备启动服务..."

print_message "========================================"
print_message "🎉 KBird 部署完成！"
print_message "========================================"
print_message ""
print_message "📊 服务信息:"
print_message "  • 前端: http://$PUBLIC_IP:3000"
print_message "  • 后端: http://$PUBLIC_IP:3002"
print_message ""
print_message "🚀 启动服务:"
print_message "  • 运行: ./start.sh"
print_message ""
print_message "🛠️ 管理命令:"
print_message "  • 查看状态: pm2 status"
print_message "  • 查看日志: pm2 logs"
print_message "  • 重启服务: pm2 restart all"
print_message "  • 停止服务: pm2 stop all"
print_message ""
print_message "✅ 部署成功完成！"