#Requires -Version 5.1
<#
.SYNOPSIS
  备份 KBird 个人数据：uploads + MongoDB dump，打成 zip 放入数据根 backups/。

.EXAMPLE
  .\scripts\backup-personal-data.ps1
  .\scripts\backup-personal-data.ps1 -Keep 14
  .\scripts\backup-personal-data.ps1 -DataRoot "C:\path\to\KBird-Data"
#>
param(
  [string]$DataRoot = "",
  [string]$ProjectRoot = "",
  [string]$MongoUri = "",
  [int]$Keep = 14,
  [switch]$SkipMongo
)

$ErrorActionPreference = "Stop"

if (-not $ProjectRoot) {
  $ProjectRoot = Split-Path -Parent $PSScriptRoot
}

# 读 .env（简单 KEY=VALUE）
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
)
$uploadsRoot = $uploadsCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $uploadsRoot) {
  Write-Warning "未找到 uploads 目录，将只备份 Mongo（若启用）。"
}

$backupsRoot = Join-Path $DataRoot "backups"
$mongoDumpsRoot = Join-Path $DataRoot "mongo-dumps"
New-Item -ItemType Directory -Force -Path $backupsRoot | Out-Null
New-Item -ItemType Directory -Force -Path $mongoDumpsRoot | Out-Null

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$workDir = Join-Path $mongoDumpsRoot "work-$stamp"
New-Item -ItemType Directory -Force -Path $workDir | Out-Null

try {
  if (-not $SkipMongo) {
    $mongodump = Get-Command mongodump -ErrorAction SilentlyContinue
    if (-not $mongodump) {
      Write-Warning "未找到 mongodump（请安装 MongoDB Database Tools 并加入 PATH）。跳过数据库备份。"
    } else {
      $dumpOut = Join-Path $workDir "mongo"
      Write-Host ">> mongodump -> $dumpOut"
      & mongodump --uri=$MongoUri --out=$dumpOut
      if ($LASTEXITCODE -ne 0) { throw "mongodump 失败 (exit $LASTEXITCODE)" }
    }
  }

  if ($uploadsRoot) {
    Write-Host ">> 复制 uploads: $uploadsRoot"
    $uploadsDest = Join-Path $workDir "uploads"
    New-Item -ItemType Directory -Force -Path $uploadsDest | Out-Null
    # 用 robocopy 更稳；排除超大缓存无关
    & robocopy $uploadsRoot $uploadsDest /E /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null
    # robocopy exit 0-7 多为成功
    if ($LASTEXITCODE -ge 8) { throw "robocopy uploads 失败 (exit $LASTEXITCODE)" }
    $global:LASTEXITCODE = 0
  }

  # 元数据
  @{
    createdAt = (Get-Date).ToString("o")
    projectRoot = $ProjectRoot
    dataRoot = $DataRoot
    mongoUriRedacted = ($MongoUri -replace '://([^:/@]+):([^@]+)@', '://***:***@')
    includesUploads = [bool]$uploadsRoot
    includesMongo = (-not $SkipMongo)
  } | ConvertTo-Json | Set-Content -Path (Join-Path $workDir "backup-meta.json") -Encoding UTF8

  $zipPath = Join-Path $backupsRoot "kbird-backup-$stamp.zip"
  Write-Host ">> 压缩 -> $zipPath"
  if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
  Compress-Archive -Path (Join-Path $workDir '*') -DestinationPath $zipPath -CompressionLevel Optimal

  Write-Host "OK 备份完成: $zipPath"
} finally {
  if (Test-Path $workDir) {
    Remove-Item $workDir -Recurse -Force -ErrorAction SilentlyContinue
  }
}

# 只保留最近 Keep 份
$archives = Get-ChildItem -Path $backupsRoot -Filter "kbird-backup-*.zip" | Sort-Object LastWriteTime -Descending
if ($archives.Count -gt $Keep) {
  $archives | Select-Object -Skip $Keep | ForEach-Object {
    Write-Host "清理旧备份: $($_.Name)"
    Remove-Item $_.FullName -Force
  }
}

Write-Host "数据根: $DataRoot"
Write-Host "备份目录: $backupsRoot (保留最近 $Keep 份)"
