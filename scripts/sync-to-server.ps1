# KBird 代码同步脚本
param(
    [string]$ServerPath = "~/ubuntu-release/build",
    [string]$ServerUser = "fral",
    [string]$ServerHost = "47.121.183.57"
)

Write-Host "🔄 开始同步代码到服务器..." -ForegroundColor Green

# 排除不需要同步的目录和文件
$excludePatterns = @(
    "node_modules",
    ".next",
    ".git",
    "*.log",
    "uploads",
    "backups",
    "*.tmp",
    "*.temp"
)

# 构建rsync命令
$excludeArgs = $excludePatterns | ForEach-Object { "--exclude=$_" }
$excludeString = $excludeArgs -join " "

# 同步命令
$syncCommand = "rsync -avz --delete $excludeString ./ $ServerUser@$ServerHost`:$ServerPath"

Write-Host "📤 执行同步命令: $syncCommand" -ForegroundColor Yellow

try {
    # 执行同步
    Invoke-Expression $syncCommand
    
    Write-Host "✅ 代码同步完成！" -ForegroundColor Green
    
    # 询问是否重启服务
    $restart = Read-Host "是否重启服务器上的PM2服务? (y/n)"
    if ($restart -eq "y" -or $restart -eq "Y") {
        Write-Host "🔄 重启服务器服务..." -ForegroundColor Yellow
        ssh $ServerUser@$ServerHost "cd $ServerPath && pm2 restart all"
        Write-Host "✅ 服务重启完成！" -ForegroundColor Green
    }
    
} catch {
    Write-Host "❌ 同步失败: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "💡 请确保已安装rsync和ssh" -ForegroundColor Yellow
}

