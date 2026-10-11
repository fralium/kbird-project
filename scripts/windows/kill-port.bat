@echo off
REM Kill process listening on a port
REM Usage: kill-port.bat 13082

if "%1"=="" (
    echo Usage: kill-port.bat [port]
    echo Example: kill-port.bat 13082
    exit /b 1
)

echo Looking for process on port %1...

for /f "tokens=5" %%a in ('netstat -ano ^| findstr :%1 ^| findstr LISTENING') do (
    echo Found PID: %%a
    taskkill /F /PID %%a >nul 2>&1
    if errorlevel 1 (
        echo Failed to kill PID %%a
    ) else (
        echo Killed PID %%a
    )
)

timeout /t 2 /nobreak >nul
echo Port %1 check done
