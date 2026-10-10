const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');

const DEFAULT_MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
const DEFAULT_MAX_ROWS = 10000;

function normalizeCell(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function assertWorkbookFileSafe(filePath, options = {}) {
  const resolvedPath = path.resolve(filePath);
  const ext = path.extname(resolvedPath).toLowerCase();
  const maxFileSizeBytes = options.maxFileSizeBytes || DEFAULT_MAX_FILE_SIZE_BYTES;

  if (!['.xlsx', '.xlsm'].includes(ext)) {
    throw new Error(`仅支持 .xlsx/.xlsm 文件，当前扩展名: ${ext || '(空)'}`);
  }

  const stats = fs.statSync(resolvedPath);
  if (!stats.isFile()) {
    throw new Error(`不是有效文件: ${resolvedPath}`);
  }
  if (stats.size <= 0) {
    throw new Error(`文件为空: ${resolvedPath}`);
  }
  if (stats.size > maxFileSizeBytes) {
    throw new Error(
      `文件过大(${stats.size} bytes)，超过限制(${maxFileSizeBytes} bytes)。请拆分或确认来源。`
    );
  }
}

async function loadWorksheetRows(filePath, options = {}) {
  const resolvedPath = path.resolve(filePath);
  const maxRows = options.maxRows || DEFAULT_MAX_ROWS;

  assertWorkbookFileSafe(resolvedPath, options);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(resolvedPath);

  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new Error('工作簿中没有可用工作表。');
  }

  const rows = [];
  worksheet.eachRow({ includeEmpty: false }, (row) => {
    rows.push([
      normalizeCell(row.getCell(1).value),
      normalizeCell(row.getCell(2).value),
      normalizeCell(row.getCell(3).value),
      normalizeCell(row.getCell(4).value),
      normalizeCell(row.getCell(5).value),
      normalizeCell(row.getCell(6).value),
      normalizeCell(row.getCell(7).value),
    ]);
  });

  if (rows.length > maxRows) {
    throw new Error(`工作表行数过多(${rows.length})，超过安全阈值(${maxRows})。`);
  }

  return {
    sheetName: worksheet.name,
    rows,
    totalRows: rows.length,
  };
}

module.exports = {
  loadWorksheetRows,
};
