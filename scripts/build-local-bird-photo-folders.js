#!/usr/bin/env node
/**
 * 在本机分类照片根目录按 目/科/种 建文件夹，并把原来摊在根下的鸟种文件夹挪进去。
 *
 *   node scripts/build-local-bird-photo-folders.js --root "C:\\path\\to\\bird-photos"
 */
const fs = require('fs');
const fsp = require('fs').promises;
const path = require('path');
const mongoose = require('mongoose');

require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const Bird = require('../server/models/birdModel');

const INVALID = /[<>:"/\\|?*\u0000-\u001f]/g;

const sanitize = (name, fallback) => {
  const cleaned = String(name || '')
    .replace(INVALID, '_')
    .replace(/[. ]+$/g, '')
    .trim();
  return cleaned || fallback;
};

const parseArgs = () => {
  const args = process.argv.slice(2);
  const rootIndex = args.indexOf('--root');
  const root = rootIndex >= 0 ? args[rootIndex + 1] : '';
  if (!root) {
    console.error('请指定本机照片根目录: --root "C:\\path\\to\\bird-photos"');
    process.exit(1);
  }
  return { root };
};

const splitCategory = (category) =>
  String(category || '')
    .split(/\s*[>／/]\s*/)
    .map((part) => part.trim())
    .filter(Boolean);

(async () => {
  const { root } = parseArgs();
  const rootPath = path.resolve(root);
  const { getOrderChineseName, getFamilyChineseName } = await import('../data/taxonomyTranslation.js');

  await fsp.mkdir(rootPath, { recursive: true });
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/kbird');

  const birds = await Bird.find({ isTemporary: { $ne: true } })
    .select('name order family category')
    .lean();

  const plans = birds.map((bird) => {
    const cat = splitCategory(bird.category);
    const orderName = sanitize(
      getOrderChineseName(bird.order) || cat[0] || '未分类目',
      '未分类目'
    );
    const familyName = sanitize(
      getFamilyChineseName(bird.family) || cat[1] || '未分类科',
      '未分类科'
    );
    const speciesName = sanitize(bird.name, '未命名');
    return {
      name: bird.name,
      rel: path.join(orderName, familyName, speciesName),
      abs: path.join(rootPath, orderName, familyName, speciesName),
    };
  });

  const byName = new Map(plans.map((item) => [item.name, item]));
  let created = 0;
  for (const item of plans) {
    if (!fs.existsSync(item.abs)) {
      await fsp.mkdir(item.abs, { recursive: true });
      created += 1;
    }
  }

  const rootEntries = await fsp.readdir(rootPath, { withFileTypes: true });
  let moved = 0;
  let skipped = 0;
  const notes = [];

  for (const entry of rootEntries) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
    const target = byName.get(entry.name);
    if (!target) continue;
    const from = path.join(rootPath, entry.name);
    if (path.resolve(from) === path.resolve(target.abs)) continue;
    await fsp.mkdir(target.abs, { recursive: true });
    const files = await fsp.readdir(from, { withFileTypes: true });
    for (const file of files) {
      const src = path.join(from, file.name);
      const dest = path.join(target.abs, file.name);
      if (fs.existsSync(dest)) {
        skipped += 1;
        notes.push(`已存在，未覆盖：${path.join(target.rel, file.name)}`);
        continue;
      }
      await fsp.rename(src, dest);
      moved += 1;
    }
    const left = await fsp.readdir(from);
    if (!left.length) {
      await fsp.rmdir(from);
    } else {
      notes.push(`根目录仍留着 ${entry.name}（里面还有 ${left.length} 项）`);
    }
  }

  const leftover = (await fsp.readdir(rootPath, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory() && byName.has(entry.name))
    .map((entry) => entry.name);

  console.log(
    JSON.stringify(
      {
        root: rootPath,
        species: plans.length,
        foldersCreated: created,
        filesMoved: moved,
        skippedExisting: skipped,
        leftoverSpeciesAtRoot: leftover,
        notes: notes.slice(0, 20),
      },
      null,
      2
    )
  );

  await mongoose.disconnect();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
