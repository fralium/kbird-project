@echo off
chcp 65001 >nul

echo ========================================
echo           KBird 服务停止脚本
echo ========================================
echo.

echo [1/2] 停止所有服务...
REM 杀死Node.js进程
taskkill /f /im node.exe >nul 2>&1
taskkill /f /im "next dev" >nul 2>&1
taskkill /f /im "nodemon server/index.js" >nul 2>&1
echo ✅ 服务已停止

echo [2/2] 检查并清理端口...
REM 检查端口占用并清理
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :13080') do (
    taskkill /f /pid %%a >nul 2>&1
)

for /f "tokens=5" %%a in ('netstat -ano ^| findstr :13082') do (
    taskkill /f /pid %%a >nul 2>&1
)

echo ✅ 端口清理完成

echo.
echo ========================================
echo 🎉 KBird 服务已完全停止！
echo ========================================
echo.
pause

