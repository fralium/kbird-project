# KBird Windows 一键安装脚本
# 自动检测并安装所需依赖

param(
    [switch]$SkipMongoDB = $false,
    [switch]$SkipNodeJS = $false
)

Write-Host "========================================" -ForegroundColor Green
Write-Host "   KBird Windows 本地安装向导" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

$ErrorActionPreference = "Stop"

# 检查管理员权限
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "⚠️  警告: 建议以管理员身份运行此脚本以获得完整功能" -ForegroundColor Yellow
    Write-Host ""
}

# 1. 检查Node.js
Write-Host "[1/4] 检查 Node.js..." -ForegroundColor Yellow
if (-not $SkipNodeJS) {
    try {
        $nodeVersion = node --version 2>$null
        if ($nodeVersion) {
            Write-Host "✅ Node.js 已安装: $nodeVersion" -ForegroundColor Green
        } else {
            throw "Node.js not found"
        }
    } catch {
        Write-Host "❌ Node.js 未安装" -ForegroundColor Red
        Write-Host "正在打开 Node.js 下载页面..." -ForegroundColor Yellow
        Start-Process "https://nodejs.org/zh-cn/download/"
        Write-Host "请安装 Node.js LTS 版本后重新运行此脚本" -ForegroundColor Yellow
        Read-Host "按 Enter 键退出"
        exit 1
    }
} else {
    Write-Host "⏭️  跳过 Node.js 检查" -ForegroundColor Cyan
}

# 2. 检查npm
Write-Host ""
Write-Host "[2/4] 检查 npm..." -ForegroundColor Yellow
try {
    $npmVersion = npm --version 2>$null
    Write-Host "✅ npm 已安装: $npmVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ npm 未安装，请先安装 Node.js" -ForegroundColor Red
    exit 1
}

# 3. 检查MongoDB
Write-Host ""
Write-Host "[3/4] 检查 MongoDB..." -ForegroundColor Yellow
if (-not $SkipMongoDB) {
    $mongoInstalled = $false
    
    # 检查MongoDB服务
    try {
        $mongoService = Get-Service -Name "MongoDB" -ErrorAction SilentlyContinue
        if ($mongoService) {
            Write-Host "✅ MongoDB 服务已安装" -ForegroundColor Green
            $mongoInstalled = $true
        }
    } catch {}
    
    # 检查MongoDB命令
    if (-not $mongoInstalled) {
        try {
            $mongoVersion = mongod --version 2>$null
            if ($mongoVersion) {
                Write-Host "✅ MongoDB 已安装" -ForegroundColor Green
                $mongoInstalled = $true
            }
        } catch {}
    }
    
    if (-not $mongoInstalled) {
        Write-Host "❌ MongoDB 未安装" -ForegroundColor Red
        Write-Host ""
        Write-Host "MongoDB 安装选项:" -ForegroundColor Yellow
        Write-Host "  1. 自动下载并安装 MongoDB Community Edition"
        Write-Host "  2. 手动安装（推荐）"
        Write-Host "  3. 跳过（稍后手动安装）"
        Write-Host ""
        $choice = Read-Host "请选择 (1/2/3)"
        
        if ($choice -eq "1") {
            Write-Host "正在打开 MongoDB 下载页面..." -ForegroundColor Yellow
            Start-Process "https://www.mongodb.com/try/download/community"
            Write-Host "请下载并安装 MongoDB Community Edition" -ForegroundColor Yellow
            Write-Host "安装完成后，运行: .\scripts\windows\setup-mongodb.ps1" -ForegroundColor Cyan
        } elseif ($choice -eq "2") {
            Write-Host "请访问 https://www.mongodb.com/try/download/community 下载安装" -ForegroundColor Yellow
        } else {
            Write-Host "⏭️  跳过 MongoDB 安装" -ForegroundColor Cyan
            Write-Host "稍后请运行: .\scripts\windows\setup-mongodb.ps1" -ForegroundColor Yellow
        }
    }
} else {
    Write-Host "⏭️  跳过 MongoDB 检查" -ForegroundColor Cyan
}

# 4. 安装项目依赖
Write-Host ""
Write-Host "[4/4] 安装项目依赖..." -ForegroundColor Yellow
if (Test-Path "package.json") {
    Write-Host "正在安装 npm 依赖包..." -ForegroundColor Cyan
    npm install
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ 依赖安装完成" -ForegroundColor Green
    } else {
        Write-Host "❌ 依赖安装失败" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "❌ 未找到 package.json，请确保在项目根目录运行此脚本" -ForegroundColor Red
    exit 1
}

# 5. 创建环境变量文件
Write-Host ""
Write-Host "[5/5] 配置环境变量..." -ForegroundColor Yellow
if (-not (Test-Path ".env")) {
    if (Test-Path "env.example") {
        Copy-Item "env.example" ".env"
        Write-Host "✅ 已创建 .env 文件（从 env.example）" -ForegroundColor Green
        Write-Host "⚠️  请编辑 .env 文件配置数据库连接和其他设置" -ForegroundColor Yellow
    } else {
        Write-Host "⚠️  未找到 env.example，请手动创建 .env 文件" -ForegroundColor Yellow
    }
} else {
    Write-Host "✅ .env 文件已存在" -ForegroundColor Green
}

# 完成
Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "🎉 安装完成！" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "下一步:" -ForegroundColor Cyan
Write-Host "  1. 配置 .env 文件（如需要）" -ForegroundColor White
Write-Host "  2. 运行: .\scripts\windows\KBird-Desktop.bat 启动应用" -ForegroundColor White
Write-Host "  3. 或运行: npm run dev 启动开发模式" -ForegroundColor White
Write-Host ""
Read-Host "按 Enter 键退出"
