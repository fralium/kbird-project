@echo off
REM KBird personal backup: uploads + MongoDB dump -> KBird-Data\backups\*.zip
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\backup-personal-data.ps1" -NoPause %*
if errorlevel 1 (
  echo.
  echo Backup failed or incomplete. See messages above.
  timeout /t 5 /nobreak >nul
  exit /b 1
)
