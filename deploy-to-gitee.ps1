# KBird 部署到Gitee脚本
# 使用方法: .\deploy-to-gitee.ps1 [-Version "v1.0.0"] [-Message "更新说明"]

param(
    [string]$Version = "v$(Get-Date -Format 'yyyy.MM.dd')",
    [string]$Message = "KBird 自动更新 - $Version",
    [string]$GiteeRepo = "",
    [switch]$DryRun = $false
)

# 设置UTF-8编码
$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "========================================" -ForegroundColor Green
Write-Host "        KBird 部署到Gitee脚本" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

# 检查是否在发布版本目录中
if (-not (Test-Path "KBird-release")) {
    Write-Host "❌ 错误: 未找到KBird-release目录" -ForegroundColor Red
    Write-Host "请先运行: .\sync-to-release.ps1" -ForegroundColor Yellow
    exit 1
}

# 切换到发布版本目录
Push-Location "KBird-release"

try {
    Write-Host "[1/5] 检查Git仓库状态..." -ForegroundColor Cyan
    
    # 检查是否是Git仓库
    if (-not (Test-Path ".git")) {
        Write-Host "📁 初始化Git仓库..." -ForegroundColor Yellow
        git init
        if ($LASTEXITCODE -ne 0) {
            throw "Git初始化失败"
        }
    }
    
    # 检查远程仓库
    $RemoteUrl = git remote get-url origin 2>$null
    if (-not $RemoteUrl -and $GiteeRepo) {
        Write-Host "🔗 添加远程仓库: $GiteeRepo" -ForegroundColor Yellow
        git remote add origin $GiteeRepo
    }
    
    Write-Host ""
    Write-Host "[2/5] 添加文件到Git..." -ForegroundColor Cyan
    
    # 添加所有文件
    git add .
    if ($LASTEXITCODE -ne 0) {
        throw "Git添加文件失败"
    }
    
    # 检查是否有更改
    $GitStatus = git status --porcelain
    if (-not $GitStatus) {
        Write-Host "ℹ️  没有文件更改，跳过提交" -ForegroundColor Blue
        return
    }
    
    Write-Host "📝 发现更改的文件:" -ForegroundColor Yellow
    $GitStatus | ForEach-Object { Write-Host "  • $($_.Trim())" -ForegroundColor Gray }
    
    Write-Host ""
    Write-Host "[3/5] 提交更改..." -ForegroundColor Cyan
    
    if ($DryRun) {
        Write-Host "🔍 预览模式 - 将提交: $Message" -ForegroundColor Yellow
    } else {
        git commit -m $Message
        if ($LASTEXITCODE -ne 0) {
            throw "Git提交失败"
        }
        Write-Host "✅ 提交完成" -ForegroundColor Green
    }
    
    Write-Host ""
    Write-Host "[4/5] 创建版本标签..." -ForegroundColor Cyan
    
    if ($DryRun) {
        Write-Host "🔍 预览模式 - 将创建标签: $Version" -ForegroundColor Yellow
    } else {
        # 删除已存在的标签
        git tag -d $Version 2>$null
        git tag $Version
        if ($LASTEXITCODE -ne 0) {
            throw "创建标签失败"
        }
        Write-Host "✅ 标签创建完成: $Version" -ForegroundColor Green
    }
    
    Write-Host ""
    Write-Host "[5/5] 推送到远程仓库..." -ForegroundColor Cyan
    
    if ($RemoteUrl) {
        if ($DryRun) {
            Write-Host "🔍 预览模式 - 将推送到: $RemoteUrl" -ForegroundColor Yellow
        } else {
            # 推送代码和标签
            git push origin master
            if ($LASTEXITCODE -ne 0) {
                Write-Host "⚠️  推送代码失败，尝试强制推送..." -ForegroundColor Yellow
                git push origin master --force
                if ($LASTEXITCODE -ne 0) {
                    throw "推送代码失败"
                }
            }
            
            git push origin $Version
            if ($LASTEXITCODE -ne 0) {
                Write-Host "⚠️  推送标签失败，尝试强制推送..." -ForegroundColor Yellow
                git push origin $Version --force
                if ($LASTEXITCODE -ne 0) {
                    throw "推送标签失败"
                }
            }
            
            Write-Host "✅ 推送完成" -ForegroundColor Green
        }
    } else {
        Write-Host "⚠️  未配置远程仓库，跳过推送" -ForegroundColor Yellow
        Write-Host "请运行: git remote add origin <你的Gitee仓库地址>" -ForegroundColor Gray
    }
    
} catch {
    Write-Host "❌ 错误: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
} finally {
    Pop-Location
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "🎉 KBird 部署完成！" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "📊 部署信息:" -ForegroundColor Cyan
Write-Host "  • 版本: $Version" -ForegroundColor Blue
Write-Host "  • 提交信息: $Message" -ForegroundColor Gray
Write-Host "  • 远程仓库: $RemoteUrl" -ForegroundColor Gray
Write-Host "  • 部署时间: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Gray
Write-Host ""

if ($DryRun) {
    Write-Host "🔍 这是预览模式，没有实际执行Git操作" -ForegroundColor Yellow
} else {
    Write-Host "✅ 部署完成！可以访问Gitee仓库查看更新" -ForegroundColor Green
}

Write-Host ""
