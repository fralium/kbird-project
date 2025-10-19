# Git 中文编码配置脚本 (PowerShell版本)
# 解决Gitee上中文乱码问题

Write-Host "========================================" -ForegroundColor Green
Write-Host "     Git 中文编码配置脚本" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

# 设置Git全局配置
Write-Host "配置Git中文编码..." -ForegroundColor Cyan

# 禁用路径引号
git config --global core.quotepath false

# 设置提交编码为UTF-8
git config --global i18n.commitencoding utf-8

# 设置日志输出编码为UTF-8
git config --global i18n.logoutputencoding utf-8

# 设置推送编码为UTF-8
git config --global push.default simple

Write-Host "✅ Git编码配置完成" -ForegroundColor Green
Write-Host ""

# 显示当前配置
Write-Host "当前Git配置：" -ForegroundColor Yellow
Write-Host "core.quotepath: $(git config --global core.quotepath)" -ForegroundColor Gray
Write-Host "i18n.commitencoding: $(git config --global i18n.commitencoding)" -ForegroundColor Gray
Write-Host "i18n.logoutputencoding: $(git config --global i18n.logoutputencoding)" -ForegroundColor Gray
Write-Host ""

Write-Host "========================================" -ForegroundColor Green
Write-Host "🎉 配置完成！现在可以正常使用中文提交信息了" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

Write-Host "使用建议：" -ForegroundColor Cyan
Write-Host "1. 提交信息使用英文，避免编码问题" -ForegroundColor Gray
Write-Host "2. 如果必须使用中文，确保终端支持UTF-8" -ForegroundColor Gray
Write-Host "3. 使用 git commit -m message 而不是交互式提交" -ForegroundColor Gray
Write-Host ""
