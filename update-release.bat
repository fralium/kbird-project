@echo off
chcp 65001 >nul
echo 🔄 KBird 发布版本更新脚本
echo.

set "SOURCE_PATH=..\"
set "TARGET_PATH=."
set "VERSION=v1.1.0"

echo 📁 源路径: %SOURCE_PATH%
echo 📁 目标路径: %TARGET_PATH%
echo 🏷️  版本: %VERSION%
echo.

echo 🔍 开始检测和复制修改的文件...
echo.

:: 复制主要目录
echo 📂 复制 components 目录...
if exist "%SOURCE_PATH%components" (
    robocopy "%SOURCE_PATH%components" "components" /E /XD node_modules .git /XF *.log *.tmp *.temp *.debug.js *test*.js
) else (
    echo ⚠️  components 目录不存在
)

echo 📂 复制 pages 目录...
if exist "%SOURCE_PATH%pages" (
    robocopy "%SOURCE_PATH%pages" "pages" /E /XD node_modules .git /XF *.log *.tmp *.temp *.debug.js *test*.js
) else (
    echo ⚠️  pages 目录不存在
)

echo 📂 复制 server 目录...
if exist "%SOURCE_PATH%server" (
    robocopy "%SOURCE_PATH%server" "server" /E /XD node_modules .git /XF *.log *.tmp *.temp *.debug.js *test*.js
) else (
    echo ⚠️  server 目录不存在
)

echo 📂 复制 styles 目录...
if exist "%SOURCE_PATH%styles" (
    robocopy "%SOURCE_PATH%styles" "styles" /E /XD node_modules .git /XF *.log *.tmp *.temp *.debug.js *test*.js
) else (
    echo ⚠️  styles 目录不存在
)

echo 📂 复制 data 目录...
if exist "%SOURCE_PATH%data" (
    robocopy "%SOURCE_PATH%data" "data" /E /XD node_modules .git /XF *.log *.tmp *.temp *.debug.js *test*.js
) else (
    echo ⚠️  data 目录不存在
)

echo 📂 复制 utils 目录...
if exist "%SOURCE_PATH%utils" (
    robocopy "%SOURCE_PATH%utils" "utils" /E /XD node_modules .git /XF *.log *.tmp *.temp *.debug.js *test*.js
) else (
    echo ⚠️  utils 目录不存在
)

echo 📂 复制 middleware 目录...
if exist "%SOURCE_PATH%middleware" (
    robocopy "%SOURCE_PATH%middleware" "middleware" /E /XD node_modules .git /XF *.log *.tmp *.temp *.debug.js *test*.js
) else (
    echo ⚠️  middleware 目录不存在
)

echo 📂 复制 public 目录...
if exist "%SOURCE_PATH%public" (
    robocopy "%SOURCE_PATH%public" "public" /E /XD node_modules .git /XF *.log *.tmp *.temp *.debug.js *test*.js
) else (
    echo ⚠️  public 目录不存在
)

echo 📂 复制 scripts 目录...
if exist "%SOURCE_PATH%scripts" (
    robocopy "%SOURCE_PATH%scripts" "scripts" /E /XD node_modules .git /XF *.log *.tmp *.temp *.debug.js *test*.js
) else (
    echo ⚠️  scripts 目录不存在
)

:: 复制重要配置文件
echo 📄 复制配置文件...
copy "%SOURCE_PATH%package.json" "%TARGET_PATH%\" >nul 2>&1
copy "%SOURCE_PATH%package-lock.json" "%TARGET_PATH%\" >nul 2>&1
copy "%SOURCE_PATH%next.config.js" "%TARGET_PATH%\" >nul 2>&1
copy "%SOURCE_PATH%env.example" "%TARGET_PATH%\" >nul 2>&1
copy "%SOURCE_PATH%docker-compose.yml" "%TARGET_PATH%\" >nul 2>&1
copy "%SOURCE_PATH%Dockerfile" "%TARGET_PATH%\" >nul 2>&1
copy "%SOURCE_PATH%ecosystem.config.js" "%TARGET_PATH%\" >nul 2>&1
copy "%SOURCE_PATH%restart.sh" "%TARGET_PATH%\" >nul 2>&1

echo.
echo 🚀 准备提交到Git...
if exist ".git" (
    echo 📝 添加文件到Git...
    git add .
    
    echo 💾 提交更改...
    git commit -m "Update: %VERSION% - Sync changes from development"
    
    echo 🏷️  创建标签...
    git tag -a %VERSION% -m "Release %VERSION%"
    
    echo ✅ Git操作完成
    echo.
    echo 📤 可以推送到远程仓库:
    echo git push origin master
    echo git push origin %VERSION%
) else (
    echo ⚠️  当前目录不是Git仓库，跳过Git操作
)

echo.
echo 🎉 更新完成！
echo.
pause
