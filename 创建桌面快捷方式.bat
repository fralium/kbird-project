@echo off
REM Build desktop Kbird.exe launcher with logo (real program, not a .lnk)
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\windows\create-desktop-shortcut.ps1"
if errorlevel 1 (
  echo.
  echo Failed. See messages above.
  pause
  exit /b 1
)
echo.
pause
