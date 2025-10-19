#!/bin/bash

# 修复服务器IP绑定问题的脚本
# 让服务绑定到服务器IP而不是localhost

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
    echo "    修复服务器IP绑定问题"
    echo "========================================"
    echo -e "${NC}"
}

print_header

# 获取服务器IP
print_message "获取服务器IP地址..."
SERVER_IP=$(hostname -I | awk '{print $1}')
print_message "服务器IP: $SERVER_IP"

# 停止当前服务
print_message "停止当前服务..."
./stop.sh || true

# 修改start.sh脚本
print_message "修改start.sh脚本..."

# 备份原始脚本
cp start.sh start.sh.backup

# 创建新的start.sh
cat > start.sh << 'EOF'
#!/bin/bash
# KBird 发布版本启动脚本
export LANG=zh_CN.UTF-8
export LC_ALL=zh_CN.UTF-8

echo "========================================"
echo "        KBird 发布版本启动脚本"
echo "========================================"
echo

echo "[1/4] 检查依赖..."
if [ -d "node_modules" ]; then
  echo "✅ 依赖已存在"
else
  echo "⚠️ 依赖不存在，正在安装..."
  npm install --omit=optional --no-audit --no-fund || { echo "❌ 依赖安装失败"; exit 1; }
fi
echo

echo "[2/4] 构建前端应用..."
npm run build || { echo "❌ 前端构建失败"; exit 1; }
echo "✅ 前端构建完成"
echo

echo "[3/4] 启动后端服务 (端口 3002)..."
# 绑定到所有网络接口
nohup node server/index.js > logs/server.log 2>&1 &
BACKEND_PID=$!
echo "✅ 后端服务已启动 (PID: $BACKEND_PID)"
echo "⏳ 等待后端服务启动..."
sleep 3
echo

echo "[4/4] 启动前端服务 (端口 3000)..."
# 绑定到所有网络接口，使用服务器IP
nohup npx next start -H 0.0.0.0 -p 3000 > logs/frontend.log 2>&1 &
FRONTEND_PID=$!
echo "✅ 前端服务已启动 (PID: $FRONTEND_PID)"
echo "⏳ 等待前端服务启动..."
sleep 3
echo

echo "========================================"
echo "🎉 KBird 发布版本启动完成！"
echo "========================================"
echo
echo "📊 服务信息:"
echo "  • 后端服务: http://0.0.0.0:3002 (PID: $BACKEND_PID)"
echo "  • 前端服务: http://0.0.0.0:3000 (PID: $FRONTEND_PID)"
echo
echo "🌐 外部访问地址:"
echo "  • 前端: http://$(hostname -I | awk '{print $1}'):3000"
echo "  • 后端API: http://$(hostname -I | awk '{print $1}'):3002"
echo
echo "📝 日志文件:"
echo "  • 后端日志: logs/server.log"
echo "  • 前端日志: logs/frontend.log"
echo
echo "🛑 停止服务: ./stop.sh"
echo "🔄 重启服务: ./restart.sh"
echo
echo "✅ 服务启动完成！"
EOF

# 设置执行权限
chmod +x start.sh

# 修改server/index.js绑定
print_message "修改后端服务绑定..."
if [ -f "server/index.js" ]; then
    # 备份原始文件
    cp server/index.js server/index.js.backup
    
    # 修改绑定地址
    sed -i "s/app.listen(3002/app.listen(3002, '0.0.0.0'/g" server/index.js
    print_message "✅ 后端服务已修改为绑定到所有网络接口"
fi

# 创建logs目录
mkdir -p logs

# 启动服务
print_message "启动服务..."
./start.sh

print_message "✅ 服务器IP绑定修复完成！"
print_message "现在可以通过外部IP访问服务了！"
