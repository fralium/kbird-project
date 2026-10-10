/**
 * 基本信息「已维护名单」工具
 *
 * 用法：
 *   node scripts/basic-info-maintained.js snapshot   # 把当前已见且非占位的鸟写入名单
 *   node scripts/basic-info-maintained.js diff       # 对比：已见里有、名单里没有 → 待补
 *   node scripts/basic-info-maintained.js add 鸟名…  # 补完后把新种加入名单
 *   node scripts/basic-info-maintained.js status     # 统计
 */
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const Bird = require('../server/models/birdModel');
const Record = require('../server/models/recordModel');

const LIST_PATH = path.resolve(__dirname, '..', 'data', 'basic-info-maintained.json');
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/kbird';

function isStubDescription(description, habitat) {
  const d = String(description || '').trim();
  const h = String(habitat || '').trim();
  if (!d) return true;
  // 只认明确占位文案；短描述也可能是已维护的精简简介
  if (/待补充|待确认|基于《中国鸟类名录|用户申请添加|描述待补充/.test(d)) return true;
  if (/^待补充|^待确认/.test(h)) return true;
  return false;
}

function readList() {
  if (!fs.existsSync(LIST_PATH)) {
    return {
      version: 1,
      updatedAt: null,
      note: '已维护基本信息（描述/栖息地/分布/标签/保护等级）的已见鸟种名单。定期 diff，只补新增。',
      birds: [],
    };
  }
  return JSON.parse(fs.readFileSync(LIST_PATH, 'utf8'));
}

function writeList(data) {
  data.updatedAt = new Date().toISOString();
  data.count = (data.birds || []).length;
  fs.mkdirSync(path.dirname(LIST_PATH), { recursive: true });
  fs.writeFileSync(LIST_PATH, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function sortBirds(birds) {
  return [...birds].sort((a, b) => {
    const oa = a.order || '';
    const ob = b.order || '';
    if (oa !== ob) return oa.localeCompare(ob);
    return (a.name || '').localeCompare(b.name || '', 'zh');
  });
}

async function loadObservedBirds() {
  const birds = await Bird.find({})
    .select(
      '_id name scientificName englishName order family description habitat distribution tags chinaProtectionLevel iucnProtectionLevel images'
    )
    .lean();

  const idSet = new Set(birds.map((b) => String(b._id)));
  const counts = {};
  const cursor = Record.find({}).select('birds').lean().cursor();
  for await (const r of cursor) {
    for (const item of r.birds || []) {
      const id = item?.birdId ? String(item.birdId) : '';
      if (!id || !idSet.has(id)) continue;
      counts[id] = (counts[id] || 0) + 1;
    }
  }

  return birds
    .filter((b) => (counts[String(b._id)] || 0) > 0 || (b.images?.length || 0) > 0)
    .map((b) => ({
      name: b.name,
      scientificName: b.scientificName || '',
      englishName: b.englishName || '',
      order: b.order || '',
      family: b.family || '',
      chinaProtectionLevel: b.chinaProtectionLevel || '',
      iucnProtectionLevel: b.iucnProtectionLevel || '',
      recordCount: counts[String(b._id)] || 0,
      imageCount: b.images?.length || 0,
      stub: isStubDescription(b.description, b.habitat),
      descriptionLen: String(b.description || '').trim().length,
    }))
    .sort((a, b) => (a.order || '').localeCompare(b.order || '') || a.name.localeCompare(b.name, 'zh'));
}

async function cmdSnapshot() {
  const observed = await loadObservedBirds();
  const maintained = observed.filter((b) => !b.stub);
  const stubs = observed.filter((b) => b.stub);

  const data = {
    version: 1,
    updatedAt: null,
    note: '已维护基本信息的已见鸟种名单。用 diff 找出新增已见种，补完后用 add 写入，避免整库反复更新。',
    source: 'snapshot: observed AND description not stub',
    birds: sortBirds(
      maintained.map((b) => ({
        name: b.name,
        scientificName: b.scientificName,
        englishName: b.englishName,
        order: b.order,
        family: b.family,
        maintainedAt: new Date().toISOString().slice(0, 10),
      }))
    ),
  };
  writeList(data);

  console.log(`已写入 ${LIST_PATH}`);
  console.log(`已见 ${observed.length} 种；写入已维护 ${data.birds.length} 种；仍为占位 ${stubs.length} 种`);
  if (stubs.length) {
    console.log('\n仍为占位（未写入名单）:');
    for (const b of stubs) {
      console.log(`  - ${b.name} (${b.order || '?'}) descLen=${b.descriptionLen}`);
    }
  }
}

async function cmdDiff() {
  const list = readList();
  const maintainedNames = new Set((list.birds || []).map((b) => b.name));
  const observed = await loadObservedBirds();

  const newObserved = observed.filter((b) => !maintainedNames.has(b.name));
  const maintainedButUnobserved = (list.birds || []).filter(
    (b) => !observed.some((o) => o.name === b.name)
  );

  console.log(`名单已维护: ${maintainedNames.size} 种（更新于 ${list.updatedAt || '未知'}）`);
  console.log(`当前已见: ${observed.length} 种`);
  console.log(`\n新增已见、待补基本信息: ${newObserved.length} 种`);
  if (newObserved.length) {
    for (const b of newObserved) {
      const flag = b.stub ? '占位' : '已有文案未入名单';
      console.log(
        `  - ${b.name}\t${b.scientificName}\t${b.order || '?'}\t${b.chinaProtectionLevel || '-'}/${b.iucnProtectionLevel || '-'}\t[${flag}]`
      );
    }
  }

  if (maintainedButUnobserved.length) {
    console.log(`\n名单中有、但当前无观察/图片: ${maintainedButUnobserved.length} 种（可忽略）`);
  }

  const outPath = path.resolve(__dirname, '..', 'data', 'basic-info-pending.json');
  fs.writeFileSync(
    outPath,
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        pendingCount: newObserved.length,
        pending: newObserved.map((b) => ({
          name: b.name,
          scientificName: b.scientificName,
          englishName: b.englishName,
          order: b.order,
          family: b.family,
          chinaProtectionLevel: b.chinaProtectionLevel,
          iucnProtectionLevel: b.iucnProtectionLevel,
          stub: b.stub,
          recordCount: b.recordCount,
          imageCount: b.imageCount,
        })),
      },
      null,
      2
    )}\n`,
    'utf8'
  );
  console.log(`\n待补清单已写出: ${outPath}`);
}

async function cmdAdd(names) {
  if (!names.length) {
    console.error('用法: node scripts/basic-info-maintained.js add 鸟名1 鸟名2 ...');
    process.exit(1);
  }
  const list = readList();
  const byName = new Map((list.birds || []).map((b) => [b.name, b]));
  const dbBirds = await Bird.find({ name: { $in: names } })
    .select('name scientificName englishName order family description habitat')
    .lean();
  const found = new Map(dbBirds.map((b) => [b.name, b]));
  const missing = [];
  const added = [];
  const today = new Date().toISOString().slice(0, 10);

  for (const name of names) {
    const bird = found.get(name);
    if (!bird) {
      missing.push(name);
      continue;
    }
    if (isStubDescription(bird.description, bird.habitat)) {
      console.warn(`跳过（描述仍像占位）: ${name}`);
      continue;
    }
    byName.set(name, {
      name: bird.name,
      scientificName: bird.scientificName || '',
      englishName: bird.englishName || '',
      order: bird.order || '',
      family: bird.family || '',
      maintainedAt: today,
    });
    added.push(name);
  }

  list.birds = sortBirds([...byName.values()]);
  list.source = list.source || 'manual';
  writeList(list);

  console.log(`已加入名单 ${added.length} 种；名单总计 ${list.birds.length} 种`);
  if (missing.length) console.warn(`库中未找到: ${missing.join('、')}`);
}

async function cmdStatus() {
  const list = readList();
  const observed = await loadObservedBirds();
  const maintainedNames = new Set((list.birds || []).map((b) => b.name));
  const pending = observed.filter((b) => !maintainedNames.has(b.name));
  const byOrder = {};
  for (const b of list.birds || []) {
    const o = b.order || 'Unknown';
    byOrder[o] = (byOrder[o] || 0) + 1;
  }
  console.log(`名单文件: ${LIST_PATH}`);
  console.log(`已维护: ${list.birds?.length || 0}（updatedAt=${list.updatedAt || '无'}）`);
  console.log(`当前已见: ${observed.length}`);
  console.log(`待补/未入名单: ${pending.length}`);
  console.log('\n名单按目计数:');
  for (const [o, n] of Object.entries(byOrder).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))) {
    console.log(`  ${o}\t${n}`);
  }
}

async function main() {
  const cmd = process.argv[2] || 'status';
  await mongoose.connect(MONGODB_URI);
  try {
    if (cmd === 'snapshot') await cmdSnapshot();
    else if (cmd === 'diff') await cmdDiff();
    else if (cmd === 'add') await cmdAdd(process.argv.slice(3));
    else if (cmd === 'status') await cmdStatus();
    else {
      console.error('未知命令。可用: snapshot | diff | add | status');
      process.exit(1);
    }
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
