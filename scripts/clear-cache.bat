@echo off
title Clear Next.js cache

echo ========================================
echo    Clear Next.js cache
echo ========================================
echo.

if exist .next (
    echo [1/2] Removing .next ...
    rmdir /s /q .next
    echo OK: .next removed
) else (
    echo OK: .next not found
)

if exist node_modules\.cache (
    echo [2/2] Removing node_modules\.cache ...
    rmdir /s /q node_modules\.cache
    echo OK: node_modules\.cache removed
) else (
    echo OK: node_modules\.cache not found
)

echo.
echo ========================================
echo Cache cleared
echo ========================================
echo.
echo Restart the dev server: npm run dev
echo.
