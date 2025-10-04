# 推送到所有远程仓库的PowerShell脚本
# 支持同时推送到Gitee和GitHub

Write-Host "🚀 推送到所有远程仓库" -ForegroundColor Green
Write-Host "====================" -ForegroundColor Green
Write-Host ""

# 检查当前分支
$currentBranch = git branch --show-current
Write-Host "📋 当前分支: $currentBranch" -ForegroundColor Yellow
Write-Host ""

# 推送到Gitee (使用master分支)
Write-Host "📤 推送到Gitee..." -ForegroundColor Cyan
git push gitee master
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Gitee推送成功" -ForegroundColor Green
} else {
    Write-Host "❌ Gitee推送失败" -ForegroundColor Red
}
Write-Host ""

# 推送到GitHub (使用main分支)
Write-Host "📤 推送到GitHub..." -ForegroundColor Cyan
git push github master:main
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ GitHub推送成功" -ForegroundColor Green
} else {
    Write-Host "❌ GitHub推送失败" -ForegroundColor Red
}
Write-Host ""

# 推送所有标签
Write-Host "🏷️  推送所有标签..." -ForegroundColor Cyan

Write-Host "推送到Gitee标签..." -ForegroundColor Gray
git push gitee --tags
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Gitee标签推送成功" -ForegroundColor Green
} else {
    Write-Host "❌ Gitee标签推送失败" -ForegroundColor Red
}

Write-Host "推送到GitHub标签..." -ForegroundColor Gray
git push github --tags
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ GitHub标签推送成功" -ForegroundColor Green
} else {
    Write-Host "❌ GitHub标签推送失败" -ForegroundColor Red
}
Write-Host ""

Write-Host "🎉 推送完成！" -ForegroundColor Green
Write-Host "📋 仓库地址:" -ForegroundColor Yellow
Write-Host "  Gitee:  https://gitee.com/fralium/kbird-project" -ForegroundColor White
Write-Host "  GitHub: https://github.com/fralium/kbird-project" -ForegroundColor White
