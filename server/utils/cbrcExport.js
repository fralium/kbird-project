const XLSX = require('xlsx');

/** 与 CBRC 导入识别列一致，便于往返 */
const CBRC_HEADERS = [
  '报告编号',
  '观测开始时间',
  '观测结束时间',
  '中文名',
  '拉丁名',
  '省',
  '市',
  '区县',
  '观测点名称',
  '鸟种数量',
];

function pad2(n) {
  return String(n).padStart(2, '0');
}

function formatCbrcDateTime(value) {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

function extractEndRawFromDescription(description = '') {
  const text = String(description || '');
  const match = text.match(/观测结束\s*([^；;]+)/);
  return match ? String(match[1]).trim() : '';
}

/**
 * 将观鸟记录展开为 CBRC「报告」表行（一种一行）
 */
function recordsToCbrcRows(records = []) {
  const rows = [CBRC_HEADERS];

  for (const record of records) {
    const start = formatCbrcDateTime(record.date);
    const end =
      extractEndRawFromDescription(record.description) ||
      formatCbrcDateTime(record.effort?.endTime) ||
      '';
    const reportId = record.cbrcReportId ? String(record.cbrcReportId).trim() : '';
    const province = record.location?.address?.province || '';
    const city = record.location?.address?.city || '';
    const district = record.location?.address?.district || '';
    const point = record.location?.name || '';

    const birds = Array.isArray(record.birds) ? record.birds : [];
    if (birds.length === 0) {
      rows.push([reportId, start, end, '', '', province, city, district, point, '']);
      continue;
    }

    for (const bird of birds) {
      const info = bird?.birdId && typeof bird.birdId === 'object' ? bird.birdId : {};
      const cn = info.name || bird?.name || '';
      const latin = info.scientificName || bird?.scientificName || '';
      const count = Math.max(1, Number(bird?.count) || 1);
      if (!cn && !latin) continue;
      rows.push([
        reportId,
        start,
        end,
        cn,
        latin,
        province,
        city,
        district,
        point,
        count,
      ]);
    }
  }

  return rows;
}

function buildCbrcXlsxBuffer(records = []) {
  const rows = recordsToCbrcRows(records);
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, '报告');
  return XLSX.write(book, { type: 'buffer', bookType: 'xlsx' });
}

module.exports = {
  CBRC_HEADERS,
  recordsToCbrcRows,
  buildCbrcXlsxBuffer,
  formatCbrcDateTime,
};
