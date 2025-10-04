#!/bin/bash

# JWT密钥生成脚本
# 使用OpenSSL生成安全的JWT密钥

echo "🔐 JWT密钥生成器"
echo "=================="
echo

echo "📝 十六进制格式 (推荐用于.env文件):"
HEX_SECRET=$(openssl rand -hex 64)
echo "JWT_SECRET=$HEX_SECRET"
echo

echo "📝 Base64格式:"
BASE64_SECRET=$(openssl rand -base64 48)
echo "JWT_SECRET=$BASE64_SECRET"
echo

echo "📝 Base64URL格式 (URL安全):"
BASE64URL_SECRET=$(openssl rand -base64 48 | tr -d "=+/" | cut -c1-64)
echo "JWT_SECRET=$BASE64URL_SECRET"
echo

echo "⚠️  安全提示:"
echo "1. 请将生成的密钥保存到.env文件中"
echo "2. 不要将密钥提交到版本控制系统"
echo "3. 生产环境请使用更长的密钥"
echo "4. 定期更换密钥以提高安全性"
echo

echo "📋 .env文件示例:"
echo "\`\`\`env"
echo "JWT_SECRET=$HEX_SECRET"
echo "MONGODB_URI=mongodb://localhost:27017/kbird"
echo "PORT=3002"
echo "NEXT_PUBLIC_API_URL=http://localhost:3002"
echo "\`\`\`"
