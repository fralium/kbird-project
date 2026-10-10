@echo off
REM KBird update: git pull + npm install (keeps .env and personal data)
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\windows\update.ps1"
if errorlevel 1 (
  echo.
  echo Update failed. See messages above.
  pause
  exit /b 1
)
