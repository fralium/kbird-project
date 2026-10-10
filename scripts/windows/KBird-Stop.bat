@echo off
chcp 65001 >nul
title KBird 停止服务
setlocal EnableDelayedExpansion

echo ========================================
echo    KBird 停止服务
echo ========================================
echo.

REM 停止Node.js进程
echo [1/4] 停止 Node.js 服务...
taskkill /F /IM node.exe >nul 2>&1
if errorlevel 1 (
    echo ✅ 没有运行中的 Node.js 进程
) else (
    echo ✅ Node.js 进程已停止
)

REM 释放端口13082（如果被占用）
echo.
echo [2/4] 检查并释放端口 13082...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :13082 ^| findstr LISTENING') do (
    echo 发现占用端口13082的进程 PID: %%a
    taskkill /F /PID %%a >nul 2>&1
    if errorlevel 1 (
        echo ⚠️  无法终止进程 %%a
    ) else (
        echo ✅ 进程 %%a 已终止，端口13082已释放
    )
)
timeout /t 1 /nobreak >nul

REM 停止直接启动的 mongod.exe（可选）
echo.
echo [3/4] MongoDB 直连进程状态...
set "MONGO_DIRECT_FOUND=0"
for /f %%p in ('powershell -NoProfile -Command "$procs = Get-CimInstance Win32_Process ^| Where-Object { $_.Name -eq 'mongod.exe' -and $_.CommandLine -match 'mongod.cfg' }; $procs ^| ForEach-Object { $_.ProcessId }"') do (
    set "MONGO_DIRECT_FOUND=1"
    if not defined MONGO_DIRECT_PIDS (
        set "MONGO_DIRECT_PIDS=%%p"
    ) else (
        set "MONGO_DIRECT_PIDS=!MONGO_DIRECT_PIDS! %%p"
    )
)
if "%MONGO_DIRECT_FOUND%"=="1" (
    set /p stop_mongo_direct="检测到 mongod.exe 直连进程，是否停止? (y/n): "
    if /i "%stop_mongo_direct%"=="y" (
        for %%p in (%MONGO_DIRECT_PIDS%) do (
            taskkill /F /PID %%p >nul 2>&1
            if errorlevel 1 (
                echo ⚠️  无法终止 mongod 进程 %%p
            ) else (
                echo ✅ 已终止 mongod 进程 %%p
            )
        )
    ) else (
        echo ⏭️  保留 mongod 直连进程运行
    )
) else (
    echo ✅ 未检测到 mongod 直连进程
)

REM 停止MongoDB服务（可选）
echo.
echo [4/4] MongoDB 服务状态...
sc query MongoDB >nul 2>&1
if not errorlevel 1 (
    set /p stop_mongo="是否停止 MongoDB 服务? (y/n): "
    if /i "%stop_mongo%"=="y" (
        net stop MongoDB >nul 2>&1
        if errorlevel 1 (
            echo ⚠️  MongoDB 服务停止失败或已在停止状态
        ) else (
            echo ✅ MongoDB 服务已停止
        )
    ) else (
        echo ⏭️  保留 MongoDB 服务运行
    )
)

echo.
echo ========================================
echo ✅ KBird 服务已停止
echo ========================================
echo.
pause
