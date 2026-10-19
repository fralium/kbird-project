@echo off
REM Compatibility wrapper - delegates to scripts\windows\KBird-Start-Prod.bat
cd /d "%~dp0.."
call "%~dp0windows\KBird-Start-Prod.bat"
