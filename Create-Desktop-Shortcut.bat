@echo off
REM Build desktop Kbird.exe launcher with logo
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\windows\create-desktop-shortcut.ps1"
if errorlevel 1 (
  echo.
  echo Failed. See messages above.
  timeout /t 5 /nobreak >nul
  exit /b 1
)
echo.
