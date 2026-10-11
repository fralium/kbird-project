@echo off
chcp 65001 >nul
title KBird 停止服务
setlocal EnableDelayedExpansion

echo ========================================
echo    KBird 停止服务
echo ========================================
echo.
echo 只停止本程序前后端（端口 13080 / 13082）。
echo.

echo [1/2] 关闭 KBird 窗口...
taskkill /F /FI "WINDOWTITLE eq KBird Backend*" >nul 2>&1
taskkill /F /FI "WINDOWTITLE eq KBird Frontend*" >nul 2>&1
taskkill /F /FI "WINDOWTITLE eq KBird Backend (Prod)*" >nul 2>&1
taskkill /F /FI "WINDOWTITLE eq KBird Frontend (Prod)*" >nul 2>&1
echo OK: 已尝试关闭 KBird 相关窗口

echo.
echo [2/2] 释放端口 13080 / 13082...
call :free_port 13080
call :free_port 13082

echo.
echo ========================================
echo KBird 已停止
echo ========================================
echo.
pause
goto :eof

:free_port
set "PORT=%~1"
set "FOUND=0"
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":%PORT% " ^| findstr LISTENING') do (
  set "FOUND=1"
  echo 端口 %PORT% 占用 PID: %%a
  taskkill /F /PID %%a >nul 2>&1
  if errorlevel 1 (
    echo WARN: 无法终止 PID %%a
  ) else (
    echo OK: 已释放端口 %PORT%
  )
)
if "%FOUND%"=="0" (
  echo OK: 端口 %PORT% 空闲
)
exit /b 0
