/**
 * 观鸟记录中心「鸟种清单」表解析
 * 列：鸟种编号、中文名、拉丁学名/拉丁名、英文名称/英文名、目、科、记录次数/数量
 */

export const CBRC_SPECIES_LIST_MAX_ROWS = 20000;
export const MAX_SPECIES_LIST_UPLOAD_FILES = 20;
export const MAX_SPECIES_LIST_FILE_SIZE = 15 * 1024 * 1024;

export function isCbrcReportExportHeader(headerRow = []) {
  const headers = (headerRow || []).map((c) => String(c || '').trim());
  return (
    headers.some((h) => /报告编号/.test(h)) &&
    headers.some((h) => /观测开始|观察开始/.test(h))
  );
}

export function parseCbrcSpeciesListRows(rows) {
  if (!rows || rows.length === 0) return [];
  const birds = [];
  let dataStart = 0;
  let colId = 0;
  let colCn = 1;
  let colLatin = 2;
  let colEn = 3;
  let colOrder = 4;
  let colFamily = 5;
  let colCount = 6;

  const first = rows[0] || [];
  const hasHeader = first.some((c) => {
    const s = String(c || '').trim();
    return (
      s === '中文名' ||
      s === '鸟种编号' ||
      s === '拉丁名' ||
      s === '拉丁学名' ||
      s.includes('中文名') ||
      s.includes('拉丁')
    );
  });

  if (hasHeader) {
    const header = rows[0].map((c) => String(c || '').trim());
    colId = header.findIndex((h) => /鸟种编号|编号|^id$/i.test(h));
    if (colId < 0) colId = 0;
    colCn = header.findIndex((h) => /中文名|中文/.test(h));
    if (colCn < 0) colCn = 1;
    colLatin = header.findIndex((h) => /拉丁学名|拉丁名|拉丁|学名/.test(h));
    if (colLatin < 0) colLatin = 2;
    colEn = header.findIndex((h) => /英文名称|英文名|英文/.test(h));
    if (colEn < 0) colEn = 3;
    colOrder = header.findIndex((h) => /^目$/.test(h));
    if (colOrder < 0) colOrder = 4;
    colFamily = header.findIndex((h) => /^科$/.test(h));
    if (colFamily < 0) colFamily = 5;
    colCount = header.findIndex((h) => /记录次数|数量/.test(h));
    if (colCount < 0) colCount = 6;
    dataStart = 1;
  }

  for (let i = dataStart; i < rows.length; i += 1) {
    const row = rows[i] || [];
    const name = String(row[colCn] ?? row[1] ?? '').trim();
    const scientificName = String(row[colLatin] ?? row[2] ?? '').trim();
    if (!name && !scientificName) continue;

    const recordCountRaw = row[colCount] ?? row[6];
    const recordCount = Number.parseInt(String(recordCountRaw ?? '').replace(/,/g, ''), 10);

    birds.push({
      code: String(row[colId] ?? row[0] ?? '').trim(),
      name,
      scientificName: scientificName || '',
      englishName: String(row[colEn] ?? row[3] ?? '').trim(),
      order: String(row[colOrder] ?? row[4] ?? '').trim(),
      family: String(row[colFamily] ?? row[5] ?? '').trim(),
      recordCount: Number.isFinite(recordCount) && recordCount >= 0 ? recordCount : 0,
    });
  }

  return birds;
}

function normalizeNameKey(value) {
  const raw = String(value || '')
    .trim()
    .replace(/\s+/g, '');
  // 与 data/birdNameAliases 保持一致的轻量规范化
  const aliases = { 黄斑苇鳽: '黄苇鳽', 黑苇鳽: '黑鳽' };
  return aliases[raw] || raw;
}

function normalizeSciKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function sciBinomialKey(value) {
  const parts = normalizeSciKey(value).split(' ').filter(Boolean);
  if (parts.length >= 2) return `${parts[0]} ${parts[1]}`;
  return parts[0] || '';
}

/**
 * 合并键：编号 > 中文名 > 学名（与地区清单版本 diff 一致）
 */
export function speciesMergeKey(item = {}) {
  const code = String(item.code || '')
    .trim()
    .toLowerCase();
  if (code) return `code:${code}`;
  const name = normalizeNameKey(item.name);
  if (name) return `name:${name}`;
  const bin = sciBinomialKey(item.scientificName);
  if (bin) return `sci:${bin}`;
  const sci = normalizeSciKey(item.scientificName);
  return sci ? `sci:${sci}` : '';
}

function speciesLooseEqual(a, b) {
  const codeA = String(a.code || '')
    .trim()
    .toLowerCase();
  const codeB = String(b.code || '')
    .trim()
    .toLowerCase();
  if (codeA && codeB && codeA === codeB) return true;
  const nameA = normalizeNameKey(a.name);
  const nameB = normalizeNameKey(b.name);
  if (nameA && nameB && nameA === nameB) return true;
  const binA = sciBinomialKey(a.scientificName);
  const binB = sciBinomialKey(b.scientificName);
  if (binA && binB && binA === binB) return true;
  return false;
}

function mergeIntoExisting(existing, item) {
  const nextCount = Number(item.recordCount) || 0;
  existing.recordCount = (Number(existing.recordCount) || 0) + nextCount;
  if (!existing.code && item.code) existing.code = String(item.code).trim();
  if (!existing.name && item.name) existing.name = String(item.name).trim();
  if (!existing.scientificName && item.scientificName) {
    existing.scientificName = String(item.scientificName).trim();
  }
  if (!existing.englishName && item.englishName) {
    existing.englishName = String(item.englishName).trim();
  }
  if (!existing.order && item.order) existing.order = String(item.order).trim();
  if (!existing.family && item.family) existing.family = String(item.family).trim();
}

/**
 * 合并多份鸟种清单：同种 recordCount 相加；编号/学名/中文名可交叉识别。
 * @returns {{ species: object[], mergeHits: number }}
 */
export function mergeSpeciesLists(lists = []) {
  const map = new Map();
  let mergeHits = 0;

  const findKey = (item) => {
    const primary = speciesMergeKey(item);
    if (primary && map.has(primary)) return primary;
    for (const [key, existing] of map.entries()) {
      if (speciesLooseEqual(existing, item)) return key;
    }
    return null;
  };

  (Array.isArray(lists) ? lists : []).forEach((list) => {
    (Array.isArray(list) ? list : []).forEach((item) => {
      const hitKey = findKey(item);
      if (hitKey) {
        mergeHits += 1;
        mergeIntoExisting(map.get(hitKey), item);
        const better = speciesMergeKey({ ...map.get(hitKey), ...item, recordCount: 0 });
        if (better && better !== hitKey && !map.has(better)) {
          const row = map.get(hitKey);
          map.delete(hitKey);
          map.set(better, row);
        }
        return;
      }
      const key = speciesMergeKey(item);
      if (!key) return;
      map.set(key, {
        code: String(item.code || '').trim(),
        name: String(item.name || '').trim(),
        scientificName: String(item.scientificName || '').trim(),
        englishName: String(item.englishName || '').trim(),
        order: String(item.order || '').trim(),
        family: String(item.family || '').trim(),
        recordCount: Number(item.recordCount) || 0,
      });
    });
  });

  // 二次折叠：消除「先 name 后 code」留下的孤儿重复行
  const keys = Array.from(map.keys());
  for (let i = 0; i < keys.length; i += 1) {
    const k1 = keys[i];
    if (!map.has(k1)) continue;
    for (let j = i + 1; j < keys.length; j += 1) {
      const k2 = keys[j];
      if (!map.has(k2)) continue;
      const a = map.get(k1);
      const b = map.get(k2);
      if (!speciesLooseEqual(a, b)) continue;
      mergeHits += 1;
      a.recordCount = (Number(a.recordCount) || 0) + (Number(b.recordCount) || 0);
      if (!a.code && b.code) a.code = b.code;
      if (!a.name && b.name) a.name = b.name;
      if (!a.scientificName && b.scientificName) a.scientificName = b.scientificName;
      if (!a.englishName && b.englishName) a.englishName = b.englishName;
      if (!a.order && b.order) a.order = b.order;
      if (!a.family && b.family) a.family = b.family;
      map.delete(k2);
    }
  }

  return { species: Array.from(map.values()), mergeHits };
}

/**
 * 用 SheetJS 读取 .xls / .xlsx / .xlsm 为二维数组
 */
export async function readSpreadsheetRows(file) {
  const XLSX = await import('xlsx');
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error('工作簿中没有可用工作表');
  }
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: '',
    raw: false,
  });
  return (rows || []).map((row) =>
    (Array.isArray(row) ? row : []).map((cell) => String(cell ?? '').trim())
  );
}

/** 解析单个清单文件 → { filename, species } */
export async function parseSpeciesListFile(file) {
  if (!file) throw new Error('未选择文件');
  if (file.size > MAX_SPECIES_LIST_FILE_SIZE) {
    throw new Error(`${file.name} 过大，最大 15MB`);
  }
  const lower = String(file.name || '').toLowerCase();
  if (!/\.(xls|xlsx|xlsm|csv)$/.test(lower)) {
    throw new Error(`${file.name} 格式不支持，请上传 .xls / .xlsx / .csv`);
  }

  let rows;
  if (lower.endsWith('.csv')) {
    const text = await file.text();
    const Papa = (await import('papaparse')).default;
    const parsed = Papa.parse(text, { header: false, skipEmptyLines: true });
    rows = (parsed.data || []).map((row) =>
      (Array.isArray(row) ? row : []).map((cell) => String(cell ?? '').trim())
    );
  } else {
    rows = await readSpreadsheetRows(file);
  }

  if (isCbrcReportExportHeader(rows[0] || [])) {
    throw new Error(`${file.name} 是「报告」导出表，请上传「鸟种清单」表`);
  }
  if (rows.length > CBRC_SPECIES_LIST_MAX_ROWS + 1) {
    throw new Error(`${file.name} 行数过多，最多 ${CBRC_SPECIES_LIST_MAX_ROWS} 种`);
  }
  const species = parseCbrcSpeciesListRows(rows);
  if (!species.length) {
    throw new Error(`${file.name} 未解析到鸟种，请确认表头与列顺序`);
  }
  return { filename: file.name, species };
}
