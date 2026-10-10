@echo off
chcp 65001 >nul

REM 强制切换到项目根目录（脚本位于 scripts 目录）
cd /d "%~dp0.."

echo ========================================
echo        KBird Windows生产环境启动
echo ========================================
echo.

REM 检查是否在正确的目录
if not exist "package.json" (
    echo ❌ 请在项目根目录运行此脚本
    pause
    exit /b 1
)

REM 检查Node.js是否安装
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ 错误: Node.js 未安装
    pause
    exit /b 1
)

REM 检查npm是否安装
npm --version >nul 2>&1
if errorlevel 1 (
    echo ❌ 错误: npm 未安装
    pause
    exit /b 1
)

echo [1/4] 检查依赖...
if not exist "node_modules" (
    echo 📦 安装依赖包...
    npm install
    if errorlevel 1 (
        echo ❌ 依赖安装失败
        pause
        exit /b 1
    )
) else (
    echo ✅ 依赖已存在
)

echo.
echo [2/4] 设置生产环境配置...
REM 复制生产配置文件
if exist "next.config.production.js" (
    copy "next.config.production.js" "next.config.js" /Y >nul
    echo ✅ 已使用生产环境配置
) else (
    echo ⚠️  未找到生产配置文件，使用默认配置
)

echo.
echo [3/4] 构建前端应用...
echo 🔄 正在构建生产版本...
npm run build
if errorlevel 1 (
    echo ❌ 前端构建失败
    pause
    exit /b 1
)
echo ✅ 前端生产构建完成

echo.
echo [4/4] 启动服务...
echo 启动后端服务 ^(端口 13082^)...
start "KBird Backend" cmd /k "npm run server"
timeout /t 3 /nobreak >nul

echo.
echo 启动前端服务 ^(端口 13080^)...
start "KBird Frontend" cmd /k "npm run start"

echo.
echo ========================================
echo 🎉 KBird 生产环境启动完成！
echo ========================================
echo.
echo 📊 服务信息:
echo   • 前端服务: http://localhost:13080 ^(生产模式^)
echo   • 后端服务: http://localhost:13082
echo.
echo 🔧 生产环境特性:
echo   • 代码压缩和优化
echo   • 静态资源优化
echo   • 安全头设置
echo   • 性能优化
echo.
echo 🛑 停止服务: 关闭对应的命令行窗口或运行 stop-windows.bat
echo.
echo ✅ 生产环境启动完成！
pause
