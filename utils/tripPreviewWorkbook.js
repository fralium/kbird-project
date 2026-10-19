import * as XLSX from 'xlsx';

const HEADER_ALIASES = {
  code: ['鸟种编号', '物种编号', '编号', 'code', 'id'],
  name: ['中文名', '中文名称', '鸟种名', '物种名', '中文', 'name', 'chinese'],
  scientificName: ['拉丁学名', '学名', '拉丁名', 'scientific', 'latin'],
  englishName: ['英文名称', '英文名', 'english'],
  order: ['目', '目名', 'order'],
  family: ['科', '科名', 'family'],
  recordCount: ['记录次数', '次数', '记录数', '数量', 'count', 'records'],
};

function cellText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function headerKey(label) {
  const raw = cellText(label).toLowerCase();
  if (!raw) return '';
  for (const [key, aliases] of Object.entries(HEADER_ALIASES)) {
    const matched = aliases.some((alias) => {
      const needle = alias.toLowerCase();
      if (needle.length <= 1) return raw === needle;
      return raw === needle || raw.includes(needle);
    });
    if (matched) return key;
  }
  return '';
}

function findHeaderRow(rows) {
  const limit = Math.min(rows.length, 20);
  for (let index = 0; index < limit; index += 1) {
    const mapped = (rows[index] || []).map((cell) => headerKey(cell)).filter(Boolean);
    const hasName = mapped.includes('name') || mapped.includes('scientificName');
    const hasCount = mapped.includes('recordCount');
    if (hasName && (hasCount || mapped.length >= 2)) return index;
  }
  return 0;
}

function parseCount(value) {
  const digits = String(value ?? '').replace(/[^\d.]/g, '');
  const num = Number.parseFloat(digits);
  if (!Number.isFinite(num) || num < 0) return 0;
  return Math.round(num);
}

export async function parseTripPreviewWorkbook(file) {
  const extension = String(file?.name || '').toLowerCase().split('.').pop();
  if (!['xls', 'xlsx', 'xlsm', 'csv'].includes(extension)) {
    throw new Error('请上传 Excel 或 CSV（.xls / .xlsx / .csv）');
  }

  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheetName = workbook.SheetNames?.[0];
  if (!sheetName) throw new Error('文件里没有工作表');

  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
    header: 1,
    defval: '',
    raw: false,
  });
  if (!Array.isArray(rows) || rows.length < 2) {
    throw new Error('内容不足，至少需要表头和一行鸟种');
  }

  const headerIndex = findHeaderRow(rows);
  const headerCells = rows[headerIndex] || [];
  const columnMap = {};
  headerCells.forEach((cell, colIndex) => {
    const key = headerKey(cell);
    if (key && columnMap[key] == null) columnMap[key] = colIndex;
  });

  if (columnMap.name == null && columnMap.scientificName == null) {
    throw new Error('找不到「中文名」或「拉丁学名」列，请确认是中国观鸟记录中心导出的鸟种表');
  }

  const merged = new Map();
  rows.slice(headerIndex + 1).forEach((row) => {
    const cells = Array.isArray(row) ? row : [];
    const name = columnMap.name != null ? cellText(cells[columnMap.name]) : '';
    const scientificName =
      columnMap.scientificName != null ? cellText(cells[columnMap.scientificName]) : '';
    if (!name && !scientificName) return;
    const recordCount = columnMap.recordCount != null ? parseCount(cells[columnMap.recordCount]) : 0;
    const key = `${name}|${scientificName}`.toLowerCase();
    const prev = merged.get(key);
    if (prev) {
      prev.recordCount += recordCount;
      return;
    }
    merged.set(key, {
      code: columnMap.code != null ? cellText(cells[columnMap.code]) : '',
      name,
      scientificName,
      englishName: columnMap.englishName != null ? cellText(cells[columnMap.englishName]) : '',
      order: columnMap.order != null ? cellText(cells[columnMap.order]) : '',
      family: columnMap.family != null ? cellText(cells[columnMap.family]) : '',
      recordCount,
    });
  });

  const species = Array.from(merged.values());
  if (species.length === 0) {
    throw new Error('表头以下没有读到鸟种行');
  }
  if (species.length > 5000) {
    throw new Error('鸟种超过 5000 行，请先在表格里筛近期名录再上传');
  }

  return {
    fileName: file.name,
    species,
  };
}

/** 多表合并：同中文名+学名累加记录次数 */
export function mergeTripPreviewSpecies(parsedList) {
  const merged = new Map();
  (Array.isArray(parsedList) ? parsedList : []).forEach((parsed) => {
    (parsed?.species || []).forEach((item) => {
      const name = String(item?.name || '').trim();
      const scientificName = String(item?.scientificName || '').trim();
      if (!name && !scientificName) return;
      const key = `${name}|${scientificName}`.toLowerCase();
      const prev = merged.get(key);
      const recordCount = Number(item?.recordCount) || 0;
      if (prev) {
        prev.recordCount += recordCount;
        if (!prev.code && item.code) prev.code = item.code;
        if (!prev.englishName && item.englishName) prev.englishName = item.englishName;
        if (!prev.order && item.order) prev.order = item.order;
        if (!prev.family && item.family) prev.family = item.family;
        if (item.outsideLocal) prev.outsideLocal = true;
        return;
      }
      merged.set(key, {
        code: String(item?.code || '').trim(),
        name,
        scientificName,
        englishName: String(item?.englishName || '').trim(),
        order: String(item?.order || '').trim(),
        family: String(item?.family || '').trim(),
        recordCount,
        outsideLocal: Boolean(item?.outsideLocal),
      });
    });
  });
  return Array.from(merged.values());
}

export function formatTripPreviewFileLabel(fileNames = []) {
  const names = (Array.isArray(fileNames) ? fileNames : [])
    .map((name) => String(name || '').trim())
    .filter(Boolean);
  if (!names.length) return '';
  if (names.length === 1) return names[0];
  const head = names.slice(0, 3).join('、');
  return names.length > 3
    ? `${names.length} 个文件：${head} 等`
    : `${names.length} 个文件：${head}`;
}

/** 解析一个或多个导出表，合并鸟种后对照 */
export async function parseTripPreviewWorkbooks(files) {
  const list = Array.from(files || []).filter(Boolean);
  if (!list.length) {
    throw new Error('请选择至少一个 Excel 或 CSV');
  }
  if (list.length > 20) {
    throw new Error('一次最多合并 20 个文件');
  }

  const parsedList = [];
  for (const file of list) {
    parsedList.push(await parseTripPreviewWorkbook(file));
  }

  const species = mergeTripPreviewSpecies(parsedList);
  if (species.length === 0) {
    throw new Error('这些文件里没有读到鸟种行');
  }
  if (species.length > 5000) {
    throw new Error('合并后鸟种超过 5000 行，请先筛近期名录再上传');
  }

  const fileNames = parsedList.map((item) => item.fileName);
  return {
    fileName: formatTripPreviewFileLabel(fileNames),
    fileNames,
    fileCount: fileNames.length,
    species,
  };
}
