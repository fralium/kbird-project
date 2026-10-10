#!/usr/bin/env node
/**
 * 基于中国鸟类名录 xlsx 同步 Bird 数据。
 * 默认从仓库外 KBird-LocalArchive/docs-data 读取（名录不进 Git）。
 *
 * 用法：
 *   node scripts/sync-birds-from-cnbirdlist-2024.js
 *   node scripts/sync-birds-from-cnbirdlist-2024.js --apply
 *   node scripts/sync-birds-from-cnbirdlist-2024.js --apply --userId <mongoUserId>
 *   node scripts/sync-birds-from-cnbirdlist-2024.js --file path/to/CNBirdList2024.xlsx
 *
 * 默认 dry-run，仅输出将要变更的统计，不写数据库。
 */
const path = require('path');
const mongoose = require('mongoose');
const { pinyin } = require('pinyin-pro');
const { loadWorksheetRows } = require('./readSpeciesWorkbook');

require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const Bird = require('../server/models/birdModel');
const User = require('../server/models/userModel');

const DEFAULT_FILE = path.resolve(
  __dirname,
  '..',
  '..',
  'KBird-LocalArchive',
  'docs-data',
  'CNBirdList2024.xlsx'
);
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

function toTaxonCase(value) {
  const raw = normalize(value);
  if (!raw) return '';
  const lower = raw.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

function mapIucnLevel(raw) {
  const code = normalize(raw).toUpperCase();
  const mapping = {
    LC: '无危(LC)',
    NT: '近危(NT)',
    VU: '易危(VU)',
    EN: '濒危(EN)',
    CR: '极危(CR)',
    EW: '野外灭绝(EW)',
    EX: '灭绝(EX)',
    DD: '数据缺乏(DD)',
    NE: '未评估(NE)',
  };
  return mapping[code] || '未评估(NE)';
}

function mapChinaProtection(raw) {
  const value = normalize(raw);
  if (!value || value === '-') return '未列入';
  if (value.includes('一级')) return '国家一级';
  if (value.includes('二级')) return '国家二级';
  if (value.includes('三有')) return '三有';
  if (value.includes('省')) return '省级保护';
  if (value.includes('未列入')) return '未列入';
  return '未列入';
}

function parseFamilyLatin(rawEnglish) {
  const english = normalize(rawEnglish);
  if (!english) return '';
  const first = english.split(/\s+/)[0];
  return normalize(first.replace(/[()]/g, ''));
}

function parseGenusSpecies(scientificName) {
  const tokens = normalize(scientificName).split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return { genus: '', species: '' };
  if (tokens.length === 1) return { genus: tokens[0], species: '' };
  return { genus: tokens[0], species: tokens.slice(1).join(' ') };
}

function buildPinyinFields(chineseName, scientificName) {
  const namePinyin = pinyin(normalize(chineseName), { toneType: 'none', type: 'string' });
  const scientificPinyin = normalize(scientificName).toLowerCase();
  const namePinyinNoSpace = namePinyin.replace(/\s+/g, ' ').trim();
  const namePinyinInitials = namePinyinNoSpace
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0))
    .join('');
  const scientificInitials = scientificPinyin
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0))
    .join('');

  return {
    namePinyin: namePinyinNoSpace,
    scientificNamePinyin: scientificPinyin,
    namePinyinInitials,
    scientificNamePinyinInitials: scientificInitials,
  };
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const apply = args.includes('--apply');
  const fileIdx = args.indexOf('--file');
  const userIdx = args.indexOf('--userId');
  const filePath = fileIdx >= 0 ? args[fileIdx + 1] : DEFAULT_FILE;
  const userId = userIdx >= 0 ? args[userIdx + 1] : '';
  return {
    apply,
    filePath: path.resolve(process.cwd(), filePath),
    userId: normalize(userId),
  };
}

async function parseWorkbook(filePath) {
  const { sheetName, rows, totalRows } = await loadWorksheetRows(filePath, {
    maxFileSizeBytes: 5 * 1024 * 1024,
    maxRows: 10000,
  });

  const speciesRows = [];
  let currentOrder = '';
  let currentFamilyLatin = '';
  let currentFamilyChinese = '';

  for (let i = 1; i < rows.length; i += 1) {
    const row = rows[i] || [];
    const code = normalize(row[0]);
    const scientific = normalize(row[1]);
    const chinese = normalize(row[2]);
    const english = normalize(row[3]);
    const iucnRaw = normalize(row[4]);
    const chinaRaw = normalize(row[5]);
    const note = normalize(row[6]);

    if (!code) continue;

    // 科行（通常为 1-3 位），更新当前分类上下文
    if (/^\d{1,3}$/.test(code) && chinese.endsWith('科')) {
      currentOrder = toTaxonCase(scientific);
      currentFamilyLatin = parseFamilyLatin(english);
      currentFamilyChinese = chinese;
      continue;
    }

    // 物种行（4 位编号）
    if (!/^\d{4}$/.test(code)) continue;
    if (!scientific || !chinese) continue;

    speciesRows.push({
      code,
      scientificName: scientific,
      name: chinese,
      englishName: english,
      iucnRaw,
      chinaRaw,
      note,
      order: currentOrder,
      family: currentFamilyLatin,
      familyChinese: currentFamilyChinese,
    });
  }

  return { sheetName, speciesRows, totalRows };
}

async function resolveImporterUser(explicitUserId) {
  if (explicitUserId) {
    const explicit = await User.findById(explicitUserId).select('_id role name').lean();
    if (!explicit) {
      throw new Error(`指定 userId 不存在: ${explicitUserId}`);
    }
    return explicit._id;
  }

  const admin = await User.findOne({ role: 'admin' }).select('_id').lean();
  if (admin?._id) return admin._id;

  const anyUser = await User.findOne({}).select('_id').lean();
  if (anyUser?._id) return anyUser._id;

  throw new Error('数据库中不存在任何用户，无法给新增鸟种设置 createdBy。');
}

async function main() {
  const { apply, filePath, userId } = parseArgs(process.argv);
  console.log(`模式: ${apply ? 'APPLY(写入)' : 'DRY-RUN(预览)'}`);
  console.log(`数据文件: ${filePath}`);

  const { sheetName, speciesRows, totalRows } = await parseWorkbook(filePath);
  console.log(`工作表: ${sheetName}`);
  console.log(`总行数: ${totalRows}，解析到物种行: ${speciesRows.length}`);

  if (speciesRows.length !== 1516) {
    console.warn(`警告: 当前解析到 ${speciesRows.length} 个物种，预期 1516，请确认表格格式。`);
  }

  await mongoose.connect(MONGODB_URI);
  console.log('MongoDB 连接成功');

  const importerUserId = await resolveImporterUser(userId);
  const existingBirds = await Bird.find({})
    .select(
      '_id name scientificName taxonomyCode createdBy description habitat distribution references'
    )
    .lean();

  const byCode = new Map();
  const byScientific = new Map();
  const byName = new Map();
  for (const bird of existingBirds) {
    const codeKey = normalize(bird.taxonomyCode);
    const sciKey = normalize(bird.scientificName).toLowerCase();
    const nameKey = normalize(bird.name);

    if (codeKey) {
      if (!byCode.has(codeKey)) byCode.set(codeKey, []);
      byCode.get(codeKey).push(bird);
    }
    if (sciKey) {
      if (!byScientific.has(sciKey)) byScientific.set(sciKey, []);
      byScientific.get(sciKey).push(bird);
    }
    if (nameKey) {
      if (!byName.has(nameKey)) byName.set(nameKey, []);
      byName.get(nameKey).push(bird);
    }
  }

  const incomingScientificSet = new Set();
  const bulkOps = [];
  const consumedIds = new Set();
  let matchedByScientific = 0;
  let matchedByCode = 0;
  let matchedByName = 0;
  let toInsert = 0;
  const toInsertPreview = [];

  for (const row of speciesRows) {
    const scientificKey = normalize(row.scientificName).toLowerCase();
    incomingScientificSet.add(scientificKey);

    const pickUnused = (arr = []) =>
      arr.find((item) => item?._id && !consumedIds.has(String(item._id)));

    let existing = pickUnused(byCode.get(row.code));
    if (existing) matchedByCode += 1;

    if (!existing) {
      existing = pickUnused(byScientific.get(scientificKey));
      if (existing) matchedByScientific += 1;
    }

    if (!existing) {
      const nameCandidates = (byName.get(row.name) || []).filter(
        (item) => item?._id && !consumedIds.has(String(item._id))
      );
      if (nameCandidates.length === 1) {
        existing = nameCandidates[0];
        matchedByName += 1;
      }
    }

    const { genus, species } = parseGenusSpecies(row.scientificName);
    const pinyinFields = buildPinyinFields(row.name, row.scientificName);
    const iucn = mapIucnLevel(row.iucnRaw);
    const chinaLevel = mapChinaProtection(row.chinaRaw);
    const references = row.note
      ? `CNBirdList2024(${row.code}): ${row.note}`
      : `CNBirdList2024(${row.code})`;
    const orderChinese = ORDER_ZH_MAP[row.order] || row.order || '';
    const familyDisplay = row.familyChinese || row.family || '';
    const normalizedCategory = [orderChinese, familyDisplay].filter(Boolean).join(' > ');

    const commonPayload = {
      name: row.name,
      scientificName: row.scientificName,
      englishName: row.englishName,
      taxonomyCode: row.code,
      iucnProtectionLevel: iucn,
      chinaProtectionLevel: chinaLevel,
      conservationStatus: iucn,
      order: row.order,
      family: row.family,
      category: normalizedCategory || '其他',
      genus,
      species,
      references,
      ...pinyinFields,
    };

    if (existing) {
      consumedIds.add(String(existing._id));
      bulkOps.push({
        updateOne: {
          filter: { _id: existing._id },
          update: {
            $set: commonPayload,
            $setOnInsert: {
              createdBy: existing.createdBy || importerUserId,
            },
          },
        },
      });
    } else {
      toInsert += 1;
      toInsertPreview.push(`${row.code} | ${row.scientificName} | ${row.name}`);
      bulkOps.push({
        insertOne: {
          document: {
            ...commonPayload,
            description: '基于《中国鸟类名录2024》导入，描述待补充。',
            habitat: '待补充',
            distribution: '待补充',
            createdBy: importerUserId,
          },
        },
      });
    }
  }

  const missingFromIncoming = existingBirds.filter(
    (bird) => !incomingScientificSet.has(normalize(bird.scientificName).toLowerCase())
  );

  console.log('\n=== 预览统计 ===');
  console.log(`数据库现有鸟种: ${existingBirds.length}`);
  console.log(`Excel 物种总数: ${speciesRows.length}`);
  console.log(`按编号匹配更新: ${matchedByCode}`);
  console.log(`按学名匹配更新: ${matchedByScientific}`);
  console.log(`按中文名匹配更新: ${matchedByName}`);
  console.log(`将新增: ${toInsert}`);
  if (toInsertPreview.length > 0) {
    console.log('待新增(前10):');
    toInsertPreview.slice(0, 10).forEach((line) => console.log(`- ${line}`));
  }
  console.log(`数据库中疑似不在新名录中的物种: ${missingFromIncoming.length}`);

  if (missingFromIncoming.length > 0) {
    const preview = missingFromIncoming
      .slice(0, 10)
      .map((bird) => `${bird.scientificName} / ${bird.name}`);
    console.log('示例(前10):');
    preview.forEach((line) => console.log(`- ${line}`));
  }

  if (!apply) {
    console.log('\nDRY-RUN 完成，未写入数据库。');
    console.log('执行以下命令正式写入：');
    console.log('node scripts/sync-birds-from-cnbirdlist-2024.js --apply');
    await mongoose.disconnect();
    return;
  }

  if (bulkOps.length === 0) {
    console.log('\n无可执行变更。');
    await mongoose.disconnect();
    return;
  }

  const result = await Bird.bulkWrite(bulkOps, { ordered: false });
  console.log('\n=== 写入结果 ===');
  console.log(JSON.stringify(result, null, 2));

  await mongoose.disconnect();
  console.log('\n完成。');
}

main().catch(async (error) => {
  console.error('\n同步失败:', error.message);
  try {
    await mongoose.disconnect();
  } catch (e) {
    // ignore
  }
  process.exit(1);
});
