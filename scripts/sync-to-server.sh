#!/bin/bash
# KBird 代码同步脚本

SERVER_PATH="~/ubuntu-release/build"
SERVER_USER="fral"
SERVER_HOST="47.121.183.57"

echo "🔄 开始同步代码到服务器..."

# 排除不需要同步的目录和文件
EXCLUDE_PATTERNS=(
    "node_modules"
    ".next"
    ".git"
    "*.log"
    "uploads"
    "backups"
    "*.tmp"
    "*.temp"
)

# 构建rsync命令
EXCLUDE_ARGS=""
for pattern in "${EXCLUDE_PATTERNS[@]}"; do
    EXCLUDE_ARGS="$EXCLUDE_ARGS --exclude=$pattern"
done

# 同步命令
SYNC_COMMAND="rsync -avz --delete $EXCLUDE_ARGS ./ $SERVER_USER@$SERVER_HOST:$SERVER_PATH"

echo "📤 执行同步命令: $SYNC_COMMAND"

# 执行同步
if $SYNC_COMMAND; then
    echo "✅ 代码同步完成！"
    
    # 询问是否重启服务
    read -p "是否重启服务器上的PM2服务? (y/n): " restart
    if [[ $restart == "y" || $restart == "Y" ]]; then
        echo "🔄 重启服务器服务..."
        ssh $SERVER_USER@$SERVER_HOST "cd $SERVER_PATH && pm2 restart all"
        echo "✅ 服务重启完成！"
    fi
else
    echo "❌ 同步失败"
    echo "💡 请确保已安装rsync和ssh"
fi

