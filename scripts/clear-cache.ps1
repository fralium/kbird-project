# 清除 Next.js 缓存脚本
Write-Host "正在清除 Next.js 缓存..." -ForegroundColor Yellow

# 清除 .next 目录
if (Test-Path .next) {
    Write-Host "删除 .next 目录..." -ForegroundColor Cyan
    Remove-Item -Recurse -Force .next
    Write-Host "✓ .next 目录已删除" -ForegroundColor Green
} else {
    Write-Host "✓ .next 目录不存在" -ForegroundColor Green
}

# 清除 node_modules/.cache 目录（如果存在）
if (Test-Path node_modules\.cache) {
    Write-Host "删除 node_modules/.cache 目录..." -ForegroundColor Cyan
    Remove-Item -Recurse -Force node_modules\.cache
    Write-Host "✓ node_modules/.cache 目录已删除" -ForegroundColor Green
} else {
    Write-Host "✓ node_modules/.cache 目录不存在" -ForegroundColor Green
}

Write-Host ""
Write-Host "缓存清除完成！" -ForegroundColor Green
Write-Host "请重启开发服务器: npm run dev" -ForegroundColor Yellow
