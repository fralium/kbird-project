# 使用Git差异检测的智能同步脚本
# 基于Git状态和差异来同步文件

param(
    [string]$SourcePath = "..\",
    [string]$TargetPath = ".",
    [string]$Version = "v1.1.0",
    [switch]$DryRun = $false,
    [switch]$Force = $false
)

Write-Host "🔄 KBird Git智能同步脚本" -ForegroundColor Green
Write-Host "源路径: $SourcePath" -ForegroundColor Yellow
Write-Host "目标路径: $TargetPath" -ForegroundColor Yellow
Write-Host "版本: $Version" -ForegroundColor Yellow
Write-Host ""

# 检查源路径是否是Git仓库
$SourceGitPath = Join-Path $SourcePath ".git"
if (-not (Test-Path $SourceGitPath)) {
    Write-Host "❌ 错误: 源路径不是Git仓库" -ForegroundColor Red
    exit 1
}

# 切换到源目录获取Git状态
Push-Location $SourcePath
try {
    # 获取所有修改的文件
    $ModifiedFiles = git diff --name-only HEAD
    $StagedFiles = git diff --cached --name-only
    $UntrackedFiles = git ls-files --others --exclude-standard
    
    # 合并所有需要同步的文件
    $AllChangedFiles = @()
    if ($ModifiedFiles) { $AllChangedFiles += $ModifiedFiles }
    if ($StagedFiles) { $AllChangedFiles += $StagedFiles }
    if ($UntrackedFiles) { $AllChangedFiles += $UntrackedFiles }
    
    # 去重
    $AllChangedFiles = $AllChangedFiles | Sort-Object -Unique
    
    Write-Host "📊 Git状态分析:" -ForegroundColor Cyan
    Write-Host "修改的文件: $($ModifiedFiles.Count)" -ForegroundColor Yellow
    Write-Host "暂存的文件: $($StagedFiles.Count)" -ForegroundColor Blue
    Write-Host "未跟踪的文件: $($UntrackedFiles.Count)" -ForegroundColor Magenta
    Write-Host "总计需要同步: $($AllChangedFiles.Count)" -ForegroundColor Green
    Write-Host ""
    
} finally {
    Pop-Location
}

# 定义需要排除的文件模式
$ExcludePatterns = @(
    "node_modules\*",
    ".next\*",
    ".git\*",
    "logs\*",
    "uploads\*",
    "backups\*",
    "reports\*",
    "*.log",
    "*.tmp",
    "*.temp",
    "*debug*.js",
    "*test*.js",
    "*temp*.js",
    "*fix*.js",
    "*parse*.js",
    "*check*.js",
    "*verify*.js",
    "*update*.js",
    "*import*.js",
    "*export*.js",
    "*generate*.js",
    "*create*.js",
    "*backup*.js",
    "*restore*.js",
    "*analyze*.js",
    "*find*.js",
    "*search*.js",
    "*replace*.js",
    "*clear*.js",
    "*cleanup*.js",
    "*final*.js",
    "*ultimate*.js",
    "*advanced*.js",
    "*fixed*.js",
    "*decoded*.js",
    "*wiki*.js",
    "*mhtml*.js",
    "*garbled*.js",
    "*encoding*.js",
    "bird.csv",
    "baohu.png",
    "config.json"
)

# 定义重要文件（即使没有修改也要同步）
$ImportantFiles = @(
    "package.json",
    "package-lock.json",
    "next.config.js",
    "env.example",
    "docker-compose.yml",
    "Dockerfile",
    "ecosystem.config.js",
    "restart.sh",
    ".gitignore",
    "README.md",
    "LICENSE"
)

# 过滤需要同步的文件
$FilesToSync = @()
foreach ($File in $AllChangedFiles) {
    $ShouldExclude = $false
    foreach ($Pattern in $ExcludePatterns) {
        if ($File -like $Pattern) {
            $ShouldExclude = $true
            break
        }
    }
    if (-not $ShouldExclude) {
        $FilesToSync += $File
    }
}

# 添加重要文件
foreach ($File in $ImportantFiles) {
    if ($File -notin $FilesToSync) {
        $SourceFile = Join-Path $SourcePath $File
        if (Test-Path $SourceFile) {
            $FilesToSync += $File
        }
    }
}

Write-Host "🔍 需要同步的文件 ($($FilesToSync.Count)):" -ForegroundColor Cyan
foreach ($File in $FilesToSync) {
    Write-Host "  📄 $File" -ForegroundColor White
}
Write-Host ""

if ($FilesToSync.Count -eq 0 -and -not $Force) {
    Write-Host "✅ 没有文件需要同步" -ForegroundColor Green
    exit 0
}

$SyncedCount = 0
$SkippedCount = 0

foreach ($File in $FilesToSync) {
    $SourceFile = Join-Path $SourcePath $File
    $TargetFile = Join-Path $TargetPath $File
    $TargetDir = Split-Path $TargetFile -Parent
    
    if (Test-Path $SourceFile) {
        # 检查是否需要更新
        $NeedsUpdate = $true
        if (Test-Path $TargetFile) {
            $SourceHash = (Get-FileHash $SourceFile -Algorithm MD5).Hash
            $TargetHash = (Get-FileHash $TargetFile -Algorithm MD5).Hash
            $NeedsUpdate = $SourceHash -ne $TargetHash
        }
        
        if ($NeedsUpdate -or $Force) {
            if (-not $DryRun) {
                # 确保目标目录存在
                if (-not (Test-Path $TargetDir)) {
                    New-Item -ItemType Directory -Path $TargetDir -Force | Out-Null
                }
                
                # 复制文件
                Copy-Item $SourceFile $TargetFile -Force
                Write-Host "✅ 同步: $File" -ForegroundColor Green
                $SyncedCount++
            } else {
                Write-Host "📝 将同步: $File" -ForegroundColor Yellow
                $SyncedCount++
            }
        } else {
            Write-Host "⏭️  跳过: $File (无变化)" -ForegroundColor Gray
            $SkippedCount++
        }
    } else {
        Write-Host "❌ 源文件不存在: $File" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "📊 同步统计:" -ForegroundColor Cyan
Write-Host "同步的文件: $SyncedCount" -ForegroundColor Green
Write-Host "跳过的文件: $SkippedCount" -ForegroundColor Gray

if (-not $DryRun -and $SyncedCount -gt 0) {
    Write-Host ""
    Write-Host "🚀 准备提交到Git..." -ForegroundColor Cyan
    
    # 切换到目标目录
    Push-Location $TargetPath
    try {
        # 检查是否在Git仓库中
        if (Test-Path ".git") {
            # 添加所有修改的文件
            git add .
            
            # 提交更改
            $CommitMessage = "Sync: $Version - $SyncedCount files synchronized from development"
            git commit -m $CommitMessage
            
            # 创建标签（如果指定了版本）
            if ($Version -and $Version -ne "") {
                git tag -a $Version -m "Release $Version - Synchronized $SyncedCount files"
                Write-Host "✅ 创建标签: $Version" -ForegroundColor Green
            }
            
            Write-Host "✅ Git提交完成" -ForegroundColor Green
            Write-Host ""
            Write-Host "📤 可以推送到远程仓库:" -ForegroundColor Cyan
            Write-Host "git push origin master" -ForegroundColor White
            if ($Version -and $Version -ne "") {
                Write-Host "git push origin $Version" -ForegroundColor White
            }
        } else {
            Write-Host "⚠️  当前目录不是Git仓库，跳过Git操作" -ForegroundColor Yellow
        }
    } finally {
        Pop-Location
    }
}

Write-Host ""
Write-Host "🎉 同步完成！" -ForegroundColor Green
