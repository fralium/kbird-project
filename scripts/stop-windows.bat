@echo off
REM Deprecated: do not kill all node.exe. Delegate to port-scoped PowerShell stopper.
echo ========================================
echo           KBird Stop Services
echo ========================================
echo.
echo Using port-scoped stop (13080 / 13082). Legacy global node kill removed.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0stop-windows.ps1"
exit /b %ERRORLEVEL%
