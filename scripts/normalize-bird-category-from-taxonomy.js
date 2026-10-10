#!/usr/bin/env node
/**
 * 批量规范 Bird.category 为：目中文 > 科中文（兜底到拉丁名）
 *
 * 用法：
 *   node scripts/normalize-bird-category-from-taxonomy.js
 *   node scripts/normalize-bird-category-from-taxonomy.js --apply
 */
const path = require('path');
const mongoose = require('mongoose');

require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const Bird = require('../server/models/birdModel');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/kbird';
const ORDER_ZH_MAP = {
  Accipitriformes: '鹰形目',
  Anseriformes: '雁形目',
  Apodiformes: '雨燕目',
  Bucerotiformes: '犀鸟目',
  Caprimulgiformes: '夜鹰目',
  Charadriiformes: '鸻形目',
  Ciconiiformes: '鹳形目',
  Columbiformes: '鸽形目',
  Coraciiformes: '佛法僧目',
  Cuculiformes: '鹃形目',
  Falconiformes: '隼形目',
  Galliformes: '鸡形目',
  Gaviiformes: '潜鸟目',
  Gruiformes: '鹤形目',
  Otidiformes: '鸨形目',
  Passeriformes: '雀形目',
  Pelecaniformes: '鹈鹕目',
  Phoenicopteriformes: '火烈鸟目',
  Piciformes: '鴷形目',
  Podicipediformes: '䴙䴘目',
  Procellariiformes: '鹱形目',
  Psittaciformes: '鹦形目',
  Pterocliformes: '沙鸡目',
  Strigiformes: '鸮形目',
  Trogoniformes: '咬鹃目',
  Turniciformes: '三趾鹑目',
};

function normalize(value) {
  return String(value || '').trim();
}

function parseArgs(argv) {
  return { apply: argv.slice(2).includes('--apply') };
}

function extractChinesePartsFromCategory(category) {
  const raw = normalize(category);
  if (!raw) return { orderZh: '', familyZh: '' };
  const parts = raw
    .split('>')
    .map((p) => normalize(p))
    .filter(Boolean);
  const orderZh = parts.find((p) => p.endsWith('目')) || '';
  const familyZh = parts.find((p) => p.endsWith('科')) || '';
  return { orderZh, familyZh };
}

async function main() {
  const { apply } = parseArgs(process.argv);
  console.log(`模式: ${apply ? 'APPLY(写入)' : 'DRY-RUN(预览)'}`);

  await mongoose.connect(MONGODB_URI);
  const birds = await Bird.find({}).select('_id name order family category').lean();

  const updates = [];
  for (const bird of birds) {
    const orderLatin = normalize(bird.order);
    const familyLatin = normalize(bird.family);
    const { orderZh: oldOrderZh, familyZh: oldFamilyZh } =
      extractChinesePartsFromCategory(bird.category);

    const orderDisplay = ORDER_ZH_MAP[orderLatin] || oldOrderZh || orderLatin;
    const familyDisplay = oldFamilyZh || familyLatin;
    const category = [orderDisplay, familyDisplay].filter(Boolean).join(' > ') || '其他';

    if (normalize(category) !== normalize(bird.category)) {
      updates.push({
        _id: bird._id,
        name: bird.name,
        before: bird.category || '',
        after: category,
      });
    }
  }

  console.log(`总鸟种: ${birds.length}`);
  console.log(`需更新 category: ${updates.length}`);
  if (updates.length > 0) {
    console.log('示例(前10):');
    updates.slice(0, 10).forEach((item) => {
      console.log(`- ${item.name}: "${item.before}" => "${item.after}"`);
    });
  }

  if (!apply || updates.length === 0) {
    console.log('\nDRY-RUN 完成，未写入。');
    if (updates.length > 0) {
      console.log('执行以下命令应用更新：');
      console.log('node scripts/normalize-bird-category-from-taxonomy.js --apply');
    }
    await mongoose.disconnect();
    return;
  }

  const bulkOps = updates.map((item) => ({
    updateOne: {
      filter: { _id: item._id },
      update: { $set: { category: item.after } },
    },
  }));
  const result = await Bird.bulkWrite(bulkOps, { ordered: false });
  console.log('\n写入结果:');
  console.log(JSON.stringify(result, null, 2));

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error('执行失败:', error.message);
  try {
    await mongoose.disconnect();
  } catch (e) {
    // ignore
  }
  process.exit(1);
});

