#!/bin/bash

# KBird Docker部署脚本
# 解决npm安装卡死问题的Docker方案

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
    echo "🐳 KBird Docker部署脚本"
    echo "=========================================="
    echo -e "${NC}"
}

# 显示欢迎信息
show_welcome() {
    print_header
    echo
    print_message "此脚本使用Docker部署，完全避免npm安装问题"
    print_message "Docker方案优势："
    print_message "  - 环境隔离，避免依赖冲突"
    print_message "  - 预构建镜像，无需本地编译"
    print_message "  - 资源控制，防止系统卡死"
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
    
    # 检查Docker
    if ! command -v docker &> /dev/null; then
        print_message "Docker未安装，将自动安装..."
        install_docker
    else
        print_message "Docker已安装: $(docker --version)"
    fi
    
    # 检查Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        print_message "Docker Compose未安装，将自动安装..."
        install_docker_compose
    else
        print_message "Docker Compose已安装: $(docker-compose --version)"
    fi
    
    print_message "系统要求检查完成"
}

# 安装Docker
install_docker() {
    print_message "安装Docker..."
    
    # 更新包索引
    sudo apt update
    
    # 安装必要的包
    sudo apt install -y \
        apt-transport-https \
        ca-certificates \
        curl \
        gnupg \
        lsb-release
    
    # 添加Docker官方GPG密钥
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
    
    # 设置稳定版仓库
    echo \
        "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu \
        $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
    
    # 安装Docker Engine
    sudo apt update
    sudo apt install -y docker-ce docker-ce-cli containerd.io
    
    # 启动Docker服务
    sudo systemctl start docker
    sudo systemctl enable docker
    
    # 将当前用户添加到docker组
    sudo usermod -aG docker $USER
    
    print_message "Docker安装完成"
}

# 安装Docker Compose
install_docker_compose() {
    print_message "安装Docker Compose..."
    
    # 下载Docker Compose
    sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    
    # 设置执行权限
    sudo chmod +x /usr/local/bin/docker-compose
    
    print_message "Docker Compose安装完成"
}

# 创建Docker配置文件
create_docker_config() {
    print_message "创建Docker配置文件..."
    
    # 创建应用目录
    sudo mkdir -p /var/www/kbird
    sudo chown $USER:$USER /var/www/kbird
    cd /var/www/kbird
    
    # 生成JWT密钥
    JWT_SECRET=$(openssl rand -base64 32)
    
    # 创建环境变量文件
    cat > .env << EOF
# Database Configuration
MONGODB_URI=mongodb://mongo:27017/kbird

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
    
    # 创建Docker Compose文件
    cat > docker-compose.yml << EOF
version: '3.8'

services:
  mongo:
    image: mongo:7.0
    container_name: kbird-mongo
    restart: unless-stopped
    ports:
      - "27017:27017"
    volumes:
      - mongo_data:/data/db
    environment:
      MONGO_INITDB_DATABASE: kbird

  backend:
    build:
      context: .
      dockerfile: Dockerfile.backend
    container_name: kbird-backend
    restart: unless-stopped
    ports:
      - "3002:3002"
    volumes:
      - ./uploads:/app/uploads
      - ./logs:/app/logs
    environment:
      - NODE_ENV=production
    env_file:
      - .env
    depends_on:
      - mongo

  frontend:
    build:
      context: .
      dockerfile: Dockerfile.frontend
    container_name: kbird-frontend
    restart: unless-stopped
    ports:
      - "3000:3000"
    volumes:
      - ./uploads:/app/uploads
      - ./public/images:/app/public/images
    environment:
      - NODE_ENV=production
    env_file:
      - .env
    depends_on:
      - backend

  nginx:
    image: nginx:alpine
    container_name: kbird-nginx
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./uploads:/var/www/uploads
      - ./public/images:/var/www/images
    depends_on:
      - frontend
      - backend

volumes:
  mongo_data:
EOF
    
    # 创建后端Dockerfile
    cat > Dockerfile.backend << 'EOF'
FROM node:20-alpine

WORKDIR /app

# 复制package文件
COPY package*.json ./

# 安装依赖（使用npm ci优化）
RUN npm ci --only=production --no-audit --no-fund

# 复制应用代码
COPY server/ ./server/
COPY utils/ ./utils/
COPY middleware/ ./middleware/

# 创建必要目录
RUN mkdir -p uploads logs

# 暴露端口
EXPOSE 3002

# 启动应用
CMD ["node", "server/index.js"]
EOF
    
    # 创建前端Dockerfile
    cat > Dockerfile.frontend << 'EOF'
FROM node:20-alpine

WORKDIR /app

# 复制package文件
COPY package*.json ./

# 安装依赖
RUN npm ci --no-audit --no-fund

# 复制应用代码
COPY . .

# 构建应用
RUN npm run build

# 创建必要目录
RUN mkdir -p uploads public/images

# 暴露端口
EXPOSE 3000

# 启动应用
CMD ["npm", "start"]
EOF
    
    # 创建Nginx配置
    cat > nginx.conf << EOF
events {
    worker_connections 1024;
}

http {
    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;
    
    sendfile        on;
    keepalive_timeout  65;
    
    # 限制请求大小
    client_max_body_size 10M;
    
    # 上游服务器
    upstream frontend {
        server frontend:3000;
    }
    
    upstream backend {
        server backend:3002;
    }
    
    server {
        listen 80;
        server_name ${SERVER_IP} ${DOMAIN};
        
        # 安全头
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-XSS-Protection "1; mode=block" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header Referrer-Policy "no-referrer-when-downgrade" always;
        
        # 静态文件
        location /uploads/ {
            alias /var/www/uploads/;
            expires 1d;
            add_header Cache-Control "public";
        }
        
        location /images/ {
            alias /var/www/images/;
            expires 1d;
            add_header Cache-Control "public";
        }
        
        # API代理
        location /api/ {
            proxy_pass http://backend/;
            proxy_http_version 1.1;
            proxy_set_header Upgrade \$http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
            proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto \$scheme;
            proxy_cache_bypass \$http_upgrade;
        }
        
        # 前端代理
        location / {
            proxy_pass http://frontend;
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
}
EOF
    
    print_message "Docker配置文件创建完成"
}

# 部署应用
deploy_app() {
    print_message "开始Docker部署..."
    
    # 克隆代码
    print_message "克隆应用代码..."
    if [[ -d "/var/www/kbird" ]]; then
        sudo rm -rf /var/www/kbird
    fi
    
    git clone https://github.com/fralium/kbird-project.git /var/www/kbird
    sudo chown -R $USER:$USER /var/www/kbird
    cd /var/www/kbird
    
    # 创建Docker配置
    create_docker_config
    
    # 构建并启动容器
    print_message "构建Docker镜像..."
    docker-compose build
    
    print_message "启动Docker容器..."
    docker-compose up -d
    
    # 等待服务启动
    print_message "等待服务启动..."
    sleep 30
    
    # 检查服务状态
    print_message "检查服务状态..."
    docker-compose ps
    
    print_message "Docker部署完成"
}

# 配置SSL (如果有域名)
configure_ssl() {
    if [[ -n "$DOMAIN" ]]; then
        print_message "配置SSL证书..."
        
        # 安装Certbot
        sudo apt install -y certbot python3-certbot-nginx
        
        # 申请证书
        sudo certbot --nginx -d $DOMAIN --non-interactive --agree-tos --email admin@$DOMAIN
        
        print_message "SSL证书配置完成"
    else
        print_warning "未设置域名，跳过SSL配置"
    fi
}

# 创建管理脚本
create_management_scripts() {
    print_message "创建管理脚本..."
    
    cd /var/www/kbird
    
    # Docker管理脚本
    cat > start.sh << 'EOF'
#!/bin/bash
docker-compose up -d
echo "KBird Docker服务已启动"
EOF
    
    cat > stop.sh << 'EOF'
#!/bin/bash
docker-compose down
echo "KBird Docker服务已停止"
EOF
    
    cat > restart.sh << 'EOF'
#!/bin/bash
docker-compose restart
echo "KBird Docker服务已重启"
EOF
    
    cat > logs.sh << 'EOF'
#!/bin/bash
docker-compose logs -f
EOF
    
    cat > update.sh << 'EOF'
#!/bin/bash
echo "更新KBird应用..."
git pull
docker-compose down
docker-compose build
docker-compose up -d
echo "更新完成"
EOF
    
    # 备份脚本
    cat > backup.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="./backups/$(date +%Y%m%d_%H%M%S)"
mkdir -p $BACKUP_DIR

# 备份数据库
docker exec kbird-mongo mongodump --db kbird --archive | gzip > $BACKUP_DIR/mongodb_backup.gz

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
    print_message "🎉 Docker部署完成！"
    echo
    print_message "访问地址："
    if [[ -n "$DOMAIN" ]]; then
        print_message "  https://$DOMAIN"
    else
        print_message "  http://$SERVER_IP"
    fi
    echo
    print_message "Docker管理命令："
    print_message "  启动: ./start.sh"
    print_message "  停止: ./stop.sh"
    print_message "  重启: ./restart.sh"
    print_message "  查看日志: ./logs.sh"
    print_message "  更新: ./update.sh"
    print_message "  备份: ./backup.sh"
    echo
    print_message "应用目录: /var/www/kbird"
    print_message "配置文件: /var/www/kbird/.env"
    print_message "Docker Compose: /var/www/kbird/docker-compose.yml"
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
    deploy_app
    configure_ssl
    create_management_scripts
    show_completion
}

# 运行主函数
main


