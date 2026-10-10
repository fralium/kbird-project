@echo off
chcp 65001 >nul
title 清除 Next.js 缓存

echo ========================================
echo    清除 Next.js 缓存
echo ========================================
echo.

REM 清除 .next 目录
if exist .next (
    echo [1/2] 删除 .next 目录...
    rmdir /s /q .next
    echo ✓ .next 目录已删除
) else (
    echo ✓ .next 目录不存在
)

REM 清除 node_modules/.cache 目录
if exist node_modules\.cache (
    echo [2/2] 删除 node_modules/.cache 目录...
    rmdir /s /q node_modules\.cache
    echo ✓ node_modules/.cache 目录已删除
) else (
    echo ✓ node_modules/.cache 目录不存在
)

echo.
echo ========================================
echo ✓ 缓存清除完成！
echo ========================================
echo.
echo 请重启开发服务器: npm run dev
echo.
pause
