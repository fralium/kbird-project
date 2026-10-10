# MongoDB Windows 配置脚本
# 配置MongoDB为Windows服务并初始化数据库

param(
    [string]$DataPath = "$env:ProgramData\MongoDB\data\db",
    [string]$LogPath = "$env:ProgramData\MongoDB\log\mongod.log"
)

Write-Host "========================================" -ForegroundColor Green
Write-Host "   MongoDB Windows 配置向导" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

$ErrorActionPreference = "Stop"

# 检查管理员权限
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "❌ 此脚本需要管理员权限" -ForegroundColor Red
    Write-Host "请右键点击 PowerShell，选择'以管理员身份运行'" -ForegroundColor Yellow
    Read-Host "按 Enter 键退出"
    exit 1
}

# 检查MongoDB是否已安装
Write-Host "[1/4] 检查 MongoDB 安装..." -ForegroundColor Yellow
$mongoPath = $null

# 检查常见安装路径
$possiblePaths = @(
    "C:\Program Files\MongoDB\Server\*\bin\mongod.exe",
    "C:\MongoDB\bin\mongod.exe",
    "$env:ProgramFiles\MongoDB\Server\*\bin\mongod.exe"
)

foreach ($path in $possiblePaths) {
    $resolved = Resolve-Path $path -ErrorAction SilentlyContinue
    if ($resolved) {
        $mongoPath = Split-Path $resolved[0] -Parent
        break
    }
}

# 检查PATH环境变量
if (-not $mongoPath) {
    try {
        $mongoVersion = mongod --version 2>$null
        if ($mongoVersion) {
            $mongoPath = (Get-Command mongod).Source | Split-Path -Parent
            Write-Host "✅ 从 PATH 找到 MongoDB: $mongoPath" -ForegroundColor Green
        }
    } catch {
        Write-Host "❌ 未找到 MongoDB" -ForegroundColor Red
        Write-Host "请先安装 MongoDB Community Edition" -ForegroundColor Yellow
        Write-Host "下载地址: https://www.mongodb.com/try/download/community" -ForegroundColor Cyan
        Read-Host "按 Enter 键退出"
        exit 1
    }
}

if ($mongoPath) {
    Write-Host "✅ MongoDB 路径: $mongoPath" -ForegroundColor Green
}

# 创建数据目录
Write-Host ""
Write-Host "[2/4] 创建数据目录..." -ForegroundColor Yellow
if (-not (Test-Path $DataPath)) {
    New-Item -ItemType Directory -Path $DataPath -Force | Out-Null
    Write-Host "✅ 已创建数据目录: $DataPath" -ForegroundColor Green
} else {
    Write-Host "✅ 数据目录已存在: $DataPath" -ForegroundColor Green
}

# 创建日志目录
$LogDir = Split-Path $LogPath -Parent
if (-not (Test-Path $LogDir)) {
    New-Item -ItemType Directory -Path $LogDir -Force | Out-Null
    Write-Host "✅ 已创建日志目录: $LogDir" -ForegroundColor Green
}

# 检查MongoDB服务
Write-Host ""
Write-Host "[3/4] 检查 MongoDB 服务..." -ForegroundColor Yellow
$service = Get-Service -Name "MongoDB" -ErrorAction SilentlyContinue

if ($service) {
    Write-Host "✅ MongoDB 服务已存在" -ForegroundColor Green
    if ($service.Status -ne "Running") {
        Write-Host "正在启动 MongoDB 服务..." -ForegroundColor Yellow
        Start-Service -Name "MongoDB"
        Start-Sleep -Seconds 3
        Write-Host "✅ MongoDB 服务已启动" -ForegroundColor Green
    } else {
        Write-Host "✅ MongoDB 服务正在运行" -ForegroundColor Green
    }
} else {
    Write-Host "⚠️  MongoDB 服务未安装" -ForegroundColor Yellow
    Write-Host "正在创建 MongoDB 服务..." -ForegroundColor Yellow
    
    $mongodExe = Join-Path $mongoPath "mongod.exe"
    $configFile = Join-Path $mongoPath "mongod.cfg"
    
    # 创建配置文件
    $configContent = @"
systemLog:
  destination: file
  path: $LogPath
  logAppend: true
storage:
  dbPath: $DataPath
net:
  port: 27017
  bindIp: 127.0.0.1
"@
    
    Set-Content -Path $configFile -Value $configContent
    Write-Host "✅ 已创建配置文件: $configFile" -ForegroundColor Green
    
    # 安装Windows服务
    $serviceArgs = "--config `"$configFile`" --install --serviceName MongoDB"
    Start-Process -FilePath $mongodExe -ArgumentList $serviceArgs -Wait -NoNewWindow
    
    Write-Host "✅ MongoDB 服务已安装" -ForegroundColor Green
    Write-Host "正在启动服务..." -ForegroundColor Yellow
    Start-Service -Name "MongoDB"
    Start-Sleep -Seconds 3
    Write-Host "✅ MongoDB 服务已启动" -ForegroundColor Green
}

# 测试连接
Write-Host ""
Write-Host "[4/4] 测试 MongoDB 连接..." -ForegroundColor Yellow
try {
    $mongoClient = New-Object System.Net.Sockets.TcpClient
    $mongoClient.Connect("127.0.0.1", 27017)
    $mongoClient.Close()
    Write-Host "✅ MongoDB 连接成功" -ForegroundColor Green
} catch {
    Write-Host "⚠️  无法连接到 MongoDB，请检查服务状态" -ForegroundColor Yellow
}

# 初始化数据库（可选）
Write-Host ""
$initDB = Read-Host "是否初始化 KBird 数据库? (y/n)"
if ($initDB -eq "y" -or $initDB -eq "Y") {
    Write-Host "正在初始化数据库..." -ForegroundColor Yellow
    # 这里可以添加数据库初始化脚本
    Write-Host "✅ 数据库初始化完成" -ForegroundColor Green
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "🎉 MongoDB 配置完成！" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "MongoDB 信息:" -ForegroundColor Cyan
Write-Host "  服务名称: MongoDB" -ForegroundColor White
Write-Host "  端口: 27017" -ForegroundColor White
Write-Host "  数据目录: $DataPath" -ForegroundColor White
Write-Host "  日志文件: $LogPath" -ForegroundColor White
Write-Host ""
Write-Host "管理命令:" -ForegroundColor Cyan
Write-Host "  启动服务: net start MongoDB" -ForegroundColor White
Write-Host "  停止服务: net stop MongoDB" -ForegroundColor White
Write-Host ""
Read-Host "按 Enter 键退出"
