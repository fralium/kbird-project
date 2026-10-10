# KBird Windows PowerShell停止脚本

Write-Host "========================================" -ForegroundColor Green
Write-Host "           KBird 服务停止脚本" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

Write-Host "[1/2] 停止所有服务..." -ForegroundColor Yellow
# 杀死Node.js进程
Get-Process -Name "node" -ErrorAction SilentlyContinue | Stop-Process -Force
Get-Process -Name "next" -ErrorAction SilentlyContinue | Stop-Process -Force
Write-Host "✅ 服务已停止" -ForegroundColor Green

Write-Host "[2/2] 检查并清理端口..." -ForegroundColor Yellow
# 检查端口占用并清理
$port13080 = Get-NetTCPConnection -LocalPort 13080 -ErrorAction SilentlyContinue
$port13082 = Get-NetTCPConnection -LocalPort 13082 -ErrorAction SilentlyContinue

if ($port13080) {
    Write-Host "⚠️  端口13080仍被占用，正在释放..." -ForegroundColor Yellow
    $port13080 | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
}

if ($port13082) {
    Write-Host "⚠️  端口13082仍被占用，正在释放..." -ForegroundColor Yellow
    $port13082 | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
}

Write-Host "✅ 端口清理完成" -ForegroundColor Green

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "🎉 KBird 服务已完全停止！" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Read-Host "按任意键退出"

