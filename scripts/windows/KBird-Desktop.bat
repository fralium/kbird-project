@echo off
setlocal EnableDelayedExpansion
set "MONGOD_EXE="
set "MONGOD_CFG="
set "MONGO_OK=0"
set "MONGO_DIRECT_STARTED=0"
set "MONGO_STARTUP_WAIT_SECONDS=15"

REM Always run from project root
cd /d "%~dp0..\.."
title KBird Desktop Launcher

REM Auto-detect MongoDB install (any version under Program Files), no hard-coded path
for /d %%D in ("C:\Program Files\MongoDB\Server\*") do (
  if exist "%%D\bin\mongod.exe" (
    set "MONGOD_EXE=%%D\bin\mongod.exe"
    if exist "%%D\bin\mongod.cfg" (
      set "MONGOD_CFG=%%D\bin\mongod.cfg"
    ) else (
      set "MONGOD_CFG="
    )
  )
)
if not defined MONGOD_EXE (
  where mongod >nul 2>&1
  if not errorlevel 1 (
    for /f "delims=" %%P in ('where mongod') do (
      if not defined MONGOD_EXE set "MONGOD_EXE=%%P"
    )
  )
)

echo ========================================
echo        KBird Desktop Launcher
echo ========================================
echo.

if not exist "package.json" (
    echo ERROR: Please run from the KBird project.
    pause
    exit /b 1
)

node --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js is not installed.
    echo Run: scripts\windows\install.ps1
    pause
    exit /b 1
)

echo [1/3] Checking MongoDB service...
sc query MongoDB >nul 2>&1
if errorlevel 1 (
    echo WARN: MongoDB service is not installed or not recognized.
    call :start_mongo_direct
) else (
    sc.exe query MongoDB | find "RUNNING" >nul 2>&1
    if not errorlevel 1 (
        echo OK: MongoDB service already running.
        set "MONGO_OK=1"
    ) else (
        net start MongoDB >nul 2>&1
        sc.exe query MongoDB | find "RUNNING" >nul 2>&1
        if not errorlevel 1 (
            echo OK: MongoDB service started.
            set "MONGO_OK=1"
        ) else (
            echo WARN: MongoDB service is installed but NOT running.
            echo       This usually means one of these:
            echo       - current shell has no Administrator permission
            echo       - MongoDB service failed to start (check Windows Services)
            echo.
            call :start_mongo_direct
        )
    )
)

if "%MONGO_OK%"=="1" (
    echo OK: MongoDB is reachable on 127.0.0.1:27017.
) else (
    echo WARN: MongoDB is still not reachable.
    set /p start_anyway="Continue anyway? Type y to continue: "
    if /i not "%start_anyway%"=="y" exit /b 1
)

echo.
echo [2/3] Checking dependencies...
if not exist "node_modules" (
    echo Installing dependencies...
    call npm install
    if errorlevel 1 (
        echo ERROR: npm install failed.
        pause
        exit /b 1
    )
) else (
    echo OK: dependencies already installed.
)

echo.
echo [3/3] Starting services...
echo.
echo Starting backend on port 13082...
start "KBird Backend" cmd /k "cd /d ""%CD%"" && npm run server"
timeout /t 3 /nobreak >nul

echo Starting frontend on port 13080...
start "KBird Frontend" cmd /k "cd /d ""%CD%"" && npm run dev"

echo.
echo Waiting for services...
timeout /t 5 /nobreak >nul

echo.
echo Opening browser...
start http://localhost:13080

echo.
echo ========================================
echo KBird started.
echo ========================================
echo Frontend: http://localhost:13080
echo Backend : http://localhost:13082
echo.
if "%MONGO_DIRECT_STARTED%"=="1" (
    echo MongoDB : direct mode window "KBird MongoDB (Direct)" is running
)
echo To stop, close "KBird Backend" and "KBird Frontend"
echo Or run scripts\windows\KBird-Stop.bat
echo.
pause

goto :eof

:start_mongo_direct
call :check_mongo_port
if not errorlevel 1 (
    echo OK: MongoDB is already listening on 127.0.0.1:27017.
    set "MONGO_OK=1"
    goto :eof
)

if not exist "%MONGOD_EXE%" (
    echo WARN: mongod.exe not found: "%MONGOD_EXE%"
    goto :eof
)
if not exist "%MONGOD_CFG%" (
    echo WARN: mongod.cfg not found: "%MONGOD_CFG%"
    goto :eof
)

echo Trying direct MongoDB start (no admin required)...
start "KBird MongoDB (Direct)" "%MONGOD_EXE%" --config "%MONGOD_CFG%"
set /a _wait=0
:wait_for_mongo_port
call :check_mongo_port
if not errorlevel 1 (
    echo OK: MongoDB started in direct mode.
    set "MONGO_OK=1"
    set "MONGO_DIRECT_STARTED=1"
    goto :eof
)
set /a _wait+=1
if %_wait% GEQ %MONGO_STARTUP_WAIT_SECONDS% (
    echo WARN: Direct MongoDB start did not open port 27017 within %MONGO_STARTUP_WAIT_SECONDS%s.
    goto :eof
)
timeout /t 1 /nobreak >nul
goto :wait_for_mongo_port

:check_mongo_port
netstat -ano | findstr :27017 | findstr LISTENING >nul 2>&1
if errorlevel 1 (
    exit /b 1
)
exit /b 0
goto :eof
