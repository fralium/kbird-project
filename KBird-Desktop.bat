@echo off
REM KBird 桌面快捷启动脚本
REM 将此文件放在项目根目录，可以创建桌面快捷方式

cd /d "%~dp0"
call scripts\windows\KBird-Desktop.bat
