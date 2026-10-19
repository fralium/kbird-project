#Requires -Version 5.1
<#
.SYNOPSIS
  Backup KBird personal data: uploads + MongoDB dump -> zip under KBird-Data/backups/.

.EXAMPLE
  .\scripts\backup-personal-data.ps1
  .\scripts\backup-personal-data.ps1 -Keep 14
  .\scripts\backup-personal-data.ps1 -SkipMongo
#>
param(
  [string]$DataRoot = "",
  [string]$ProjectRoot = "",
  [string]$MongoUri = "",
  [int]$Keep = 14,
  [switch]$SkipMongo,
  [switch]$NoPause
)

$ErrorActionPreference = "Stop"

function Write-Step($msg) { Write-Host $msg -ForegroundColor Cyan }
function Write-Ok($msg) { Write-Host "[OK] $msg" -ForegroundColor Green }
function Write-WarnLine($msg) { Write-Host "[WARN] $msg" -ForegroundColor Yellow }
function Write-Fail($msg) { Write-Host "[FAIL] $msg" -ForegroundColor Red }

function Find-MongoDumpExe {
  $cmd = Get-Command mongodump -ErrorAction SilentlyContinue
  if ($cmd -and $cmd.Source) { return $cmd.Source }

  $searchRoots = @(
    (Join-Path ${env:ProgramFiles} "MongoDB"),
    (Join-Path ${env:ProgramFiles} "MongoDB\Tools"),
    (Join-Path ${env:ProgramFiles(x86)} "MongoDB"),
    "D:\software\mongodbtools",
    "C:\software\mongodbtools"
  ) | Where-Object { $_ -and (Test-Path $_) }

  foreach ($root in $searchRoots) {
    $hit = Get-ChildItem -Path $root -Filter "mongodump.exe" -Recurse -ErrorAction SilentlyContinue |
      Select-Object -First 1
    if ($hit) { return $hit.FullName }
  }
  return $null
}

function Test-MongoServerPresent {
  try {
    $svc = Get-Service -Name "MongoDB" -ErrorAction SilentlyContinue
    if ($svc) { return $true }
  } catch { }
  if (Get-Command mongod -ErrorAction SilentlyContinue) { return $true }
  $pf = Join-Path ${env:ProgramFiles} "MongoDB\Server"
  if (Test-Path $pf) { return $true }
  return $false
}

function Show-MongoToolsInstallHelp {
  Write-Host ""
  Write-Fail "未找到 mongodump（MongoDB Database Tools）。完整备份需要它来导出数据库。"
  Write-Host ""
  Write-Host "请安装 MongoDB Database Tools，并把 bin 目录加入系统 PATH：" -ForegroundColor Yellow
  Write-Host "  https://www.mongodb.com/try/download/database-tools" -ForegroundColor White
  Write-Host ""
  Write-Host "安装后新开一个终端，确认：" -ForegroundColor Yellow
  Write-Host "  mongodump --version" -ForegroundColor White
  Write-Host ""
  Write-Host "若只要备份照片文件、暂不备库，可运行：" -ForegroundColor Yellow
  Write-Host "  .\scripts\backup-personal-data.ps1 -SkipMongo" -ForegroundColor White
  Write-Host "  或: KBird-Backup.bat -SkipMongo" -ForegroundColor White
  Write-Host ""
  $open = Read-Host "是否打开 Database Tools 下载页? (Y/n)"
  if ($open -notin @("n", "N", "no", "NO")) {
    Start-Process "https://www.mongodb.com/try/download/database-tools"
  }
}

function Show-MongoServerInstallHelp {
  Write-Host ""
  Write-Fail "本机未检测到 MongoDB 数据库服务/程序。"
  Write-Host ""
  Write-Host "请先安装并启动 MongoDB Community，再备份：" -ForegroundColor Yellow
  Write-Host "  https://www.mongodb.com/try/download/community" -ForegroundColor White
  Write-Host "  或项目内: .\scripts\windows\setup-mongodb.ps1" -ForegroundColor White
  Write-Host ""
  $open = Read-Host "是否打开 MongoDB 下载页? (Y/n)"
  if ($open -notin @("n", "N", "no", "NO")) {
    Start-Process "https://www.mongodb.com/try/download/community"
  }
}

Write-Host "========================================" -ForegroundColor Green
Write-Host "   KBird Personal Data Backup" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Includes: uploads (photos) + MongoDB dump -> zip" -ForegroundColor Cyan
Write-Host ""

if (-not $ProjectRoot) {
  $ProjectRoot = Split-Path -Parent $PSScriptRoot
}

# Load .env KEY=VALUE
$envFile = Join-Path $ProjectRoot ".env"
if (Test-Path $envFile) {
  Get-Content $envFile -Encoding UTF8 | ForEach-Object {
    $line = $_.Trim()
    if (-not $line -or $line.StartsWith("#")) { return }
    $i = $line.IndexOf("=")
    if ($i -lt 1) { return }
    $k = $line.Substring(0, $i).Trim()
    $v = $line.Substring($i + 1).Trim().Trim('"').Trim("'")
    if ($k -and -not [string]::IsNullOrWhiteSpace($v)) {
      Set-Item -Path "Env:$k" -Value $v
    }
  }
}

if (-not $DataRoot) {
  if ($env:KBIRD_DATA_ROOT) { $DataRoot = $env:KBIRD_DATA_ROOT }
  else { $DataRoot = Join-Path (Split-Path -Parent $ProjectRoot) "KBird-Data" }
}
$DataRoot = [System.IO.Path]::GetFullPath($DataRoot)

if (-not $MongoUri) {
  $MongoUri = if ($env:MONGODB_URI) { $env:MONGODB_URI } else { "mongodb://localhost:27017/kbird" }
}

$uploadsCandidates = @(
  (Join-Path $DataRoot "uploads"),
  (Join-Path $ProjectRoot "uploads")
) | Where-Object { Test-Path $_ }
if ($uploadsCandidates.Count -eq 0) {
  Write-WarnLine "未找到 uploads 目录，将只备份 Mongo（若启用）。"
}

$personalDir = Join-Path $DataRoot "personal"
$hasPersonalDir = Test-Path $personalDir

$backupsRoot = Join-Path $DataRoot "backups"
$mongoDumpsRoot = Join-Path $DataRoot "mongo-dumps"
New-Item -ItemType Directory -Force -Path $backupsRoot | Out-Null
New-Item -ItemType Directory -Force -Path $mongoDumpsRoot | Out-Null

$includesMongo = $false
$mongodumpExe = $null

if (-not $SkipMongo) {
  if (-not (Test-MongoServerPresent)) {
    Show-MongoServerInstallHelp
    if (-not $NoPause) { Read-Host "Press Enter to exit" }
    exit 1
  }

  $mongodumpExe = Find-MongoDumpExe
  if (-not $mongodumpExe) {
    Show-MongoToolsInstallHelp
    if (-not $NoPause) { Read-Host "Press Enter to exit" }
    exit 1
  }
  Write-Ok "mongodump: $mongodumpExe"
} else {
  Write-WarnLine "已指定 -SkipMongo：本次不备份数据库，只备份文件。"
}

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$workDir = Join-Path $mongoDumpsRoot "work-$stamp"
New-Item -ItemType Directory -Force -Path $workDir | Out-Null

$zipPath = $null
try {
  if (-not $SkipMongo) {
    $dumpOut = Join-Path $workDir "mongo"
    Write-Step ">> mongodump -> $dumpOut"
    & $mongodumpExe --uri=$MongoUri --out=$dumpOut
    if ($LASTEXITCODE -ne 0) {
      throw "mongodump 失败 (exit $LASTEXITCODE)。请确认 MongoDB 已启动，且 .env 中 MONGODB_URI 正确。"
    }
    $includesMongo = $true
    Write-Ok "数据库已导出"
  }

  if ($uploadsCandidates.Count -gt 0) {
    $uploadsDest = Join-Path $workDir "uploads"
    New-Item -ItemType Directory -Force -Path $uploadsDest | Out-Null
    foreach ($uRoot in $uploadsCandidates) {
      Write-Step ">> 复制 uploads: $uRoot"
      & robocopy $uRoot $uploadsDest /E /XD temp /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null
      if ($LASTEXITCODE -ge 8) { throw "robocopy uploads 失败 (exit $LASTEXITCODE)" }
      $global:LASTEXITCODE = 0
    }
    Write-Ok "uploads 已复制（自动排除 temp 缓存目录）"
  }

  if ($hasPersonalDir) {
    Write-Step ">> 复制 personal: $personalDir"
    $personalDest = Join-Path $workDir "personal"
    New-Item -ItemType Directory -Force -Path $personalDest | Out-Null
    & robocopy $personalDir $personalDest /E /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null
    if ($LASTEXITCODE -ge 8) { throw "robocopy personal 失败 (exit $LASTEXITCODE)" }
    $global:LASTEXITCODE = 0
    Write-Ok "personal 目录已复制"
  }

  @{
    createdAt = (Get-Date).ToString("o")
    projectRoot = $ProjectRoot
    dataRoot = $DataRoot
    mongoUriRedacted = ($MongoUri -replace '://([^:/@]+):([^@]+)@', '://***:***@')
    includesUploads = ($uploadsCandidates.Count -gt 0)
    includesPersonal = $hasPersonalDir
    includesMongo = $includesMongo
  } | ConvertTo-Json | Set-Content -Path (Join-Path $workDir "backup-meta.json") -Encoding UTF8

  $zipPath = Join-Path $backupsRoot "kbird-backup-$stamp.zip"
  Write-Step ">> 压缩 -> $zipPath"
  if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
  Compress-Archive -Path (Join-Path $workDir '*') -DestinationPath $zipPath -CompressionLevel Optimal
  Write-Ok "备份完成: $zipPath"
} catch {
  Write-Fail $_.Exception.Message
  if (-not $NoPause) { Read-Host "Press Enter to exit" }
  exit 1
} finally {
  if (Test-Path $workDir) {
    Remove-Item $workDir -Recurse -Force -ErrorAction SilentlyContinue
  }
}

# Keep newest Keep zips
$archives = Get-ChildItem -Path $backupsRoot -Filter "kbird-backup-*.zip" | Sort-Object LastWriteTime -Descending
if ($archives.Count -gt $Keep) {
  $archives | Select-Object -Skip $Keep | ForEach-Object {
    Write-Host "清理旧备份: $($_.Name)"
    Remove-Item $_.FullName -Force
  }
}

Write-Host ""
Write-Host "数据根: $DataRoot"
Write-Host "备份目录: $backupsRoot (保留最近 $Keep 份)"
if ($includesMongo) {
  Write-Host "内容: MongoDB + uploads（若存在）"
} else {
  Write-Host "内容: 仅 uploads（未含数据库）"
}
Write-Host ""
if (-not $NoPause) {
  Read-Host "Press Enter to exit"
}
