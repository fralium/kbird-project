# KBird 数据库初始化脚本
# 初始化数据库并导入种子数据

param(
    [string]$MongoDBUri = "mongodb://localhost:27017/kbird"
)

Write-Host "========================================" -ForegroundColor Green
Write-Host "   KBird 数据库初始化" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

$ErrorActionPreference = "Stop"

# Prefer repo root
if (-not (Test-Path "package.json")) {
    if (Test-Path (Join-Path $PSScriptRoot "..\..\package.json")) {
        Set-Location (Join-Path $PSScriptRoot "..\..")
    }
}

# Ensure sibling KBird-Data + .env paths (idempotent)
if (Test-Path "scripts\ensure-kbird-data.js") {
    node scripts/ensure-kbird-data.js
}

# 检查MongoDB连接
Write-Host "[1/3] 检查 MongoDB 连接..." -ForegroundColor Yellow
try {
    $mongoClient = New-Object System.Net.Sockets.TcpClient
    $mongoClient.Connect("127.0.0.1", 27017)
    $mongoClient.Close()
    Write-Host "✅ MongoDB 连接成功" -ForegroundColor Green
} catch {
    Write-Host "❌ 无法连接到 MongoDB" -ForegroundColor Red
    Write-Host "请确保 MongoDB 服务正在运行" -ForegroundColor Yellow
    Write-Host "运行: net start MongoDB" -ForegroundColor Cyan
    Read-Host "按 Enter 键退出"
    exit 1
}

# 检查Node.js
Write-Host ""
Write-Host "[2/3] 检查 Node.js..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version 2>$null
    Write-Host "✅ Node.js: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Node.js 未安装" -ForegroundColor Red
    exit 1
}

# 导入种子数据（优先公开文字种子，兼容本机完整种子）
Write-Host ""
Write-Host "[3/3] 导入种子数据..." -ForegroundColor Yellow

$seedPath = $null
if (Test-Path "seeds\birds-public.json") {
    $seedPath = "seeds\birds-public.json"
} elseif (Test-Path "seeds\birds-array.json") {
    $seedPath = "seeds\birds-array.json"
}

if ($seedPath) {
    Write-Host "找到种子数据文件: $seedPath" -ForegroundColor Cyan
    $seedPathJs = $seedPath -replace '\\', '/'

    # 创建导入脚本
    $importScript = @"
const mongoose = require('mongoose');
const fs = require('fs');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || '$MongoDBUri';
const SEED_PATH = '$seedPathJs';

async function importData() {
  try {
    console.log('🔧 连接数据库...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ 数据库连接成功');

    const Bird = mongoose.model('Bird', new mongoose.Schema({}, { strict: false }));

    const birdsData = JSON.parse(fs.readFileSync(SEED_PATH, 'utf8'));
    console.log('📊 准备导入 ' + birdsData.length + ' 条鸟类数据（' + SEED_PATH + '）');

    const clear = process.argv.includes('--clear');
    if (clear) {
      await Bird.deleteMany({});
      console.log('🗑️  已清空现有数据');
    }

    let imported = 0;
    let skipped = 0;

    for (const bird of birdsData) {
      try {
        const existing = bird._id
          ? await Bird.findOne({ _id: bird._id })
          : await Bird.findOne({ name: bird.name });
        if (existing) {
          skipped++;
          continue;
        }

        // Public seed has no createdBy; invent a placeholder ObjectId if required by schema later
        const doc = { ...bird };
        if (!doc.createdBy) {
          doc.createdBy = new mongoose.Types.ObjectId();
        }
        if (!Array.isArray(doc.images)) doc.images = [];
        if (!Array.isArray(doc.calls)) doc.calls = [];
        if (!Array.isArray(doc.sightings)) doc.sightings = [];

        await Bird.create(doc);
        imported++;
      } catch (error) {
        console.error('导入失败: ' + (bird.name || bird._id), error.message);
      }
    }

    console.log('✅ 导入完成: ' + imported + ' 条新数据, ' + skipped + ' 条已存在');
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ 导入失败:', error.message);
    process.exit(1);
  }
}

importData();
"@

    $tempScript = "temp-import-birds.js"
    Set-Content -Path $tempScript -Value $importScript

    Write-Host "正在导入数据..." -ForegroundColor Cyan
    node $tempScript

    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ 数据导入成功" -ForegroundColor Green
        Remove-Item $tempScript -ErrorAction SilentlyContinue
    } else {
        Write-Host "❌ 数据导入失败" -ForegroundColor Red
        Remove-Item $tempScript -ErrorAction SilentlyContinue
        exit 1
    }
} else {
    Write-Host "⚠️  未找到种子数据文件" -ForegroundColor Yellow
    Write-Host "优先: seeds\birds-public.json（公开文字名录）" -ForegroundColor Cyan
    Write-Host "兼容: seeds\birds-array.json（本机完整种子，勿推 Gitee）" -ForegroundColor Cyan
    Write-Host "可运行: node scripts/export-public-bird-seed.js" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "🎉 数据库初始化完成！" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Read-Host "按 Enter 键退出"
