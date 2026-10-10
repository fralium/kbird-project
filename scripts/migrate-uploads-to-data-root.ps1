#Requires -Version 5.1
<#
.SYNOPSIS
  将仓库内 uploads/ 迁到仓库旁 KBird-Data/uploads（一次迁移）。
#>
param(
  [string]$ProjectRoot = "",
  [string]$DataRoot = ""
)

$ErrorActionPreference = "Stop"
if (-not $ProjectRoot) { $ProjectRoot = Split-Path -Parent $PSScriptRoot }
if (-not $DataRoot) { $DataRoot = Join-Path (Split-Path -Parent $ProjectRoot) "KBird-Data" }

$src = Join-Path $ProjectRoot "uploads"
$dest = Join-Path $DataRoot "uploads"

if (-not (Test-Path $src)) {
  Write-Host "源不存在: $src （可能已迁移）"
  exit 0
}

New-Item -ItemType Directory -Force -Path $DataRoot | Out-Null
Write-Host "迁移: $src -> $dest"
if (-not (Test-Path $dest)) {
  Move-Item -Path $src -Destination $dest
} else {
  & robocopy $src $dest /E /MOVE /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null
  if ($LASTEXITCODE -ge 8) { throw "robocopy 失败 $LASTEXITCODE" }
  if (Test-Path $src) {
    $left = Get-ChildItem $src -Recurse -Force -ErrorAction SilentlyContinue
    if (-not $left -or $left.Count -eq 0) { Remove-Item $src -Recurse -Force -ErrorAction SilentlyContinue }
  }
}

$envFile = Join-Path $ProjectRoot ".env"
$line = "KBIRD_DATA_ROOT=$DataRoot"
if (Test-Path $envFile) {
  $content = Get-Content $envFile -Raw -Encoding UTF8
  if ($content -match '(?m)^KBIRD_DATA_ROOT=') {
    $content = $content -replace '(?m)^KBIRD_DATA_ROOT=.*$', $line
  } else {
    $content = $content.TrimEnd() + "`r`n`r`n# 个人数据根（仓库外）`r`n$line`r`n"
  }
  Set-Content -Path $envFile -Value $content -Encoding UTF8 -NoNewline
} else {
  Set-Content -Path $envFile -Value $line -Encoding UTF8
}

Write-Host "已写入 .env: $line"
Write-Host "请重启 KBird 服务。建议立刻跑一次: .\scripts\backup-personal-data.ps1"
