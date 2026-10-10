/**
 * 对照 2023 三有名录与图鉴：精确匹配 / 异名 / 冲突（只读，写出 JSON）。
 */
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const Bird = require('../server/models/birdModel');
const { canonicalizeBirdName, BIRD_NAME_ALIASES } = require('../data/birdNameAliases');
const { listSanyouAvesSpecies } = require('../data/china-sanyou-aves-names');
const { SANYOU_INHERIT_SPLITS, SANYOU_GAZETTE_TO_DB } = require('../data/china-sanyou-aves-inherit-splits');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/kbird';
const OUT = path.resolve(__dirname, '..', 'data', 'china-sanyou-aves-conflicts.json');

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

const SPLIT_HINTS = [
  { dbName: '青藏沙鸻', listedAs: '蒙古沙鸻', reason: '名录未分种；图鉴 Anarhynchus atrifrons' },
  { dbName: '华西白腰雨燕', listedAs: '白腰雨燕', reason: '名录 Apus pacificus；图鉴已拆 A. salimalii' },
  { dbName: '印支白腰雨燕', listedAs: '白腰雨燕', reason: '名录未列；图鉴 A. cooki' },
  { dbName: '青藏喜鹊', listedAs: '喜鹊', reason: '名录 Pica pica；图鉴 P. bottanensis' },
  { dbName: '欧亚喜鹊', listedAs: '喜鹊', reason: '名录学名 Pica pica 对欧亚种；图鉴喜鹊为 P. serica' },
  { dbName: '淡眉雀鹛', listedAs: '灰眶雀鹛', reason: '名录广义 Alcippe morrisonia；图鉴 A. hueti' },
  { dbName: '西域山鹛', listedAs: '山鹛', reason: '图鉴已拆，名录仅山鹛' },
  { dbName: '栗颈凤鹛', listedAs: '栗耳凤鹛', reason: '图鉴中文与名录栗耳凤鹛可能为异名或分种' },
  { dbName: '祁连山蓝尾鸲', listedAs: '红胁蓝尾鸲', reason: '图鉴已拆 Tarsiger albocoeruleus' },
  { dbName: '东亚石䳭', listedAs: '黑喉石䳭', reason: '名录 Saxicola maurus；图鉴 S. stejnegeri' },
  { dbName: '黄冠橙腹叶鹎', listedAs: '橙腹叶鹎', reason: '名录 Chloropsis hardwickii 对黄冠；图鉴橙腹为 C. lazulina' },
  { dbName: '白腹毛脚燕', listedAs: '毛脚燕', reason: '名录毛脚燕 Delichon urbicum；图鉴白腹为 D. lagopodum' },
];

(async () => {
  const listRows = listSanyouAvesSpecies();
  await mongoose.connect(MONGODB_URI);
  const birds = await Bird.find({}).select('name scientificName chinaProtectionLevel').lean();

  const byExactName = new Map();
  const bySci = new Map();
  birds.forEach((bird) => {
    byExactName.set(bird.name, bird);
    const sci = normalizeSci(bird.scientificName);
    if (!sci) return;
    if (!bySci.has(sci)) bySci.set(sci, []);
    bySci.get(sci).push(bird);
  });

  const exact = [];
  const synonymZh = [];
  const synonymSci = [];
  const nameSciClash = [];
  const collapsed = [];
  const missing = [];
  const usedByList = new Map();

  function markUsed(listRow, bird, bucket, extra) {
    const rec = {
      n: listRow.n,
      listName: listRow.name,
      listSci: listRow.scientificName,
      dbName: bird.name,
      dbSci: bird.scientificName,
      chinaProtectionLevel: bird.chinaProtectionLevel,
      ...extra,
    };
    bucket.push(rec);
    const id = String(bird._id);
    if (!usedByList.has(id)) usedByList.set(id, []);
    usedByList.get(id).push(listRow.name);
  }

  listRows.forEach((row) => {
    const listSci = normalizeSci(row.scientificName);
    const mapped = SANYOU_GAZETTE_TO_DB.find((item) => item.listName === row.name);
    if (mapped) {
      const bird = byExactName.get(mapped.dbName);
      if (bird) {
        markUsed(row, bird, synonymZh, {
          note: '名录中文与图鉴现行中文不同，按学名对应',
          alias: mapped.dbName,
        });
        return;
      }
    }
    const exactBird = byExactName.get(row.name);
    const canonical = canonicalizeBirdName(row.name);
    const aliasBird = canonical !== row.name ? byExactName.get(canonical) : null;
    const sciHits = bySci.get(listSci) || [];

    if (exactBird && normalizeSci(exactBird.scientificName) === listSci) {
      markUsed(row, exactBird, exact);
      return;
    }

    if (exactBird && sciHits.some((b) => String(b._id) !== String(exactBird._id))) {
      nameSciClash.push({
        n: row.n,
        listName: row.name,
        listSci: row.scientificName,
        dbByChinese: { name: exactBird.name, sci: exactBird.scientificName, level: exactBird.chinaProtectionLevel },
        dbBySci: sciHits
          .filter((b) => String(b._id) !== String(exactBird._id))
          .map((b) => ({ name: b.name, sci: b.scientificName, level: b.chinaProtectionLevel })),
        note: '中文名对一种、学名对另一种，不合并',
      });
      const id = String(exactBird._id);
      if (!usedByList.has(id)) usedByList.set(id, []);
      usedByList.get(id).push(row.name);
      return;
    }

    if (exactBird) {
      markUsed(row, exactBird, synonymSci, { note: '中文名相同，学名为图鉴现行名或名录旧组合' });
      return;
    }

    if (aliasBird) {
      const otherOnList = listRows.some((r) => r.name === aliasBird.name && r.n !== row.n);
      if (otherOnList) {
        collapsed.push({
          n: row.n,
          listName: row.name,
          listSci: row.scientificName,
          collapsedInto: aliasBird.name,
          dbSci: aliasBird.scientificName,
          note: '名录两名、图鉴一种（别名表把两种并到一起），不合并保护等级口径',
        });
        return;
      }
      markUsed(row, aliasBird, synonymZh, { alias: canonical });
      return;
    }

    if (sciHits.length === 1) {
      const hit = sciHits[0];
      const hitAlsoListed = listRows.some((r) => r.name === hit.name && r.n !== row.n);
      if (hitAlsoListed) {
        collapsed.push({
          n: row.n,
          listName: row.name,
          listSci: row.scientificName,
          collapsedInto: hit.name,
          dbSci: hit.scientificName,
          note: '名录两中文名学名对上图鉴同一种，不合并',
        });
        return;
      }
      markUsed(row, hit, synonymZh, { note: '中文异名，学名一致' });
      return;
    }

    missing.push({ n: row.n, listName: row.name, listSci: row.scientificName });
  });

  const inheritListed = new Set(SANYOU_INHERIT_SPLITS.map((row) => row.listedAs));
  const missingInCatalog = missing.filter((row) => !inheritListed.has(row.listName));

  const inheritSplits = SANYOU_INHERIT_SPLITS.map((hint) => {
    const bird = byExactName.get(hint.dbName);
    if (!bird) return { ...hint, dbSci: null, chinaProtectionLevel: null, missing: true };
    usedByList.set(String(bird._id), [hint.listedAs]);
    return {
      ...hint,
      dbSci: bird.scientificName,
      chinaProtectionLevel: bird.chinaProtectionLevel,
    };
  });

  const taxonSplits = SPLIT_HINTS.map((hint) => {
    const bird = byExactName.get(hint.dbName);
    if (!bird) return null;
    return {
      ...hint,
      dbSci: bird.scientificName,
      chinaProtectionLevel: bird.chinaProtectionLevel,
    };
  }).filter(Boolean);

  const splitNames = new Set(taxonSplits.map((r) => r.dbName));
  const inheritDbNames = new Set(SANYOU_INHERIT_SPLITS.map((r) => r.dbName));
  const extraSanyou = birds
    .filter((b) => (b.chinaProtectionLevel || '') === '三有')
    .filter((b) => !usedByList.has(String(b._id)))
    .filter((b) => !splitNames.has(b.name))
    .filter((b) => !inheritDbNames.has(b.name))
    .map((b) => ({ dbName: b.name, dbSci: b.scientificName }));

  const notOnListCleared = ['小嘴乌鸦', '大嘴乌鸦']
    .map((name) => {
      const bird = byExactName.get(name);
      if (!bird) return null;
      return { dbName: bird.name, dbSci: bird.scientificName, chinaProtectionLevel: bird.chinaProtectionLevel };
    })
    .filter(Boolean);

  const report = {
    source: '国家林业和草原局公告2023年第17号',
    listed: listRows.length,
    policy: {
      exactAndSynonym: '按图鉴种标三有',
      clashAndSplit: '单独列出，不把两种并成一种',
      inheritSplits: '名录广义种、图鉴已拆且确认继承三有',
      nationalProtected: '国一/国二不改为三有',
    },
    counts: {
      exact: exact.length,
      synonymZh: synonymZh.length,
      synonymSci: synonymSci.length,
      nameSciClash: nameSciClash.length,
      collapsedTwoListNames: collapsed.length,
      taxonSplits: taxonSplits.length,
      inheritSplits: inheritSplits.length,
      missingInCatalog: missingInCatalog.length,
      extraSanyouNotOnList: extraSanyou.length,
    },
    synonymZh,
    synonymSci,
    nameSciClash,
    collapsedTwoListNames: collapsed,
    taxonSplits,
    inheritSplits,
    missingInCatalog,
    extraSanyouNotOnList: extraSanyou,
    gazetteOmittedCommonCrows: notOnListCleared,
  };

  fs.writeFileSync(OUT, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report.counts, null, 2));
  if (collapsed.length) console.log('collapsed', collapsed);
  if (nameSciClash.length) console.log('clash', nameSciClash.length);
  await mongoose.disconnect();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
