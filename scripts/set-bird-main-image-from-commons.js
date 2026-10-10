/**
 * 从 Wikimedia Commons 下载 CC 许可图片，设为鸟种主图。
 * 用法: node scripts/set-bird-main-image-from-commons.js
 */
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const Bird = require('../server/models/birdModel');
const { getActiveUploadsRoot } = require('../server/utils/safeUploadPath');

const TARGETS = [
  {
    birdId: '68db6eba5fa3c9cec50de542',
    name: '鸳鸯',
    caption: '鸳鸯（雄）· Wikimedia Commons / Alexis Lours',
    // Featured picture on Commons
    file: 'Mandarin_duck_(Aix_galericulata).jpg',
  },
  {
    birdId: '68db6eba5fa3c9cec50dea6d',
    name: '叉尾太阳鸟',
    caption: '叉尾太阳鸟（雄）· Wikimedia Commons',
    file: 'Aethopyga_christinae_-_male.jpg',
  },
];

function commonsThumbUrl(fileName, width = 1280) {
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(fileName)}?width=${width}`;
}

async function downloadImage(url, absPath) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'KBirdLocal/1.0 (personal bird archive; local import)',
      Accept: 'image/*,*/*',
    },
    redirect: 'follow',
  });
  if (!res.ok) {
    throw new Error(`下载失败 ${res.status}: ${url}`);
  }
  const contentType = String(res.headers.get('content-type') || '');
  if (!contentType.includes('image')) {
    throw new Error(`返回非图片类型 (${contentType}): ${url}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 1000) {
    throw new Error(`文件过小，可能不是有效图片: ${url}`);
  }
  fs.writeFileSync(absPath, buf);
  return buf.length;
}

async function main() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/kbird';
  await mongoose.connect(mongoUri);

  const uploadDir = getActiveUploadsRoot();
  fs.mkdirSync(uploadDir, { recursive: true });

  for (const target of TARGETS) {
    const bird = await Bird.findById(target.birdId);
    if (!bird) {
      console.error(`未找到鸟种: ${target.name} (${target.birdId})`);
      continue;
    }

    const fileName = `image-${Date.now()}-${Math.floor(Math.random() * 1e9)}.jpg`;
    const absPath = path.join(uploadDir, fileName);
    const size = await downloadImage(commonsThumbUrl(target.file), absPath);
    const imageUrl = `/uploads/active/${fileName}`;

    const existing = Array.isArray(bird.images) ? bird.images : [];
    // 新图作为主图（order=0），原图后移
    const nextImages = [
      {
        url: imageUrl,
        caption: target.caption,
        location: '',
        date: new Date(),
        order: 0,
        source: 'wikimedia_commons',
      },
      ...existing.map((img, i) => ({
        ...(img.toObject?.() || img),
        order: i + 1,
      })),
    ];

    bird.images = nextImages;
    bird.markModified('images');
    await bird.save();

    console.log(`✓ ${target.name}: ${imageUrl} (${size} bytes), 现共 ${nextImages.length} 张`);
  }

  await mongoose.disconnect();
  console.log('完成');
}

main().catch(async (err) => {
  console.error(err);
  try {
    await mongoose.disconnect();
  } catch {
    // ignore
  }
  process.exit(1);
});
