# JWT密钥生成脚本 (PowerShell)
# 适用于Windows系统

Write-Host "🔐 JWT密钥生成器" -ForegroundColor Green
Write-Host "==================" -ForegroundColor Green
Write-Host ""

Write-Host "📝 十六进制格式 (推荐用于.env文件):" -ForegroundColor Yellow
$bytes = New-Object Byte[] 64
(New-Object Security.Cryptography.RNGCryptoServiceProvider).GetBytes($bytes)
$hexSecret = [System.BitConverter]::ToString($bytes) -replace '-', ''
Write-Host "JWT_SECRET=$hexSecret" -ForegroundColor White
Write-Host ""

Write-Host "📝 Base64格式:" -ForegroundColor Yellow
$bytes = New-Object Byte[] 48
(New-Object Security.Cryptography.RNGCryptoServiceProvider).GetBytes($bytes)
$base64Secret = [System.Convert]::ToBase64String($bytes)
Write-Host "JWT_SECRET=$base64Secret" -ForegroundColor White
Write-Host ""

Write-Host "📝 自定义长度 (128字符):" -ForegroundColor Yellow
$bytes = New-Object Byte[] 64
(New-Object Security.Cryptography.RNGCryptoServiceProvider).GetBytes($bytes)
$customSecret = [System.Convert]::ToBase64String($bytes) + [System.Convert]::ToBase64String($bytes)
Write-Host "JWT_SECRET=$customSecret" -ForegroundColor White
Write-Host ""

Write-Host "⚠️  安全提示:" -ForegroundColor Red
Write-Host "1. 请将生成的密钥保存到.env文件中"
Write-Host "2. 不要将密钥提交到版本控制系统"
Write-Host "3. 生产环境请使用更长的密钥"
Write-Host "4. 定期更换密钥以提高安全性"
Write-Host ""

Write-Host "📋 .env文件示例:" -ForegroundColor Cyan
Write-Host "```env"
Write-Host "JWT_SECRET=$hexSecret"
Write-Host "MONGODB_URI=mongodb://localhost:27017/kbird"
Write-Host "PORT=3002"
Write-Host "NEXT_PUBLIC_API_URL=http://localhost:3002"
Write-Host "```"
