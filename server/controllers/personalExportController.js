const mongoose = require('mongoose');
const Record = require('../models/recordModel');
const { sendControllerError } = require('../middleware/controllerError');
const { buildCbrcXlsxBuffer } = require('../utils/cbrcExport');
const { toEBirdRecordFormatCSV } = require('../utils/eBirdParser');

const MAX_EXPORT_RECORDS = 5000;

function pad2(n) {
  return String(n).padStart(2, '0');
}

function todayStamp() {
  const d = new Date();
  return `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}`;
}

function parseRecordIds(req) {
  const fromBody = Array.isArray(req.body?.recordIds) ? req.body.recordIds : [];
  const fromQuery = String(req.query?.ids || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const raw = fromBody.length > 0 ? fromBody : fromQuery;
  return [...new Set(raw.map((id) => String(id)).filter((id) => mongoose.Types.ObjectId.isValid(id)))];
}

function parseYear(req) {
  const raw = req.body?.year ?? req.query?.year;
  if (raw == null || raw === '') return null;
  const year = Number(raw);
  if (!Number.isInteger(year) || year < 1900 || year > 2100) return null;
  return year;
}

async function loadExportRecords(userId, { recordIds, year } = {}) {
  const query = {
    observer: userId,
    status: { $ne: 'draft' },
  };

  if (recordIds?.length) {
    query._id = { $in: recordIds };
  }

  if (year) {
    const start = new Date(year, 0, 1, 0, 0, 0, 0);
    const end = new Date(year + 1, 0, 1, 0, 0, 0, 0);
    query.date = { $gte: start, $lt: end };
  }

  const total = await Record.countDocuments(query);
  if (total > MAX_EXPORT_RECORDS) {
    const err = new Error(`导出条数超过上限 ${MAX_EXPORT_RECORDS}，请缩小范围（勾选记录或按年份）`);
    err.statusCode = 400;
    err.code = 'EXPORT_TOO_LARGE';
    throw err;
  }

  return Record.find(query)
    .populate('birds.birdId', 'name scientificName englishName')
    .sort({ date: 1, createdAt: 1 })
    .lean();
}

async function resolveExportRecords(req) {
  const userId = req.user.id || req.user._id;
  const recordIds = parseRecordIds(req);
  const year = parseYear(req);
  const records = await loadExportRecords(userId, { recordIds, year });
  if (!records.length) {
    const err = new Error('没有可导出的观鸟记录');
    err.statusCode = 404;
    err.code = 'EXPORT_EMPTY';
    throw err;
  }
  return records;
}

// @desc    导出中国鸟类记录中心格式 XLSX
// @route   GET|POST /api/personal/export/cbrc
// @access  Private
const exportCbrc = async (req, res) => {
  try {
    const records = await resolveExportRecords(req);
    const buffer = buildCbrcXlsxBuffer(records);
    const filename = `kbird-cbrc-${todayStamp()}.xlsx`;
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('X-Export-Count', String(records.length));
    return res.status(200).send(buffer);
  } catch (error) {
    return sendControllerError(res, error, {
      defaultMessage: '导出中国鸟类记录中心表格失败',
      defaultCode: 'CBRC_EXPORT_FAILED',
    });
  }
};

// @desc    导出 eBird Record Format CSV（可导入 eBird）
// @route   GET|POST /api/personal/export/ebird
// @access  Private
const exportEbird = async (req, res) => {
  try {
    const records = await resolveExportRecords(req);
    const csv = toEBirdRecordFormatCSV(records);
    const filename = `kbird-ebird-${todayStamp()}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('X-Export-Count', String(records.length));
    return res.status(200).send(csv);
  } catch (error) {
    return sendControllerError(res, error, {
      defaultMessage: '导出 eBird CSV 失败',
      defaultCode: 'EBIRD_EXPORT_FAILED',
    });
  }
};

module.exports = {
  exportCbrc,
  exportEbird,
  MAX_EXPORT_RECORDS,
};
