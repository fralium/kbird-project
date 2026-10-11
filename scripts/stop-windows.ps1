# KBird Windows PowerShell stop script
# Stops app ports / Node for this app only. Never stops MongoDB.

Write-Host "========================================" -ForegroundColor Green
Write-Host "   KBird Stop" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Stops frontend/backend only. MongoDB is left running." -ForegroundColor Cyan
Write-Host ""

function Stop-ListenersOnPort([int]$Port) {
  try {
    $conns = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
  } catch {
    $conns = $null
  }
  if (-not $conns) {
    Write-Host "[OK] Port $Port is free" -ForegroundColor Green
    return
  }
  $conns | ForEach-Object {
    $pid = $_.OwningProcess
    Write-Host "Stopping PID $pid on port $Port..." -ForegroundColor Yellow
    Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
  }
  Write-Host "[OK] Port $Port cleared" -ForegroundColor Green
}

Write-Host "[1/2] Closing KBird console windows (if any)..." -ForegroundColor Yellow
Get-Process -Name "cmd" -ErrorAction SilentlyContinue | Where-Object {
  $_.MainWindowTitle -like "KBird Backend*" -or $_.MainWindowTitle -like "KBird Frontend*"
} | ForEach-Object {
  Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
}

Write-Host ""
Write-Host "[2/2] Freeing ports 13080 / 13082..." -ForegroundColor Yellow
Stop-ListenersOnPort 13080
Stop-ListenersOnPort 13082

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "KBird stopped (MongoDB still running)" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Read-Host "Press Enter to exit"
