@echo off
REM 杀死占用指定端口的进程
REM 用法: kill-port.bat 13082

if "%1"=="" (
    echo 用法: kill-port.bat [端口号]
    echo 示例: kill-port.bat 13082
    exit /b 1
)

echo 正在查找占用端口 %1 的进程...

for /f "tokens=5" %%a in ('netstat -ano ^| findstr :%1 ^| findstr LISTENING') do (
    echo 找到进程 PID: %%a
    taskkill /F /PID %%a >nul 2>&1
    if errorlevel 1 (
        echo 无法终止进程 %%a
    ) else (
        echo 进程 %%a 已终止
    )
)

timeout /t 2 /nobreak >nul
echo 端口 %1 检查完成
