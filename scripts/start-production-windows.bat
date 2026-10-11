@echo off

REM Run from project root (this script lives in scripts\)
cd /d "%~dp0.."

echo ========================================
echo        KBird Windows production start
echo ========================================
echo.

if not exist "package.json" (
    echo ERROR: run this script from the project root
    timeout /t 5 /nobreak >nul
    exit /b 1
)

node --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js is not installed
    timeout /t 5 /nobreak >nul
    exit /b 1
)

npm --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: npm is not installed
    timeout /t 5 /nobreak >nul
    exit /b 1
)

echo [1/4] Checking dependencies...
if not exist "node_modules" (
    echo Installing packages...
    npm install
    if errorlevel 1 (
        echo ERROR: npm install failed
        timeout /t 5 /nobreak >nul
        exit /b 1
    )
) else (
    echo OK: dependencies present
)

echo.
echo [2/4] Applying production config...
if exist "next.config.production.js" (
    copy "next.config.production.js" "next.config.js" /Y >nul
    echo OK: using production next.config
) else (
    echo WARN: next.config.production.js not found, using default
)

echo.
echo [3/4] Building frontend...
echo Building production bundle...
npm run build
if errorlevel 1 (
    echo ERROR: frontend build failed
    timeout /t 5 /nobreak >nul
    exit /b 1
)
echo OK: frontend build done

echo.
echo [4/4] Starting services...
echo Starting backend (port 13082)...
start "KBird Backend" cmd /k "npm run server"
timeout /t 3 /nobreak >nul

echo.
echo Starting frontend (port 13080)...
start "KBird Frontend" cmd /k "npm run start"

echo.
echo ========================================
echo KBird production start complete
echo ========================================
echo.
echo Services:
echo   Frontend: http://localhost:13080 (production)
echo   Backend:  http://localhost:13082
echo.
echo Production notes:
echo   - minified / optimized build
echo   - static asset optimization
echo   - security headers
echo.
echo Stop: close the console windows or run stop-windows.bat
echo.
