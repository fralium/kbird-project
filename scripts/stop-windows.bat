@echo off

echo ========================================
echo           KBird Stop Services
echo ========================================
echo.

echo [1/2] Stopping services...
taskkill /f /im node.exe >nul 2>&1
taskkill /f /im "next dev" >nul 2>&1
taskkill /f /im "nodemon server/index.js" >nul 2>&1
echo OK: services stopped

echo [2/2] Cleaning ports...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :13080') do (
    taskkill /f /pid %%a >nul 2>&1
)

for /f "tokens=5" %%a in ('netstat -ano ^| findstr :13082') do (
    taskkill /f /pid %%a >nul 2>&1
)

echo OK: ports cleaned

echo.
echo ========================================
echo KBird fully stopped
echo ========================================
echo.
