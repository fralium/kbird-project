# KBird Windows update script
# Pull latest code, refresh deps, keep local .env / KBird-Data / Mongo data.
# Encoding: UTF-8 with BOM (required for Chinese Windows PowerShell).

param(
    [switch]$SkipStop = $false,
    [switch]$SkipNpm = $false,
    [switch]$Force = $false,
    [switch]$NoPause = $false
)

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Green
Write-Host "   KBird Update" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "This updates program files only." -ForegroundColor Cyan
Write-Host "Keeps: .env, sibling KBird-Data, MongoDB personal data." -ForegroundColor Cyan
Write-Host "No need to run /init again after a normal update." -ForegroundColor Cyan
Write-Host ""

# Prefer running from repo root
if (-not (Test-Path "package.json")) {
    if (Test-Path (Join-Path $PSScriptRoot "..\..\package.json")) {
        Set-Location (Join-Path $PSScriptRoot "..\..")
    }
}

if (-not (Test-Path "package.json")) {
    Write-Host "[FAIL] package.json not found. Run from the KBird repo root." -ForegroundColor Red
    if (-not $NoPause) { Read-Host "Press Enter to exit" }
    exit 1
}

# 1) Stop running app (Node only; leave MongoDB running)
Write-Host "[1/5] Stopping KBird processes..." -ForegroundColor Yellow
if (-not $SkipStop) {
    Get-Process -Name "node" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    Get-Process -Name "next" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    foreach ($port in 13080, 13082) {
        try {
            $conns = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
            if ($conns) {
                $conns | ForEach-Object {
                    Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue
                }
            }
        } catch {
            # ignore port cleanup errors
        }
    }
    Write-Host "[OK] Node processes stopped (MongoDB left running)" -ForegroundColor Green
} else {
    Write-Host "[SKIP] Stop processes" -ForegroundColor Cyan
}

# 2) Git check
Write-Host ""
Write-Host "[2/5] Checking git..." -ForegroundColor Yellow
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Host "[FAIL] git not found. Install Git, then re-run." -ForegroundColor Red
    if (-not $NoPause) { Read-Host "Press Enter to exit" }
    exit 1
}
if (-not (Test-Path ".git")) {
    Write-Host "[FAIL] Not a git clone (.git missing). Update only works for git-cloned installs." -ForegroundColor Red
    if (-not $NoPause) { Read-Host "Press Enter to exit" }
    exit 1
}

$branch = (git rev-parse --abbrev-ref HEAD 2>$null)
if (-not $branch) { $branch = "master" }
Write-Host "[OK] Branch: $branch" -ForegroundColor Green

$status = git status --porcelain
if ($status) {
    Write-Host "[WARN] Working tree has local changes:" -ForegroundColor Yellow
    git status --short
    Write-Host ""
    if (-not $Force) {
        $ans = Read-Host "Continue pull anyway? Local edits may conflict (y/N)"
        if ($ans -notin @("y", "Y", "yes", "YES")) {
            Write-Host "Aborted. Commit/stash local changes, or re-run with -Force." -ForegroundColor Yellow
            if (-not $NoPause) { Read-Host "Press Enter to exit" }
            exit 1
        }
    } else {
        Write-Host "[NOTE] -Force: continuing despite local changes" -ForegroundColor Cyan
    }
}

# 3) Pull
Write-Host ""
Write-Host "[3/5] Pulling latest code..." -ForegroundColor Yellow
$before = (git rev-parse HEAD 2>$null)
git fetch origin
if ($LASTEXITCODE -ne 0) {
    Write-Host "[FAIL] git fetch failed (network / auth?)" -ForegroundColor Red
    if (-not $NoPause) { Read-Host "Press Enter to exit" }
    exit 1
}

git pull --ff-only origin $branch
if ($LASTEXITCODE -ne 0) {
    Write-Host "[WARN] Fast-forward pull failed; trying plain git pull..." -ForegroundColor Yellow
    git pull origin $branch
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[FAIL] git pull failed. Resolve conflicts manually, then re-run." -ForegroundColor Red
        if (-not $NoPause) { Read-Host "Press Enter to exit" }
        exit 1
    }
}

$after = (git rev-parse HEAD 2>$null)
if ($before -and $after -and ($before -eq $after)) {
    Write-Host "[OK] Already up to date ($after)" -ForegroundColor Green
} else {
    Write-Host "[OK] Updated: $before -> $after" -ForegroundColor Green
    git log -1 --oneline
}

# 4) npm install
Write-Host ""
Write-Host "[4/5] Installing npm dependencies..." -ForegroundColor Yellow
if (-not $SkipNpm) {
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[FAIL] npm install failed" -ForegroundColor Red
        if (-not $NoPause) { Read-Host "Press Enter to exit" }
        exit 1
    }
    Write-Host "[OK] Dependencies ready" -ForegroundColor Green
} else {
    Write-Host "[SKIP] npm install" -ForegroundColor Cyan
}

# 5) Ensure data folder paths (does not wipe personal data)
Write-Host ""
Write-Host "[5/5] Checking personal data folder..." -ForegroundColor Yellow
if (Test-Path "scripts\ensure-kbird-data.js") {
    node scripts/ensure-kbird-data.js
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[WARN] ensure-kbird-data.js failed; check .env paths manually." -ForegroundColor Yellow
    } else {
        Write-Host "[OK] KBird-Data / upload paths checked" -ForegroundColor Green
    }
} else {
    Write-Host "[SKIP] ensure-kbird-data.js not found" -ForegroundColor Cyan
}

if (-not (Test-Path ".env")) {
    Write-Host "[WARN] .env missing. If this is a fresh copy, run install.ps1 first." -ForegroundColor Yellow
} else {
    Write-Host "[OK] .env kept as-is" -ForegroundColor Green
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "Update finished" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Next:" -ForegroundColor Cyan
Write-Host "  1. Start: KBird-Desktop.bat" -ForegroundColor White
Write-Host "  2. Do NOT re-run /init (unless you switched to a new empty DB)" -ForegroundColor White
Write-Host "  3. Optional new map/AI keys: Settings -> Services & keys" -ForegroundColor White
Write-Host "  4. Optional bird seed refresh: .\scripts\windows\init-database.ps1" -ForegroundColor White
Write-Host ""
if (-not $NoPause) {
    Read-Host "Press Enter to exit"
}
