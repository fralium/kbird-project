#!/bin/bash

# Git 中文编码配置脚本
# 解决Gitee上中文乱码问题

echo "========================================"
echo "     Git 中文编码配置脚本"
echo "========================================"
echo

# 设置Git全局配置
echo "配置Git中文编码..."

# 禁用路径引号
git config --global core.quotepath false

# 设置提交编码为UTF-8
git config --global i18n.commitencoding utf-8

# 设置日志输出编码为UTF-8
git config --global i18n.logoutputencoding utf-8

# 设置推送编码为UTF-8
git config --global push.default simple

# 设置默认编辑器为UTF-8
git config --global core.editor "code --wait"

echo "✅ Git编码配置完成"
echo

# 显示当前配置
echo "当前Git配置："
echo "core.quotepath: $(git config --global core.quotepath)"
echo "i18n.commitencoding: $(git config --global i18n.commitencoding)"
echo "i18n.logoutputencoding: $(git config --global i18n.logoutputencoding)"
echo

echo "========================================"
echo "🎉 配置完成！现在可以正常使用中文提交信息了"
echo "========================================"
echo

echo "使用建议："
echo "1. 提交信息使用英文，避免编码问题"
echo "2. 如果必须使用中文，确保终端支持UTF-8"
echo "3. 使用 git commit -m 'message' 而不是交互式提交"
echo
