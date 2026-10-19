# KBird Windows 生产环境启动脚本

Write-Host "========================================" -ForegroundColor Green
Write-Host "        KBird Windows生产环境启动" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

# 检查是否在正确的目录
if (-not (Test-Path "package.json")) {
    Write-Host "❌ 请在项目根目录运行此脚本" -ForegroundColor Red
    Read-Host "按任意键退出"
    exit 1
}

# 检查Node.js是否安装
try {
    $nodeVersion = node --version
    Write-Host "✅ Node.js 版本: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ 错误: Node.js 未安装" -ForegroundColor Red
    Read-Host "按任意键退出"
    exit 1
}

# 检查npm是否安装
try {
    $npmVersion = npm --version
    Write-Host "✅ npm 版本: $npmVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ 错误: npm 未安装" -ForegroundColor Red
    Read-Host "按任意键退出"
    exit 1
}

Write-Host ""
Write-Host "[1/4] 检查依赖..." -ForegroundColor Yellow
if (-not (Test-Path "node_modules")) {
    Write-Host "📦 安装依赖包..." -ForegroundColor Blue
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ 依赖安装失败" -ForegroundColor Red
        Read-Host "按任意键退出"
        exit 1
    }
} else {
    Write-Host "✅ 依赖已存在" -ForegroundColor Green
}

Write-Host ""
Write-Host "[2/4] 检查数据目录与环境配置..." -ForegroundColor Yellow
if (Test-Path "scripts\ensure-kbird-data.js") {
    node scripts/ensure-kbird-data.js
    Write-Host "✅ KBird-Data 与 .env 配置已就绪" -ForegroundColor Green
}

Write-Host ""
Write-Host "[3/4] 构建前端应用..." -ForegroundColor Yellow
Write-Host "🔄 正在构建生产版本..." -ForegroundColor Blue
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ 前端构建失败" -ForegroundColor Red
    Read-Host "按任意键退出"
    exit 1
}
Write-Host "✅ 前端生产构建完成" -ForegroundColor Green

Write-Host ""
Write-Host "[4/4] 启动服务..." -ForegroundColor Yellow
Write-Host "启动后端服务 (端口 13082)..." -ForegroundColor Blue
Start-Process powershell -ArgumentList "-NoExit", "-Command", "npm run server" -WindowStyle Normal
Start-Sleep -Seconds 3

Write-Host ""
Write-Host "启动前端服务 (端口 13080)..." -ForegroundColor Blue
Start-Process powershell -ArgumentList "-NoExit", "-Command", "npm run start" -WindowStyle Normal

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "🎉 KBird 生产环境启动完成！" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "📊 服务信息:" -ForegroundColor Cyan
Write-Host "  • 前端服务: http://localhost:13080 (生产模式)" -ForegroundColor White
Write-Host "  • 后端服务: http://localhost:13082" -ForegroundColor White
Write-Host ""
Write-Host "🔧 生产环境特性:" -ForegroundColor Cyan
Write-Host "  • 代码压缩和优化" -ForegroundColor White
Write-Host "  • 静态资源优化" -ForegroundColor White
Write-Host "  • 安全头设置" -ForegroundColor White
Write-Host "  • 性能优化" -ForegroundColor White
Write-Host ""
Write-Host "🛑 停止服务: 关闭对应的PowerShell窗口或运行 stop-windows.ps1" -ForegroundColor Yellow
Write-Host ""
Write-Host "✅ 生产环境启动完成！" -ForegroundColor Green
Read-Host "按任意键退出"
