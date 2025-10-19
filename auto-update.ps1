# KBird 自动化更新脚本
# 使用方法: .\auto-update.ps1 [-Version "v1.0.0"] [-Message "更新说明"] [-GiteeRepo "仓库地址"]

param(
    [string]$Version = "v$(Get-Date -Format 'yyyy.MM.dd')",
    [string]$Message = "KBird 自动更新 - $Version",
    [string]$GiteeRepo = "",
    [switch]$DryRun = $false,
    [switch]$SkipSync = $false,
    [switch]$SkipDeploy = $false
)

# 设置UTF-8编码
$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "========================================" -ForegroundColor Green
Write-Host "        KBird 自动化更新脚本" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

$StartTime = Get-Date

# 步骤1: 同步到发布版本
if (-not $SkipSync) {
    Write-Host "[步骤 1/3] 同步到发布版本..." -ForegroundColor Cyan
    Write-Host ""
    
    try {
        if ($DryRun) {
            .\sync-to-release.ps1 -Version $Version -DryRun
        } else {
            .\sync-to-release.ps1 -Version $Version
        }
        
        if ($LASTEXITCODE -ne 0) {
            throw "同步到发布版本失败"
        }
        
        Write-Host "✅ 同步完成" -ForegroundColor Green
    } catch {
        Write-Host "❌ 同步失败: $($_.Exception.Message)" -ForegroundColor Red
        exit 1
    }
    
    Write-Host ""
} else {
    Write-Host "⏭️  跳过同步步骤" -ForegroundColor Yellow
    Write-Host ""
}

# 步骤2: 部署到Gitee
if (-not $SkipDeploy) {
    Write-Host "[步骤 2/3] 部署到Gitee..." -ForegroundColor Cyan
    Write-Host ""
    
    try {
        if ($DryRun) {
            .\deploy-to-gitee.ps1 -Version $Version -Message $Message -GiteeRepo $GiteeRepo -DryRun
        } else {
            .\deploy-to-gitee.ps1 -Version $Version -Message $Message -GiteeRepo $GiteeRepo
        }
        
        if ($LASTEXITCODE -ne 0) {
            throw "部署到Gitee失败"
        }
        
        Write-Host "✅ 部署完成" -ForegroundColor Green
    } catch {
        Write-Host "❌ 部署失败: $($_.Exception.Message)" -ForegroundColor Red
        exit 1
    }
    
    Write-Host ""
} else {
    Write-Host "⏭️  跳过部署步骤" -ForegroundColor Yellow
    Write-Host ""
}

# 步骤3: 生成更新报告
Write-Host "[步骤 3/3] 生成更新报告..." -ForegroundColor Cyan

$EndTime = Get-Date
$Duration = $EndTime - $StartTime

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "🎉 KBird 自动化更新完成！" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "📊 更新统计:" -ForegroundColor Cyan
Write-Host "  • 版本: $Version" -ForegroundColor Blue
Write-Host "  • 更新信息: $Message" -ForegroundColor Gray
Write-Host "  • 开始时间: $($StartTime.ToString('yyyy-MM-dd HH:mm:ss'))" -ForegroundColor Gray
Write-Host "  • 结束时间: $($EndTime.ToString('yyyy-MM-dd HH:mm:ss'))" -ForegroundColor Gray
Write-Host "  • 总耗时: $($Duration.TotalSeconds.ToString('F2')) 秒" -ForegroundColor Gray
Write-Host ""

if ($DryRun) {
    Write-Host "🔍 这是预览模式，没有实际执行更新操作" -ForegroundColor Yellow
} else {
    Write-Host "✅ 自动化更新完成！" -ForegroundColor Green
    Write-Host ""
    Write-Host "📋 后续操作建议:" -ForegroundColor Cyan
    Write-Host "  • 检查Gitee仓库是否更新成功" -ForegroundColor Gray
    Write-Host "  • 测试发布版本是否正常工作" -ForegroundColor Gray
    Write-Host "  • 更新部署文档和版本说明" -ForegroundColor Gray
}

Write-Host ""
