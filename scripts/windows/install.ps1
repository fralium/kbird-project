# KBird Windows install script
# Detect dependencies and install npm packages.
# Encoding: UTF-8 with BOM (required for Chinese Windows PowerShell).

param(
    [switch]$SkipMongoDB = $false,
    [switch]$SkipNodeJS = $false
)

Write-Host "========================================" -ForegroundColor Green
Write-Host "   KBird Windows Install" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

$ErrorActionPreference = "Stop"

# Prefer running from repo root
if (-not (Test-Path "package.json")) {
    if (Test-Path (Join-Path $PSScriptRoot "..\..\package.json")) {
        Set-Location (Join-Path $PSScriptRoot "..\..")
    }
}

$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "[WARN] Run as Administrator for full MongoDB service setup." -ForegroundColor Yellow
    Write-Host ""
}

# 1) Node.js
Write-Host "[1/5] Checking Node.js..." -ForegroundColor Yellow
if (-not $SkipNodeJS) {
    try {
        $nodeVersion = node --version 2>$null
        if ($nodeVersion) {
            Write-Host "[OK] Node.js: $nodeVersion" -ForegroundColor Green
        } else {
            throw "Node.js not found"
        }
    } catch {
        Write-Host "[FAIL] Node.js not found." -ForegroundColor Red
        Write-Host "Opening Node.js download page..." -ForegroundColor Yellow
        Start-Process "https://nodejs.org/zh-cn/download/"
        Write-Host "Install Node.js LTS (>= 20.9), then re-run this script." -ForegroundColor Yellow
        Read-Host "Press Enter to exit"
        exit 1
    }
} else {
    Write-Host "[SKIP] Node.js check" -ForegroundColor Cyan
}

# 2) npm
Write-Host ""
Write-Host "[2/5] Checking npm..." -ForegroundColor Yellow
try {
    $npmVersion = npm --version 2>$null
    Write-Host "[OK] npm: $npmVersion" -ForegroundColor Green
} catch {
    Write-Host "[FAIL] npm not found. Install Node.js first." -ForegroundColor Red
    exit 1
}

# 3) MongoDB
Write-Host ""
Write-Host "[3/5] Checking MongoDB..." -ForegroundColor Yellow
if (-not $SkipMongoDB) {
    $mongoInstalled = $false

    try {
        $mongoService = Get-Service -Name "MongoDB" -ErrorAction SilentlyContinue
        if ($mongoService) {
            Write-Host "[OK] MongoDB Windows service found" -ForegroundColor Green
            $mongoInstalled = $true
        }
    } catch {
        # ignore
    }

    if (-not $mongoInstalled) {
        try {
            $null = Get-Command mongod -ErrorAction Stop
            Write-Host "[OK] mongod found in PATH" -ForegroundColor Green
            $mongoInstalled = $true
        } catch {
            # ignore
        }
    }

    if (-not $mongoInstalled) {
        Write-Host "[FAIL] MongoDB not found" -ForegroundColor Red
        Write-Host ""
        Write-Host "Options:" -ForegroundColor Yellow
        Write-Host "  1. Open MongoDB Community download page"
        Write-Host "  2. Show manual install URL"
        Write-Host "  3. Skip for now"
        Write-Host ""
        $choice = Read-Host "Choose (1/2/3)"

        if ($choice -eq "1") {
            Write-Host "Opening MongoDB download page..." -ForegroundColor Yellow
            Start-Process "https://www.mongodb.com/try/download/community"
            Write-Host "After install, run: .\scripts\windows\setup-mongodb.ps1" -ForegroundColor Cyan
        } elseif ($choice -eq "2") {
            Write-Host "Visit: https://www.mongodb.com/try/download/community" -ForegroundColor Yellow
        } else {
            Write-Host "[SKIP] MongoDB install" -ForegroundColor Cyan
            Write-Host "Later run: .\scripts\windows\setup-mongodb.ps1" -ForegroundColor Yellow
        }
    }
} else {
    Write-Host "[SKIP] MongoDB check" -ForegroundColor Cyan
}

# 4) npm install
Write-Host ""
Write-Host "[4/5] Installing npm dependencies..." -ForegroundColor Yellow
if (Test-Path "package.json") {
    Write-Host "Running npm install..." -ForegroundColor Cyan
    npm install
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[OK] Dependencies installed" -ForegroundColor Green
    } else {
        Write-Host "[FAIL] npm install failed" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "[FAIL] package.json not found. Run from repo root." -ForegroundColor Red
    exit 1
}

# 5) .env + sibling KBird-Data (parallel to repo)
Write-Host ""
Write-Host "[5/5] Environment + personal data folder..." -ForegroundColor Yellow
if (-not (Test-Path ".env")) {
    if (Test-Path "env.example") {
        Copy-Item "env.example" ".env"
        Write-Host "[OK] Created .env from env.example" -ForegroundColor Green
    } else {
        Write-Host "[WARN] env.example missing; create .env manually." -ForegroundColor Yellow
    }
} else {
    Write-Host "[OK] .env already exists" -ForegroundColor Green
}

# Create ../KBird-Data (+ uploads/...) and write KBIRD_DATA_ROOT / UPLOAD_PATH into .env
node scripts/ensure-kbird-data.js
if ($LASTEXITCODE -ne 0) {
    Write-Host "[FAIL] ensure-kbird-data.js failed" -ForegroundColor Red
    exit 1
}
Write-Host "[NOTE] Map/AI keys in .env are optional; edit only if you use those features." -ForegroundColor Yellow

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "Install finished" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Import bird seed: .\scripts\windows\init-database.ps1" -ForegroundColor White
Write-Host "  2. Daily start (fast): KBird-Start-Prod.bat" -ForegroundColor White
Write-Host "     Dev/debug:         KBird-Start.bat" -ForegroundColor DarkGray
Write-Host ""
Read-Host "Press Enter to exit"
