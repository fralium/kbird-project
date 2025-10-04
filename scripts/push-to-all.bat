@echo off
chcp 65001 >nul
echo 🚀 推送到所有远程仓库
echo ====================
echo.

REM 检查当前分支
for /f "tokens=*" %%i in ('git branch --show-current') do set CURRENT_BRANCH=%%i
echo 📋 当前分支: %CURRENT_BRANCH%
echo.

REM 推送到Gitee (使用master分支)
echo 📤 推送到Gitee...
git push gitee master
if %errorlevel% equ 0 (
    echo ✅ Gitee推送成功
) else (
    echo ❌ Gitee推送失败
)
echo.

REM 推送到GitHub (使用main分支)
echo 📤 推送到GitHub...
git push github master:main
if %errorlevel% equ 0 (
    echo ✅ GitHub推送成功
) else (
    echo ❌ GitHub推送失败
)
echo.

REM 推送所有标签
echo 🏷️  推送所有标签...
git push gitee --tags
if %errorlevel% equ 0 (
    echo ✅ Gitee标签推送成功
) else (
    echo ❌ Gitee标签推送失败
)

git push github --tags
if %errorlevel% equ 0 (
    echo ✅ GitHub标签推送成功
) else (
    echo ❌ GitHub标签推送失败
)
echo.

echo 🎉 推送完成！
echo 📋 仓库地址:
echo   Gitee:  https://gitee.com/fralium/kbird-project
echo   GitHub: https://github.com/fralium/kbird-project
echo.
pause
