# 杀死占用指定端口的进程
param(
    [Parameter(Mandatory=$true)]
    [int]$Port
)

Write-Host "正在查找占用端口 $Port 的进程..." -ForegroundColor Yellow

$connections = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue

if ($connections) {
    $processIds = $connections | Select-Object -ExpandProperty OwningProcess -Unique
    
    foreach ($pid in $processIds) {
        $process = Get-Process -Id $pid -ErrorAction SilentlyContinue
        if ($process) {
            Write-Host "找到进程: $($process.ProcessName) (PID: $pid)" -ForegroundColor Cyan
            Write-Host "正在终止进程..." -ForegroundColor Yellow
            Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
            Write-Host "进程已终止" -ForegroundColor Green
        }
    }
} else {
    Write-Host "端口 $Port 未被占用" -ForegroundColor Green
}

# 等待一下确保端口释放
Start-Sleep -Seconds 1

# 验证端口是否已释放
$check = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
if ($check) {
    Write-Host "警告: 端口 $Port 仍被占用" -ForegroundColor Red
} else {
    Write-Host "端口 $Port 已释放" -ForegroundColor Green
}
