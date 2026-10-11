@echo off
REM KBird update: git pull + npm install (keeps .env and personal data)
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\windows\update.ps1"
if errorlevel 1 (
  echo.
  echo Update failed. See messages above.
  timeout /t 8 /nobreak >nul
  exit /b 1
)
echo.
echo Window closes in 3 seconds...
timeout /t 3 /nobreak >nul
exit /b 0
