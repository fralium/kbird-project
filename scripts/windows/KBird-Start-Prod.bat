@echo off
setlocal EnableDelayedExpansion
set "MONGOD_EXE="
set "MONGOD_CFG="
set "MONGO_OK=0"
set "MONGO_DIRECT_STARTED=0"
set "MONGO_STARTUP_WAIT_SECONDS=15"

REM Always run from project root
cd /d "%~dp0..\.."
title KBird Start (Production)

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
echo    KBird Start (Production)
echo ========================================
echo.

if not exist "package.json" (
    echo ERROR: Please run from the KBird project.
    timeout /t 5 /nobreak >nul
    exit /b 1
)

node --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js is not installed.
    echo Run: scripts\windows\install.ps1
    timeout /t 5 /nobreak >nul
    exit /b 1
)

echo [1/5] Checking MongoDB service...
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
echo [2/5] Checking dependencies...
if not exist "node_modules" (
    echo Installing dependencies...
    call npm install
    if errorlevel 1 (
        echo ERROR: npm install failed.
        timeout /t 5 /nobreak >nul
        exit /b 1
    )
) else (
    echo OK: dependencies already installed.
)

echo.
echo [3/5] Desktop launcher (first run only)...
if not exist ".kbird\desktop-launcher.done" (
    if not exist ".kbird" mkdir ".kbird" >nul 2>&1
    powershell -NoProfile -ExecutionPolicy Bypass -File "%CD%\scripts\windows\create-desktop-shortcut.ps1" -Target Prod -Quiet
    if errorlevel 1 (
        echo WARN: Desktop launcher skipped. You can run Create-Desktop-Shortcut.bat later.
    )
    >".kbird\desktop-launcher.done" echo done
) else (
    echo OK: Desktop launcher already set up.
)

echo.
echo [4/5] Checking production build...
set "NEED_BUILD=0"
if not exist ".next\BUILD_ID" (
    set "NEED_BUILD=1"
    echo No production build found. Building now...
) else (
    REM Rebuild when app source is newer than last production build
    powershell -NoProfile -Command ^
      "$b=(Get-Item -LiteralPath '.next\BUILD_ID').LastWriteTimeUtc; " ^
      "$newer=@(Get-ChildItem -Path 'app','components','styles','utils','public' -Recurse -File -ErrorAction SilentlyContinue | " ^
      "  Where-Object { $_.LastWriteTimeUtc -gt $b } | Select-Object -First 1); " ^
      "if($newer){ exit 2 } else { exit 0 }"
    if errorlevel 2 (
        set "NEED_BUILD=1"
        echo Source newer than .next build. Rebuilding...
    ) else (
        echo OK: production build is up to date.
    )
)
if "%NEED_BUILD%"=="1" (
    call npm run build
    if errorlevel 1 (
        echo ERROR: production build failed.
        timeout /t 5 /nobreak >nul
        exit /b 1
    )
)

echo.
echo [5/5] Starting production services...
echo.
echo Freeing ports 13080 / 13082 if a previous instance is still running...
taskkill /F /FI "WINDOWTITLE eq KBird Backend*" >nul 2>&1
taskkill /F /FI "WINDOWTITLE eq KBird Frontend*" >nul 2>&1
call :free_port 13080
call :free_port 13082
timeout /t 1 /nobreak >nul

echo Starting backend on port 13082 (production mode)...
start "KBird Backend (Prod)" cmd /k "cd /d ""%CD%"" && set NODE_ENV=production && node server/index.js"
timeout /t 3 /nobreak >nul

echo Starting frontend on port 13080 (production mode)...
start "KBird Frontend (Prod)" cmd /k "cd /d ""%CD%"" && npx cross-env NODE_ENV=production next start -p 13080"

echo.
echo Waiting for services...
timeout /t 5 /nobreak >nul

echo.
echo Opening browser...
start http://localhost:13080

echo.
echo ========================================
echo KBird production mode started.
echo ========================================
echo Frontend: http://localhost:13080 (next start)
echo Backend : http://localhost:13082 (node server/index.js)
echo.
if "%MONGO_DIRECT_STARTED%"=="1" (
    echo MongoDB : direct mode window "KBird MongoDB (Direct)" is running
)
echo To stop, close "KBird Backend (Prod)" and "KBird Frontend (Prod)"
echo Or run scripts\windows\KBird-Stop.bat
echo.

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

:free_port
set "PORT=%~1"
set "FOUND=0"
set "SEEN="
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":%PORT% " ^| findstr LISTENING') do (
  echo ;!SEEN!; | findstr /C:";%%a;" >nul 2>&1
  if errorlevel 1 (
    set "SEEN=!SEEN!;%%a"
    set "FOUND=1"
    echo Port %PORT% in use by PID: %%a — stopping...
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
