/**
 * 按国家「三有」鸟纲名录（2023年第17号，1028种）更新 chinaProtectionLevel。
 * 国一、国二不降级。名单外现有「三有」改回「未列入」。
 *
 *   node scripts/apply-sanyou-aves.js
 *   node scripts/apply-sanyou-aves.js --apply
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const Bird = require('../server/models/birdModel');
const { canonicalizeBirdName } = require('../data/birdNameAliases');
const { listSanyouAvesSpecies } = require('../data/china-sanyou-aves-names');
const { SANYOU_INHERIT_SPLITS, SANYOU_GAZETTE_TO_DB } = require('../data/china-sanyou-aves-inherit-splits');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/kbird';
const apply = process.argv.includes('--apply');

const RANK = {
  国家一级: 0,
  国家二级: 1,
  三有: 2,
  省级保护: 3,
  未列入: 4,
};

/** 分类拆分种单独列出，不并入名录种三有 */

function normalizeSci(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/af inis/g, 'affinis')
    .replace(/af ine/g, 'affine')
    .trim();
}

function normalizeName(value) {
  return String(value || '')
    .replace(/\s+/g, '')
    .replace(/[，,]/g, '')
    .trim();
}

function nameVariants(raw) {
  const base = canonicalizeBirdName(normalizeName(raw));
  const out = new Set();
  if (!base) return out;
  const push = (value) => {
    const n = canonicalizeBirdName(normalizeName(value));
    if (n) out.add(n);
  };
  push(base);
  push(base.replace(/鸊鷉/g, '䴙䴘'));
  push(base.replace(/䴙䴘/g, '鸊鷉'));
  if (base.endsWith('鸟') && base.length > 2) push(base.slice(0, -1));
  if (base.endsWith('啄木鸟') && !base.includes('绿') && !base.includes('拟')) {
    push(base.replace('啄木鸟', '绿啄木鸟'));
  }
  return out;
}

function pickBird(hits, listName) {
  const want = canonicalizeBirdName(normalizeName(listName));
  const exact = hits.filter((bird) => bird.name === listName || bird.name === want);
  if (exact.length === 1) return exact[0];
  if (hits.length === 1) return hits[0];
  return null;
}

(async () => {
  const listRows = listSanyouAvesSpecies();
  await mongoose.connect(MONGODB_URI);
  const birds = await Bird.find({}).select('_id name scientificName chinaProtectionLevel').lean();

  const bySci = new Map();
  const byName = new Map();
  birds.forEach((bird) => {
    const sci = normalizeSci(bird.scientificName);
    if (sci) {
      if (!bySci.has(sci)) bySci.set(sci, []);
      bySci.get(sci).push(bird);
    }
    nameVariants(bird.name).forEach((key) => {
      if (!byName.has(key)) byName.set(key, []);
      byName.get(key).push(bird);
    });
  });

  const listNameSet = new Set(listRows.map((row) => row.name));
  const inheritNames = new Set(SANYOU_INHERIT_SPLITS.map((row) => row.listedAs));
  const gazetteToDb = new Map(SANYOU_GAZETTE_TO_DB.map((row) => [row.listName, row]));
  const matchedIds = new Set();
  const matched = [];
  const unmatched = [];
  const duplicateHits = [];

  function collectNameHits(listName) {
    const canonical = canonicalizeBirdName(normalizeName(listName));
    const bothOnList = canonical !== listName && listNameSet.has(listName) && listNameSet.has(canonical);
    const keys = bothOnList ? [normalizeName(listName)] : [...nameVariants(listName)];
    const hits = [];
    const seen = new Set();
    keys.forEach((key) => {
      (byName.get(key) || []).forEach((bird) => {
        const id = String(bird._id);
        if (seen.has(id)) return;
        seen.add(id);
        hits.push(bird);
      });
    });
    return hits;
  }

  function remember(picked, listName, scientificName) {
    const id = String(picked._id);
    if (matchedIds.has(id)) return;
    matchedIds.add(id);
    matched.push({
      listName,
      dbName: picked.name,
      scientificName,
      level: picked.chinaProtectionLevel || '未列入',
      id: picked._id,
    });
  }

  listRows.forEach((row) => {
    const listName = row.name;
    const mapped = gazetteToDb.get(listName);
    if (mapped) {
      const bird = birds.find((b) => b.name === mapped.dbName);
      if (bird) {
        remember(bird, listName, mapped.listSci);
        return;
      }
    }
    const nameHits = collectNameHits(listName);
    let picked = pickBird(nameHits, listName);
    if (!picked && nameHits.length > 1) {
      duplicateHits.push({ listName, dbNames: nameHits.map((b) => b.name) });
      return;
    }
    if (!picked) {
      const sciHits = bySci.get(normalizeSci(row.scientificName)) || [];
      const uniqueSci = sciHits.length === 1 ? sciHits[0] : null;
      if (uniqueSci && !listNameSet.has(uniqueSci.name) && uniqueSci.name !== listName) {
        picked = uniqueSci;
      } else if (uniqueSci && uniqueSci.name === listName) {
        picked = uniqueSci;
      }
    }
    if (picked) {
      remember(picked, listName, row.scientificName);
    } else if (!inheritNames.has(listName)) {
      unmatched.push(`${listName} (${row.scientificName})`);
    }
  });

  SANYOU_INHERIT_SPLITS.forEach((row) => {
    const bird = birds.find((b) => b.name === row.dbName);
    if (!bird) return;
    remember(bird, row.listedAs, row.listSci);
  });

  const toSet = [];
  const keepHigher = [];
  const already = [];
  const seenSetId = new Set();
  matched.forEach((row) => {
    const rank = RANK[row.level] ?? RANK.未列入;
    if (rank <= RANK.国家二级) keepHigher.push(row);
    else if (row.level === '三有') already.push(row);
    else if (!seenSetId.has(String(row.id))) {
      seenSetId.add(String(row.id));
      toSet.push(row);
    }
  });

  const toClear = birds.filter((bird) => {
    const id = String(bird._id);
    const level = bird.chinaProtectionLevel || '未列入';
    return level === '三有' && !matchedIds.has(id);
  });

  const summary = {
    listed: listRows.length,
    matchedUniqueBirds: matchedIds.size,
    unmatched: unmatched.length,
    duplicateHits: duplicateHits.length,
    toSetSanyou: toSet.length,
    alreadySanyou: already.length,
    keepNational: keepHigher.length,
    clearStaleSanyou: toClear.length,
    apply,
  };

  console.log(JSON.stringify(summary, null, 2));
  if (unmatched.length) {
    console.log('\n未匹配:');
    unmatched.forEach((name) => console.log(`  - ${name}`));
  }
  if (duplicateHits.length) {
    console.log('\n一名对多种:');
    duplicateHits.forEach((row) => console.log(`  - ${row.listName} → ${row.dbNames.join(' / ')}`));
  }
  if (keepHigher.length) {
    console.log('\n已是国一/国二，不改为三有:');
    keepHigher.forEach((row) => console.log(`  - ${row.dbName}（${row.level}）名单：${row.listName}`));
  }
  if (toClear.length && toClear.length <= 40) {
    console.log('\n将清除的名单外三有:');
    toClear.forEach((bird) => console.log(`  - ${bird.name}`));
  }

  if (!apply) {
    console.log('\n干跑完成。确认后加 --apply 写入。');
    await mongoose.disconnect();
    return;
  }

  const setResult = toSet.length
    ? await Bird.updateMany({ _id: { $in: toSet.map((row) => row.id) } }, { $set: { chinaProtectionLevel: '三有' } })
    : { modifiedCount: 0 };
  const clearResult = toClear.length
    ? await Bird.updateMany(
        { _id: { $in: toClear.map((b) => b._id) } },
        { $set: { chinaProtectionLevel: '未列入' } }
      )
    : { modifiedCount: 0 };

  console.log(
    JSON.stringify(
      { applied: true, setModified: setResult.modifiedCount, clearModified: clearResult.modifiedCount },
      null,
      2
    )
  );
  await mongoose.disconnect();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
