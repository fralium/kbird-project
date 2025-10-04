#!/bin/bash

# 推送到所有远程仓库的脚本
# 支持同时推送到Gitee和GitHub

echo "🚀 推送到所有远程仓库"
echo "===================="
echo

# 检查当前分支
CURRENT_BRANCH=$(git branch --show-current)
echo "📋 当前分支: $CURRENT_BRANCH"
echo

# 推送到Gitee (使用master分支)
echo "📤 推送到Gitee..."
git push gitee master
if [ $? -eq 0 ]; then
    echo "✅ Gitee推送成功"
else
    echo "❌ Gitee推送失败"
fi
echo

# 推送到GitHub (使用main分支)
echo "📤 推送到GitHub..."
# 检查GitHub是否有main分支，如果没有则创建
git push github master:main
if [ $? -eq 0 ]; then
    echo "✅ GitHub推送成功"
else
    echo "❌ GitHub推送失败"
fi
echo

# 推送所有标签
echo "🏷️  推送所有标签..."
git push gitee --tags
if [ $? -eq 0 ]; then
    echo "✅ Gitee标签推送成功"
else
    echo "❌ Gitee标签推送失败"
fi

git push github --tags
if [ $? -eq 0 ]; then
    echo "✅ GitHub标签推送成功"
else
    echo "❌ GitHub标签推送失败"
fi
echo

echo "🎉 推送完成！"
echo "📋 仓库地址:"
echo "  Gitee:  https://gitee.com/fralium/kbird-project"
echo "  GitHub: https://github.com/fralium/kbird-project"
