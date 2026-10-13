@echo off
title KBird Stop
setlocal EnableDelayedExpansion

echo ========================================
echo    KBird Stop
echo ========================================
echo.
echo Stops KBird frontend/backend only (ports 13080 / 13082).
echo.

echo [1/2] Closing KBird windows...
taskkill /F /FI "WINDOWTITLE eq KBird Backend*" >nul 2>&1
taskkill /F /FI "WINDOWTITLE eq KBird Frontend*" >nul 2>&1
taskkill /F /FI "WINDOWTITLE eq KBird Backend (Prod)*" >nul 2>&1
taskkill /F /FI "WINDOWTITLE eq KBird Frontend (Prod)*" >nul 2>&1
echo OK: closed KBird windows (if any)

echo.
echo [2/2] Freeing ports 13080 / 13082...
call :free_port 13080
call :free_port 13082

echo.
echo ========================================
echo KBird stopped
echo ========================================
echo.
goto :eof

:free_port
set "PORT=%~1"
set "FOUND=0"
set "SEEN="
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":%PORT% " ^| findstr LISTENING') do (
  echo ;!SEEN!; | findstr /C:";%%a;" >nul 2>&1
  if errorlevel 1 (
    set "SEEN=!SEEN!;%%a"
    set "FOUND=1"
    echo Port %PORT% in use by PID: %%a
    taskkill /F /PID %%a >nul 2>&1
    if errorlevel 1 (
      echo WARN: could not kill PID %%a
    ) else (
      echo OK: freed port %PORT%
    )
  )
)
if "%FOUND%"=="0" (
  echo OK: port %PORT% is free
)
exit /b 0
