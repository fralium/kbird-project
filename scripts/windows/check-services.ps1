# KBird 服务状态检查脚本

Write-Host "========================================" -ForegroundColor Green
Write-Host "   KBird 服务状态检查" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

# 检查Node.js进程
Write-Host "[1/4] 检查 Node.js 进程..." -ForegroundColor Yellow
$nodeProcesses = Get-Process -Name "node" -ErrorAction SilentlyContinue
if ($nodeProcesses) {
    Write-Host "✅ 找到 $($nodeProcesses.Count) 个 Node.js 进程:" -ForegroundColor Green
    $nodeProcesses | ForEach-Object {
        Write-Host "   PID: $($_.Id) | 内存: $([math]::Round($_.WorkingSet64/1MB, 2)) MB" -ForegroundColor White
    }
} else {
    Write-Host "❌ 未找到 Node.js 进程" -ForegroundColor Red
}

# 检查端口监听
Write-Host ""
Write-Host "[2/4] 检查端口监听..." -ForegroundColor Yellow
$port13080 = Get-NetTCPConnection -LocalPort 13080 -ErrorAction SilentlyContinue
$port13082 = Get-NetTCPConnection -LocalPort 13082 -ErrorAction SilentlyContinue

if ($port13080) {
    Write-Host "✅ 端口 13080 (前端) 正在监听" -ForegroundColor Green
    Write-Host "   状态: $($port13080.State) | PID: $($port13080.OwningProcess)" -ForegroundColor White
} else {
    Write-Host "❌ 端口 13080 (前端) 未监听" -ForegroundColor Red
}

if ($port13082) {
    Write-Host "✅ 端口 13082 (后端) 正在监听" -ForegroundColor Green
    Write-Host "   状态: $($port13082.State) | PID: $($port13082.OwningProcess)" -ForegroundColor White
} else {
    Write-Host "❌ 端口 13082 (后端) 未监听" -ForegroundColor Red
}

# 检查MongoDB服务
Write-Host ""
Write-Host "[3/4] 检查 MongoDB 服务..." -ForegroundColor Yellow
$mongoService = Get-Service -Name "MongoDB" -ErrorAction SilentlyContinue
if ($mongoService) {
    if ($mongoService.Status -eq "Running") {
        Write-Host "✅ MongoDB 服务正在运行" -ForegroundColor Green
    } else {
        Write-Host "⚠️  MongoDB 服务已安装但未运行" -ForegroundColor Yellow
        Write-Host "   状态: $($mongoService.Status)" -ForegroundColor White
    }
} else {
    Write-Host "⚠️  MongoDB 服务未安装或未配置为Windows服务" -ForegroundColor Yellow
}

# 测试API连接
Write-Host ""
Write-Host "[4/4] 测试 API 连接..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:13082" -UseBasicParsing -TimeoutSec 3
    Write-Host "✅ 后端API可访问" -ForegroundColor Green
    Write-Host "   状态码: $($response.StatusCode)" -ForegroundColor White
} catch {
    Write-Host "❌ 后端API无法访问" -ForegroundColor Red
    Write-Host "   错误: $($_.Exception.Message)" -ForegroundColor White
    Write-Host ""
    Write-Host "💡 建议:" -ForegroundColor Cyan
    Write-Host "   1. 检查后端服务是否正在运行" -ForegroundColor White
    Write-Host "   2. 查看后端服务的命令行窗口是否有错误" -ForegroundColor White
    Write-Host "   3. 运行: npm run server" -ForegroundColor White
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "检查完成" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "如果发现问题，请:" -ForegroundColor Cyan
Write-Host "  1. 运行: .\scripts\windows\KBird-Desktop.bat" -ForegroundColor White
Write-Host "  2. 查看故障排除指南: docs\TROUBLESHOOTING.md" -ForegroundColor White
Write-Host ""
Read-Host "Press Enter to exit"
