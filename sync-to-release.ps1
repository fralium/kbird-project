# KBird 主项目到发布版本同步脚本
# 使用方法: .\sync-to-release.ps1 [-Version "v1.0.0"] [-Force]

param(
    [string]$Version = "v$(Get-Date -Format 'yyyy.MM.dd')",
    [switch]$Force = $false,
    [switch]$DryRun = $false
)

# 设置UTF-8编码
$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "========================================" -ForegroundColor Green
Write-Host "    KBird 主项目到发布版本同步脚本" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

# 检查源目录和目标目录
$SourcePath = "."
$TargetPath = "KBird-release"

if (-not (Test-Path $SourcePath)) {
    Write-Host "❌ 错误: 源目录不存在: $SourcePath" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $TargetPath)) {
    Write-Host "📁 创建目标目录: $TargetPath" -ForegroundColor Yellow
    New-Item -ItemType Directory -Path $TargetPath -Force | Out-Null
}

# 定义要同步的目录和文件
$SyncItems = @(
    "components",
    "pages", 
    "server",
    "styles",
    "public",
    "data",
    "utils",
    "scripts",
    "middleware",
    "package.json",
    "package-lock.json",
    "next.config.js",
    "ecosystem.config.js",
    "docker-compose.yml",
    "Dockerfile",
    "env.example",
    "README.md",
    "favicon.ico",
    "deploy-optimized.sh",
    "docker-deploy.sh"
)

# 定义排除的文件和目录
$ExcludePatterns = @(
    "node_modules",
    "*.log",
    "logs",
    "uploads",
    "backups",
    ".git",
    ".next",
    "*.tmp",
    "*.temp",
    "*debug*",
    "*test*",
    "*temp*"
)

Write-Host "[1/4] 检查Git状态..." -ForegroundColor Cyan
try {
    $GitStatus = git status --porcelain 2>$null
    if ($LASTEXITCODE -eq 0) {
        $ModifiedFiles = $GitStatus | Where-Object { $_ -match "^\s*M" }
        if ($ModifiedFiles) {
            Write-Host "📝 发现修改的文件:" -ForegroundColor Yellow
            $ModifiedFiles | ForEach-Object { Write-Host "  • $($_.Trim())" -ForegroundColor Gray }
        }
    }
} catch {
    Write-Host "⚠️  无法检查Git状态，继续同步..." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "[2/4] 同步核心文件..." -ForegroundColor Cyan

$SyncCount = 0
$SkipCount = 0

foreach ($Item in $SyncItems) {
    $SourceItem = Join-Path $SourcePath $Item
    $TargetItem = Join-Path $TargetPath $Item
    
    if (Test-Path $SourceItem) {
        if ($DryRun) {
            Write-Host "  📋 将同步: $Item" -ForegroundColor Gray
            $SyncCount++
        } else {
            try {
                if (Test-Path $SourceItem -PathType Container) {
                    # 目录
                    if (Test-Path $TargetItem) {
                        Remove-Item $TargetItem -Recurse -Force
                    }
                    Copy-Item $SourceItem $TargetItem -Recurse -Force
                } else {
                    # 文件
                    Copy-Item $SourceItem $TargetItem -Force
                }
                Write-Host "  ✅ 已同步: $Item" -ForegroundColor Green
                $SyncCount++
            } catch {
                Write-Host "  ❌ 同步失败: $Item - $($_.Exception.Message)" -ForegroundColor Red
            }
        }
    } else {
        Write-Host "  ⚠️  源文件不存在: $Item" -ForegroundColor Yellow
        $SkipCount++
    }
}

Write-Host ""
Write-Host "[3/4] 创建发布版本脚本..." -ForegroundColor Cyan

# 创建发布版本的启动脚本
$StartScript = @"
#!/bin/bash

# 设置UTF-8编码
export LANG=zh_CN.UTF-8
export LC_ALL=zh_CN.UTF-8

echo "========================================"
echo "        KBird 发布版本启动脚本"
echo "========================================"
echo

# 检查Node.js是否安装
if ! command -v node &> /dev/null; then
    echo "❌ 错误: Node.js 未安装"
    exit 1
fi

# 检查npm是否安装
if ! command -v npm &> /dev/null; then
    echo "❌ 错误: npm 未安装"
    exit 1
fi

echo "[1/4] 检查依赖..."
if [ ! -d "node_modules" ]; then
    echo "📦 安装依赖包..."
    npm install
    if [ `$? -ne 0 ]; then
        echo "❌ 依赖安装失败"
        exit 1
    fi
else
    echo "✅ 依赖已存在"
fi

echo
echo "[2/4] 构建前端应用..."
npm run build
if [ `$? -ne 0 ]; then
    echo "❌ 前端构建失败"
    exit 1
fi
echo "✅ 前端构建完成"

echo
echo "[3/4] 启动后端服务 (端口 3002)..."
# 启动后端服务
nohup npm run server > logs/server.log 2>&1 &
BACKEND_PID=`$!
echo "✅ 后端服务已启动 (PID: `$BACKEND_PID)"

# 等待后端服务启动
echo "⏳ 等待后端服务启动..."
sleep 3

echo
echo "[4/4] 启动前端服务 (端口 3000)..."
# 启动前端服务
nohup npm start > logs/frontend.log 2>&1 &
FRONTEND_PID=`$!
echo "✅ 前端服务已启动 (PID: `$FRONTEND_PID)"

# 等待前端服务启动
echo "⏳ 等待前端服务启动..."
sleep 5

echo
echo "========================================"
echo "🎉 KBird 发布版本启动完成！"
echo "========================================"
echo
echo "📊 服务信息:"
echo "  • 后端服务: http://localhost:3002 (PID: `$BACKEND_PID)"
echo "  • 前端服务: http://localhost:3000 (PID: `$FRONTEND_PID)"
echo
echo "📝 日志文件:"
echo "  • 后端日志: logs/server.log"
echo "  • 前端日志: logs/frontend.log"
echo
echo "🛑 停止服务: ./stop.sh"
echo "🔄 重启服务: ./restart.sh"
echo

# 保存PID到文件
echo `$BACKEND_PID > .backend.pid
echo `$FRONTEND_PID > .frontend.pid

echo "✅ 服务启动完成！"
"@

if (-not $DryRun) {
    $StartScript | Out-File -FilePath "$TargetPath/start.sh" -Encoding UTF8
    Write-Host "  ✅ 已创建: start.sh" -ForegroundColor Green
}

Write-Host ""
Write-Host "[4/4] 生成同步报告..." -ForegroundColor Cyan

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "🎉 KBird 同步完成！" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "📊 同步统计:" -ForegroundColor Cyan
Write-Host "  • 同步项目: $SyncCount" -ForegroundColor Green
Write-Host "  • 跳过项目: $SkipCount" -ForegroundColor Yellow
Write-Host "  • 版本: $Version" -ForegroundColor Blue
Write-Host ""
Write-Host "📁 目标目录: $TargetPath" -ForegroundColor Gray
Write-Host "🕒 同步时间: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Gray
Write-Host ""

if ($DryRun) {
    Write-Host "🔍 这是预览模式，没有实际复制文件" -ForegroundColor Yellow
} else {
    Write-Host "✅ 同步完成！可以进入 $TargetPath 目录进行部署" -ForegroundColor Green
}

Write-Host ""
