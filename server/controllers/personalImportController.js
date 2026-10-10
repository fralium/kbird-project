const Papa = require('papaparse');
const Record = require('../models/recordModel');
const Bird = require('../models/birdModel');
const {
  canonicalizeBirdName,
  aliasKeysForCanonical,
} = require('../../data/birdNameAliases');
const {
  stripLocationRegionPrefix,
  normalizeLocationName,
  findActiveLocationByFlexibleName,
} = require('../utils/locationName');
const { extractValidLngLat } = require('../utils/dateCoords');
const Location = require('../models/locationModel');

const DEFAULT_COORDINATES = [0, 0];
const MAX_IMPORT_ROWS = 1000;

/** 导入时尽量从地点名录补全坐标与正式名；hasValidCoords=false 时坐标为占位 [0,0] */
async function enrichLocationPayload(name, address = {}) {
  const locName = normalizeLocationName(name);
  const baseAddress = {
    province: address.province || '',
    city: address.city || '',
    district: address.district || '',
    detail: address.detail || address.street || '',
  };
  const fallback = {
    name: locName,
    coordinates: { type: 'Point', coordinates: [...DEFAULT_COORDINATES] },
    address: baseAddress,
    hasValidCoords: false,
  };
  if (!locName) return fallback;
  try {
    const doc = await findActiveLocationByFlexibleName(Location, locName);
    if (!doc) return fallback;
    const coords = extractValidLngLat(doc);
    if (!coords) return { ...fallback, name: doc.name || locName };
    return {
      name: doc.name || locName,
      coordinates: {
        type: 'Point',
        coordinates: coords,
      },
      address: {
        province: doc.address?.province || baseAddress.province,
        city: doc.address?.city || baseAddress.city,
        district: doc.address?.district || baseAddress.district,
        detail: doc.address?.street || baseAddress.detail,
      },
      hasValidCoords: true,
    };
  } catch {
    return fallback;
  }
}

/** overwrite 时禁止用 [0,0] 覆盖已有有效坐标 */
function stripImportMeta(location = {}) {
  const { hasValidCoords, ...rest } = location;
  return rest;
}

async function preserveExistingCoordsIfNeeded(recordId, location) {
  const next = stripImportMeta(location);
  if (extractValidLngLat(next)) return next;
  try {
    const existing = await Record.findById(recordId).select('location').lean();
    const prevCoords = extractValidLngLat(existing?.location);
    if (prevCoords) {
      return {
        ...next,
        name: next.name || existing.location?.name || '',
        coordinates: { type: 'Point', coordinates: prevCoords },
        address: {
          province: next.address?.province || existing.location?.address?.province || '',
          city: next.address?.city || existing.location?.address?.city || '',
          district: next.address?.district || existing.location?.address?.district || '',
          detail:
            next.address?.detail ||
            next.address?.street ||
            existing.location?.address?.detail ||
            existing.location?.address?.street ||
            '',
        },
      };
    }
  } catch {
    // keep next as-is
  }
  return next;
}

const normalizeText = (value) => String(value || '').trim();
const normalizeKey = (value) => normalizeText(value).toLowerCase();

const parseBirdsFromText = (birdsText = '') => {
  const raw = normalizeText(birdsText);
  if (!raw) return [];

  return raw
    .split(/[;,，；]/)
    .map((segment) => normalizeText(segment))
    .filter(Boolean)
    .map((segment) => {
      const match = segment.match(/^(.*?)(?:[:：xX*]\s*(\d+))?$/);
      if (!match) {
        return { name: segment, count: 1 };
      }
      const name = normalizeText(match[1]);
      const count = Math.max(1, Number(match[2] || 1));
      return { name, count };
    })
    .filter((item) => !!item.name);
};

const parseRawRows = ({ format, content, records }) => {
  if (Array.isArray(records)) return records;

  if (!content || typeof content !== 'string') {
    throw new Error('请提供导入内容（content）或 records 数组');
  }

  if (format === 'json') {
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed)) return parsed;
    if (Array.isArray(parsed.records)) return parsed.records;
    throw new Error('JSON 格式错误：应为数组或包含 records 数组');
  }

  if (format === 'csv') {
    const csv = Papa.parse(content, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => normalizeText(header),
    });
    if (csv.errors && csv.errors.length > 0) {
      throw new Error(`CSV 解析失败：${csv.errors[0].message}`);
    }
    return csv.data;
  }

  throw new Error('仅支持 json 或 csv 格式');
};

const normalizeRow = (row, index) => {
  const rawDate = row.date || row.observedAt || row.observationDate;
  const parsedDate = rawDate ? new Date(rawDate) : null;
  const date = parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate : null;

  const locationName = normalizeText(
    row.locationName || row.location || row.location_name || row.place
  );

  let birds = [];
  if (Array.isArray(row.birds)) {
    birds = row.birds
      .map((item) => ({
        name: normalizeText(item.name || item.birdName || item.scientificName || item.bird),
        count: Math.max(1, Number(item.count || 1)),
      }))
      .filter((item) => !!item.name);
  } else if (typeof row.birds === 'string') {
    birds = parseBirdsFromText(row.birds);
  } else if (row.birdName || row.bird || row.name) {
    const name = normalizeText(row.birdName || row.bird || row.name);
    if (name) {
      birds = [{ name, count: Math.max(1, Number(row.count || 1)) }];
    }
  }

  const notes = normalizeText(row.notes || row.remark || row.description);
  const title = normalizeText(row.title) || (locationName ? `${locationName}观鸟记录` : '');
  const weather = normalizeText(row.weather);
  const temperature = row.temperature === '' || row.temperature == null ? null : Number(row.temperature);
  const humidity = row.humidity === '' || row.humidity == null ? null : Number(row.humidity);
  const wind = normalizeText(row.wind);

  const issues = [];
  if (!date) issues.push('日期无效');
  if (!locationName) issues.push('地点为空');
  if (birds.length === 0) issues.push('鸟类为空');

  return {
    rowIndex: index + 1,
    valid: issues.length === 0,
    issues,
    data: {
      title,
      date,
      location: {
        name: locationName,
        coordinates: {
          type: 'Point',
          coordinates: DEFAULT_COORDINATES,
        },
      },
      birds,
      notes,
      weather,
      temperature: Number.isFinite(temperature) ? temperature : null,
      humidity: Number.isFinite(humidity) ? humidity : null,
      wind,
      status: 'published',
    },
  };
};

const buildBirdLookup = async () => {
  const birds = await Bird.find({}).select('_id name scientificName nameAliases').lean();
  const byName = new Map();
  birds.forEach((bird) => {
    const keys = [bird.name, bird.scientificName, ...(bird.nameAliases || []), ...aliasKeysForCanonical(bird.name)]
      .map((value) => normalizeKey(value))
      .filter(Boolean);
    keys.forEach((key) => {
      if (!byName.has(key)) {
        byName.set(key, bird);
      }
    });
  });
  return byName;
};

const resolveBirds = (birds, birdLookup) => {
  const unresolved = [];
  const resolved = birds
    .map((item) => {
      const rawName = item.name;
      const key = normalizeKey(rawName);
      const canonicalKey = normalizeKey(canonicalizeBirdName(rawName));
      const bird = birdLookup.get(key) || birdLookup.get(canonicalKey);
      if (!bird) {
        unresolved.push(item.name);
        return null;
      }
      return {
        birdId: bird._id,
        count: Math.max(1, Number(item.count || 1)),
        notes: '',
      };
    })
    .filter(Boolean);

  return { resolved, unresolved };
};

const findPotentialConflict = async (userId, date, locationName) => {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  return Record.findOne({
    observer: userId,
    status: { $ne: 'draft' },
    date: { $gte: start, $lt: end },
    'location.name': new RegExp(`^${locationName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
  })
    .select('_id title date location.name')
    .lean();
};

const buildRecordPayload = (userId, rowData, resolvedBirds) => ({
  title: rowData.title || `${rowData.location.name}观鸟记录`,
  description: '',
  location: rowData.location,
  date: rowData.date,
  observer: userId,
  birds: resolvedBirds,
  notes: rowData.notes || '',
  weather: rowData.weather || '',
  temperature: rowData.temperature,
  humidity: rowData.humidity,
  wind: rowData.wind || '',
  status: 'published',
});

const mergeBirds = (existingBirds = [], incomingBirds = []) => {
  const map = new Map();
  existingBirds.forEach((item) => {
    if (!item?.birdId) return;
    map.set(item.birdId.toString(), {
      birdId: item.birdId,
      count: Math.max(1, Number(item.count || 1)),
      notes: item.notes || '',
      images: item.images || [],
    });
  });

  incomingBirds.forEach((item) => {
    if (!item?.birdId) return;
    const key = item.birdId.toString();
    if (map.has(key)) {
      const existing = map.get(key);
      existing.count = existing.count + Math.max(1, Number(item.count || 1));
      map.set(key, existing);
      return;
    }
    map.set(key, {
      birdId: item.birdId,
      count: Math.max(1, Number(item.count || 1)),
      notes: item.notes || '',
      images: [],
    });
  });

  return Array.from(map.values());
};

// @desc    导入预览（解析+校验+潜在冲突检测）
// @route   POST /api/personal/import/preview
// @access  Private
const previewImport = async (req, res) => {
  try {
    const { format = 'json', content, records } = req.body || {};
    const rawRows = parseRawRows({ format, content, records }).slice(0, MAX_IMPORT_ROWS);
    const normalizedRows = rawRows.map((row, index) => normalizeRow(row, index));
    const birdLookup = await buildBirdLookup();

    const rows = await Promise.all(
      normalizedRows.map(async (item) => {
        if (!item.valid) {
          return {
            rowIndex: item.rowIndex,
            status: 'invalid',
            issues: item.issues,
            unresolvedBirds: [],
            potentialConflict: null,
            preview: null,
          };
        }

        const { resolved, unresolved } = resolveBirds(item.data.birds, birdLookup);
        const potentialConflict = await findPotentialConflict(
          req.user.id,
          item.data.date,
          item.data.location.name
        );

        return {
          rowIndex: item.rowIndex,
          status: unresolved.length > 0 ? 'warning' : 'ready',
          issues: unresolved.length > 0 ? ['部分鸟类未匹配'] : [],
          unresolvedBirds: unresolved,
          potentialConflict: potentialConflict
            ? {
                recordId: potentialConflict._id,
                title: potentialConflict.title,
                locationName: potentialConflict.location?.name,
                date: potentialConflict.date,
              }
            : null,
          preview: {
            date: item.data.date,
            locationName: item.data.location.name,
            birdsResolved: resolved.length,
            birdsRaw: item.data.birds.length,
          },
        };
      })
    );

    const summary = rows.reduce(
      (acc, row) => {
        acc.total += 1;
        if (row.status === 'invalid') acc.invalid += 1;
        if (row.status === 'warning') acc.warning += 1;
        if (row.status === 'ready') acc.ready += 1;
        if (row.potentialConflict) acc.potentialConflicts += 1;
        return acc;
      },
      { total: 0, ready: 0, warning: 0, invalid: 0, potentialConflicts: 0 }
    );

    res.status(200).json({
      success: true,
      message: '导入预览生成成功',
      data: {
        summary,
        rows,
      },
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message || '导入预览失败',
    });
  }
};

// @desc    执行导入（支持 skip / merge / overwrite）
// @route   POST /api/personal/import/apply
// @access  Private
const applyImport = async (req, res) => {
  try {
    const { format = 'json', content, records, strategy = 'skip' } = req.body || {};
    if (!['skip', 'merge', 'overwrite'].includes(strategy)) {
      return res.status(400).json({
        success: false,
        message: 'strategy 仅支持 skip / merge / overwrite',
      });
    }

    const rawRows = parseRawRows({ format, content, records }).slice(0, MAX_IMPORT_ROWS);
    const normalizedRows = rawRows.map((row, index) => normalizeRow(row, index));
    const validRows = normalizedRows.filter((item) => item.valid);
    const birdLookup = await buildBirdLookup();

    const result = {
      total: normalizedRows.length,
      created: 0,
      merged: 0,
      overwritten: 0,
      skipped: 0,
      failed: 0,
      details: [],
    };

    for (const item of normalizedRows) {
      if (!item.valid) {
        result.failed += 1;
        result.details.push({
          rowIndex: item.rowIndex,
          status: 'failed',
          reason: item.issues.join('、'),
        });
        continue;
      }

      const { resolved, unresolved } = resolveBirds(item.data.birds, birdLookup);
      if (resolved.length === 0 || unresolved.length > 0) {
        result.failed += 1;
        result.details.push({
          rowIndex: item.rowIndex,
          status: 'failed',
          reason: unresolved.length > 0 ? `未匹配鸟类：${unresolved.join('、')}` : '无可用鸟类',
        });
        continue;
      }

      const enrichedLocation = await enrichLocationPayload(
        item.data.location?.name,
        item.data.location?.address || {}
      );
      const payload = buildRecordPayload(
        req.user.id,
        { ...item.data, location: stripImportMeta(enrichedLocation) },
        resolved
      );
      const conflict = await findPotentialConflict(req.user.id, item.data.date, enrichedLocation.name);

      if (!conflict) {
        await Record.create(payload);
        result.created += 1;
        result.details.push({
          rowIndex: item.rowIndex,
          status: 'created',
          ...(enrichedLocation.hasValidCoords
            ? {}
            : { warning: '地点未匹配名录坐标，保存为未设置，编辑前请补全' }),
        });
        continue;
      }

      if (strategy === 'skip') {
        result.skipped += 1;
        result.details.push({
          rowIndex: item.rowIndex,
          status: 'skipped',
          reason: '存在潜在重复记录',
          conflictRecordId: conflict._id,
        });
        continue;
      }

      if (strategy === 'overwrite') {
        const safeLocation = await preserveExistingCoordsIfNeeded(conflict._id, enrichedLocation);
        await Record.findByIdAndUpdate(
          conflict._id,
          { ...payload, location: safeLocation },
          { new: false }
        );
        result.overwritten += 1;
        result.details.push({
          rowIndex: item.rowIndex,
          status: 'overwritten',
          conflictRecordId: conflict._id,
        });
        continue;
      }

      if (strategy === 'merge') {
        const existing = await Record.findById(conflict._id);
        if (!existing) {
          await Record.create(payload);
          result.created += 1;
          result.details.push({ rowIndex: item.rowIndex, status: 'created' });
          continue;
        }

        existing.birds = mergeBirds(existing.birds, payload.birds);
        if (payload.notes) {
          existing.notes = existing.notes
            ? `${existing.notes}\n${payload.notes}`
            : payload.notes;
        }
        if (payload.weather) existing.weather = payload.weather;
        if (payload.temperature != null) existing.temperature = payload.temperature;
        if (payload.humidity != null) existing.humidity = payload.humidity;
        if (payload.wind) existing.wind = payload.wind;
        await existing.save();

        result.merged += 1;
        result.details.push({
          rowIndex: item.rowIndex,
          status: 'merged',
          conflictRecordId: conflict._id,
        });
      }
    }

    res.status(200).json({
      success: true,
      message: '导入执行完成',
      data: {
        ...result,
        validRows: validRows.length,
      },
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message || '导入执行失败',
    });
  }
};

const mongoose = require('mongoose');
const { sendControllerError } = require('../middleware/controllerError');

const MAX_BATCH = 200;
/** 中国鸟类记录中心「报告」导出：原始行数上限（含表头） */
const MAX_CBRC_ROWS = 5000;

/** 无有效坐标时返回 null，禁止写入假默认点 */
function normalizeCoordinates(raw) {
  if (!raw) return null;

  // 兼容 [lng, lat]
  if (Array.isArray(raw) && raw.length >= 2) {
    const lng = Number(raw[0]);
    const lat = Number(raw[1]);
    if (!Number.isFinite(lng) || !Number.isFinite(lat) || (lng === 0 && lat === 0)) return null;
    if (lng < -180 || lng > 180 || lat < -90 || lat > 90) return null;
    return { type: 'Point', coordinates: [lng, lat] };
  }

  // 兼容 { lng, lat } / { longitude, latitude }
  if (typeof raw === 'object' && !Array.isArray(raw) && raw.type !== 'Point') {
    const lng = Number(raw.lng ?? raw.longitude ?? raw[0]);
    const lat = Number(raw.lat ?? raw.latitude ?? raw[1]);
    if (Number.isFinite(lng) && Number.isFinite(lat) && !(lng === 0 && lat === 0)) {
      if (lng >= -180 && lng <= 180 && lat >= -90 && lat <= 90) {
        return { type: 'Point', coordinates: [lng, lat] };
      }
    }
  }

  if (raw.type !== 'Point' || !Array.isArray(raw.coordinates)) {
    return null;
  }
  const lng = Number(raw.coordinates[0]);
  const lat = Number(raw.coordinates[1]);
  if (!Number.isFinite(lng) || !Number.isFinite(lat) || (lng === 0 && lat === 0)) {
    return null;
  }
  if (lng < -180 || lng > 180 || lat < -90 || lat > 90) {
    return null;
  }
  return { type: 'Point', coordinates: [lng, lat] };
}

function sanitizeImages(arr) {
  if (!Array.isArray(arr)) return [];
  const { sanitizeActiveUploadImageUrl } = require('../utils/safeUploadPath');
  return arr
    .map((i) => {
      if (!i || typeof i.url !== 'string') return null;
      const url = sanitizeActiveUploadImageUrl(i.url.trim());
      if (!url) return null;
      return {
        url,
        caption: i.caption || '',
        uploadedAt: i.uploadedAt ? new Date(i.uploadedAt) : new Date(),
      };
    })
    .filter(Boolean);
}

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function colIndex(headerRow, patterns) {
  const hr = headerRow.map((c) => String(c ?? '').trim());
  for (let i = 0; i < hr.length; i++) {
    const h = hr[i];
    if (!h) continue;
    for (const re of patterns) {
      if (re.test(h)) return i;
    }
  }
  return -1;
}

function normalizeHeaderCell(value) {
  return String(value ?? '')
    .replace(/^\uFEFF/, '')
    .replace(/[\s\u00a0\u3000]+/g, '')
    .trim();
}

function parseDateSafe(raw) {
  if (raw == null || raw === '') return null;
  const s = String(raw).trim().replace(/\//g, '-').replace(/\./g, '-');
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function buildLocationName(session) {
  const { province, city, district, point } = session;
  // 地点名只用观测点；省市区写入 address，页面另有小字展示
  const pointName = String(point || '').trim();
  if (pointName) return pointName.slice(0, 200);
  const region = [province, city, district].filter(Boolean).join('');
  return region ? region.slice(0, 200) : '';
}

/** 在前若干行中定位报告表表头（跳过标题行） */
function findCbrcReportHeaderIndex(rows, maxScan = 25) {
  const limit = Math.min(rows.length, maxScan);
  for (let i = 0; i < limit; i++) {
    const header = (rows[i] || []).map((c) => normalizeHeaderCell(c));
    const hasCn = header.some((h) => /中文名|鸟种中文|中文名称|^鸟名$/.test(h));
    const hasStart = header.some((h) =>
      /观测开始|观察开始|开始时间|观测时间|观察时间|观察日期|观测日期|^日期$/.test(h)
    );
    if (hasCn && hasStart) return i;
  }
  return -1;
}

/**
 * 解析中国鸟类记录中心「报告」表：多行同一报告、多鸟种。
 * 表头可在前几行；需含中文名列与开始时间/日期列。
 */
function parseCbrcReportSessions(rows) {
  if (!Array.isArray(rows) || rows.length < 2) {
    return { error: '数据至少需要表头一行与一行内容' };
  }

  const headerIndex = findCbrcReportHeaderIndex(rows);
  if (headerIndex < 0) {
    return {
      error:
        '未识别为「报告」导出表：表头需包含「中文名」与「观测开始时间」（或「观察开始时间」/「日期」）列。若是鸟种清单（含鸟种编号/拉丁学名/记录次数），请用自留地清单导入。',
      code: 'NOT_REPORT_TABLE',
    };
  }

  const header = (rows[headerIndex] || []).map((c) => normalizeHeaderCell(c));
  const idx = {
    reportId: colIndex(header, [/报告编号/]),
    start: colIndex(header, [
      /观测开始时间/,
      /观察开始时间/,
      /观测开始/,
      /观察开始/,
      /^开始时间$/,
      /观测时间/,
      /观察时间/,
      /观察日期/,
      /观测日期/,
      /^日期$/,
    ]),
    end: colIndex(header, [/观测结束时间/, /观察结束时间/, /^结束时间$/, /观测结束/, /观察结束/]),
    cn: colIndex(header, [/中文名/, /鸟种中文/, /中文名称/, /^鸟名$/]),
    latin: colIndex(header, [/拉丁学名/, /拉丁名/, /^学名$/]),
    province: colIndex(header, [/^省$/, /省份/]),
    city: colIndex(header, [/州\/?市/, /^市$/]),
    district: colIndex(header, [/区\/?县/, /区县/, /^县$/, /^区$/]),
    point: colIndex(header, [/观测点名称/, /观测点/, /观察点/, /地点/]),
    count: colIndex(header, [/鸟种数量/, /^数量$/, /数目/]),
  };

  if (idx.cn < 0 || idx.start < 0) {
    return {
      error:
        '未识别为「报告」导出表：表头需包含「中文名」与「观测开始时间」（或「观察开始时间」/「日期」）列',
      code: 'NOT_REPORT_TABLE',
    };
  }

  const sessions = new Map();
  for (let i = headerIndex + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || !row.length) continue;
    const cn = String(row[idx.cn] ?? '').trim();
    if (!cn) continue;

    const reportId = idx.reportId >= 0 ? String(row[idx.reportId] ?? '').trim() : '';
    const startRaw = String(row[idx.start] ?? '').trim();
    const province = idx.province >= 0 ? String(row[idx.province] ?? '').trim() : '';
    const city = idx.city >= 0 ? String(row[idx.city] ?? '').trim() : '';
    const district = idx.district >= 0 ? String(row[idx.district] ?? '').trim() : '';
    const point = idx.point >= 0 ? String(row[idx.point] ?? '').trim() : '';

    const key = [reportId, startRaw, province, city, district, point].join('|');
    if (!sessions.has(key)) {
      sessions.set(key, {
        reportId,
        startRaw,
        endRaw: idx.end >= 0 ? String(row[idx.end] ?? '').trim() : '',
        province,
        city,
        district,
        point,
        birds: [],
      });
    }
    const latin = idx.latin >= 0 ? String(row[idx.latin] ?? '').trim() : '';
    const count = idx.count >= 0 ? Math.max(1, parseInt(row[idx.count], 10) || 1) : 1;
    sessions.get(key).birds.push({ cn, latin, count });
  }

  if (sessions.size === 0) {
    return { error: '没有可导入的数据行（需填写中文名）' };
  }

  return { sessions: [...sessions.values()], headerIndex };
}

async function resolveBirdIdMap(pairs) {
  const unique = new Map();
  for (const { cn, latin } of pairs) {
    const key = `${cn}\t${latin}`;
    if (!unique.has(key)) unique.set(key, { cn, latin });
  }

  const names = [...new Set([...unique.values()].map((p) => p.cn).filter(Boolean))];
  const canonicalNames = [...new Set(names.map((n) => canonicalizeBirdName(n)).filter(Boolean))];
  const lookupNames = [...new Set([...names, ...canonicalNames])];
  const latins = [...new Set([...unique.values()].map((p) => p.latin).filter(Boolean))];

  const [byNameList, byLatinList, byAliasList] = await Promise.all([
    lookupNames.length
      ? Bird.find({ name: { $in: lookupNames } }).select('_id name scientificName nameAliases').lean()
      : [],
    latins.length
      ? Bird.find({ scientificName: { $in: latins } }).select('_id name scientificName nameAliases').lean()
      : [],
    lookupNames.length
      ? Bird.find({ nameAliases: { $in: lookupNames } }).select('_id name scientificName nameAliases').lean()
      : [],
  ]);

  const exactName = new Map();
  for (const b of [...byNameList, ...byAliasList]) {
    if (b.name && !exactName.has(b.name)) exactName.set(b.name, b._id);
    for (const alias of b.nameAliases || []) {
      if (alias && !exactName.has(alias)) exactName.set(alias, b._id);
    }
    for (const alias of aliasKeysForCanonical(b.name)) {
      if (!exactName.has(alias)) exactName.set(alias, b._id);
    }
  }
  const exactLatin = new Map();
  for (const b of byLatinList) {
    if (!exactLatin.has(b.scientificName)) exactLatin.set(b.scientificName, b._id);
  }

  const result = new Map();

  for (const [key, p] of unique) {
    let id = null;
    const canonicalCn = canonicalizeBirdName(p.cn);
    if (p.cn && exactName.has(p.cn)) id = exactName.get(p.cn);
    else if (canonicalCn && exactName.has(canonicalCn)) id = exactName.get(canonicalCn);
    else if (p.latin && exactLatin.has(p.latin)) id = exactLatin.get(p.latin);
    else {
      const bn = p.cn
        ? byNameList.find((x) => x.name && x.name.toLowerCase() === p.cn.toLowerCase())
        : null;
      if (bn) id = bn._id;
      else {
        const bl =
          p.latin
            ? byLatinList.find(
                (x) => x.scientificName && x.scientificName.toLowerCase() === p.latin.toLowerCase()
              )
            : null;
        if (bl) id = bl._id;
      }
    }
    result.set(key, id);
  }

  const needFuzzy = [...unique.keys()].filter((k) => result.get(k) == null);
  for (const key of needFuzzy) {
    const p = unique.get(key);
    let id = null;
    const candidates = [p.cn, canonicalizeBirdName(p.cn)].filter(Boolean);
    for (const cn of candidates) {
      if (id) break;
      const b = await Bird.findOne({
        $or: [
          { name: new RegExp(`^${escapeRegex(cn)}$`, 'i') },
          { nameAliases: cn },
        ],
      })
        .select('_id')
        .lean();
      if (b) id = b._id;
    }
    if (!id && p.latin) {
      const b = await Bird.findOne({
        scientificName: new RegExp(`^${escapeRegex(p.latin)}$`, 'i'),
      })
        .select('_id')
        .lean();
      if (b) id = b._id;
    }
    if (!id && p.cn) {
      const b = await Bird.findOne({ name: new RegExp(escapeRegex(p.cn)) }).select('_id').lean();
      if (b) id = b._id;
    }
    if (!id && p.latin) {
      const b = await Bird.findOne({
        scientificName: new RegExp(escapeRegex(p.latin), 'i'),
      })
        .select('_id')
        .lean();
      if (b) id = b._id;
    }
    result.set(key, id);
  }

  return (cn, latin) => result.get(`${cn}\t${latin}`) || null;
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

/** 本地日历日 YYYY-MM-DD，用于与已有记录比对 */
function localDateKey(d) {
  const x = new Date(d);
  return `${x.getFullYear()}-${pad2(x.getMonth() + 1)}-${pad2(x.getDate())}`;
}

function normalizeLocName(s) {
  const n = normalizeLocationName(String(s || '').replace(/\s+/g, ' '));
  return stripLocationRegionPrefix(n) || n;
}

function signatureFromBirds(birds) {
  if (!birds || !birds.length) return '';
  return [...birds]
    .map((b) => `${String(b.birdId)}:${Number(b.count) || 1}`)
    .sort()
    .join('|');
}

function duplicateCacheKey(dayKey, normLoc, sig) {
  return `${dayKey}|${normLoc}|${sig}`;
}

/**
 * 加载用户在日期范围内的已有记录，生成「日+地点+鸟种签名」索引（同键保留第一条）
 */
async function loadUserDuplicateMap(userId, dates) {
  const valid = (dates || []).filter(Boolean);
  if (!valid.length) return new Map();

  let minT = Math.min(...valid.map((d) => new Date(d).getTime()));
  let maxT = Math.max(...valid.map((d) => new Date(d).getTime()));
  const minD = new Date(minT);
  minD.setHours(0, 0, 0, 0);
  const maxD = new Date(maxT);
  maxD.setHours(23, 59, 59, 999);

  const rows = await Record.find({
    observer: userId,
    date: { $gte: minD, $lte: maxD },
  })
    .select('date location.name birds _id title')
    .lean();

  const dupMap = new Map();
  for (const r of rows) {
    const dayKey = localDateKey(r.date);
    const norm = normalizeLocName(r.location?.name);
    const sig = signatureFromBirds(r.birds || []);
    if (!norm || !sig) continue;
    const key = duplicateCacheKey(dayKey, norm, sig);
    if (!dupMap.has(key)) {
      dupMap.set(key, {
        recordId: r._id.toString(),
        title: r.title || '',
        date: r.date,
      });
    }
  }
  return dupMap;
}

function lookupDuplicate(dupMap, date, locationName, birds) {
  if (!date || !birds || !birds.length) return null;
  const dayKey = localDateKey(date);
  const norm = normalizeLocName(locationName);
  const sig = signatureFromBirds(birds);
  if (!norm || !sig) return null;
  return dupMap.get(duplicateCacheKey(dayKey, norm, sig)) || null;
}

/** 按中国鸟类记录中心「报告编号」查当前用户是否已有记录 */
async function loadUserCbrcReportDuplicateMap(userId, reportIds) {
  const ids = [...new Set((reportIds || []).map((r) => String(r ?? '').trim()).filter(Boolean))];
  if (!ids.length) return new Map();

  const rows = await Record.find({
    observer: userId,
    cbrcReportId: { $in: ids },
  })
    .select('cbrcReportId _id title')
    .lean();

  const m = new Map();
  for (const r of rows) {
    const id = r.cbrcReportId && String(r.cbrcReportId).trim();
    if (id && !m.has(id)) {
      m.set(id, { recordId: r._id.toString(), title: r.title || '' });
    }
  }
  return m;
}

async function buildCbrcPlan(rows) {
  if (!Array.isArray(rows) || rows.length < 2) {
    return { error: '请提供二维数组：第一行为表头，可由 Excel/CSV 解析得到' };
  }
  if (rows.length > MAX_CBRC_ROWS) {
    return { error: `单次最多 ${MAX_CBRC_ROWS} 行（含表头），请分批导入` };
  }

  const parsed = parseCbrcReportSessions(rows);
  if (parsed.error) return { error: parsed.error };
  const { sessions } = parsed;

  if (sessions.length > MAX_BATCH) {
    return {
      error: `合并后为 ${sessions.length} 条观鸟记录，超过单次上限 ${MAX_BATCH} 条，请分批导入`,
    };
  }

  const allPairs = [];
  for (const s of sessions) {
    for (const b of s.birds) {
      allPairs.push({ cn: b.cn, latin: b.latin });
    }
  }
  const resolveId = await resolveBirdIdMap(allPairs);

  const plan = [];
  for (let i = 0; i < sessions.length; i++) {
    const s = sessions[i];
    const date = parseDateSafe(s.startRaw);
    const locName = buildLocationName(s);
    const displayLoc = (locName || '观鸟记录（导入）').slice(0, 500);

    const birdsResolved = [];
    const birdsForRecord = [];
    const skippedNames = [];

    for (const b of s.birds) {
      const bid = resolveId(b.cn, b.latin);
      birdsResolved.push({
        chineseName: b.cn,
        latinName: b.latin || '',
        count: b.count,
        matched: !!bid,
        birdId: bid ? bid.toString() : null,
      });
      if (bid) {
        birdsForRecord.push({ birdId: bid.toString(), count: b.count });
      } else {
        skippedNames.push(b.cn);
      }
    }

    let status = 'ok';
    if (!date) status = 'bad_date';
    else if (birdsForRecord.length === 0) status = 'no_birds';

    plan.push({
      index: i,
      date: date || null,
      dateDisplay: date ? localDateKey(date) : String(s.startRaw || '').trim() || '—',
      locationDisplay: displayLoc,
      reportId: s.reportId || '',
      endRaw: s.endRaw || '',
      point: s.point || '',
      province: s.province || '',
      city: s.city || '',
      district: s.district || '',
      birdsResolved,
      birdsForRecord,
      skippedNames,
      status,
      session: s,
    });
  }

  return { plan };
}

function attachCbrcReportIdBatchFlags(plan) {
  const seen = new Map();
  for (const p of plan) {
    p.duplicateInBatchByReportId = null;
    if (p.status !== 'ok') continue;
    const rid = (p.reportId || '').trim();
    if (!rid) continue;
    if (seen.has(rid)) {
      p.duplicateInBatchByReportId = { firstIndex: seen.get(rid), reportId: rid };
    } else {
      seen.set(rid, p.index);
    }
  }
}

function attachCbrcDuplicateFlags(plan, dupMapFromDb, reportDupMap) {
  attachCbrcReportIdBatchFlags(plan);

  const keyToFirstIndex = new Map();
  for (const p of plan) {
    p.duplicateOfExisting = null;
    p.duplicateInBatch = null;
    p.duplicateByReportId = null;

    if (p.status !== 'ok') continue;

    const rid = (p.reportId || '').trim();
    if (rid && reportDupMap.has(rid)) {
      const ex = reportDupMap.get(rid);
      p.duplicateByReportId = { recordId: ex.recordId, title: ex.title, reportId: rid };
      p.duplicateOfExisting = {
        recordId: ex.recordId,
        title: ex.title,
        match: 'cbrcReportId',
      };
    } else {
      const existing = lookupDuplicate(dupMapFromDb, p.date, p.locationDisplay, p.birdsForRecord);
      if (existing) {
        p.duplicateOfExisting = {
          recordId: existing.recordId,
          title: existing.title,
          match: 'signature',
        };
      }
    }

    const key = duplicateCacheKey(
      localDateKey(p.date),
      normalizeLocName(p.locationDisplay),
      signatureFromBirds(p.birdsForRecord)
    );
    if (keyToFirstIndex.has(key)) {
      const firstIdx = keyToFirstIndex.get(key);
      if (firstIdx !== p.index) {
        p.duplicateInBatch = { firstIndex: firstIdx };
      }
    } else {
      keyToFirstIndex.set(key, p.index);
    }
  }
}

function summarizeCbrcPlan(plan) {
  const ok = plan.filter((p) => p.status === 'ok');
  const dupDb = ok.filter((p) => p.duplicateOfExisting).length;
  const dupReportDb = ok.filter((p) => p.duplicateByReportId).length;
  const dupReportBatch = ok.filter((p) => p.duplicateInBatchByReportId).length;
  const dupSigDb = ok.filter(
    (p) => p.duplicateOfExisting && p.duplicateOfExisting.match === 'signature'
  ).length;
  const dupSigBatchOnly = ok.filter(
    (p) => p.duplicateInBatch && !p.duplicateInBatchByReportId
  ).length;
  const dupAnyBatch = ok.filter(
    (p) => p.duplicateInBatch || p.duplicateInBatchByReportId
  ).length;
  let birdRows = 0;
  let matchedRows = 0;
  for (const p of plan) {
    for (const b of p.birdsResolved) {
      birdRows += 1;
      if (b.matched) matchedRows += 1;
    }
  }
  return {
    sessionCount: plan.length,
    validSessions: ok.length,
    invalidSessions: plan.length - ok.length,
    duplicateWithExisting: dupDb,
    duplicateWithinUpload: dupAnyBatch,
    duplicateReportIdWithExisting: dupReportDb,
    duplicateReportIdWithinUpload: dupReportBatch,
    duplicateSignatureWithExisting: dupSigDb,
    duplicateSignatureWithinUpload: dupSigBatchOnly,
    wouldImportIfSkipDup: ok.filter(
      (p) =>
        !p.duplicateOfExisting && !p.duplicateInBatch && !p.duplicateInBatchByReportId
    ).length,
    birdRows,
    matchedBirdRows: matchedRows,
    unmatchedBirdRows: birdRows - matchedRows,
  };
}

function planItemForJsonResponse(p) {
  return {
    index: p.index,
    status: p.status,
    dateDisplay: p.dateDisplay,
    locationDisplay: p.locationDisplay,
    reportId: p.reportId,
    point: p.point,
    birdsResolved: p.birdsResolved,
    skippedNames: p.skippedNames,
    duplicateByReportId: p.duplicateByReportId,
    duplicateInBatchByReportId: p.duplicateInBatchByReportId,
    duplicateOfExisting: p.duplicateOfExisting,
    duplicateInBatch: p.duplicateInBatch,
  };
}

// @desc    预览报告表导入（不写入）
// @route   POST /api/personal/import/cbrc-table/preview
const previewCbrcTable = async (req, res) => {
  try {
    const userId = req.user.id;
    const { rows } = req.body;

    const built = await buildCbrcPlan(rows);
    if (built.error) {
      return res.status(400).json({ success: false, message: built.error });
    }
    const { plan } = built;

    const dates = plan.filter((p) => p.status === 'ok').map((p) => p.date);
    const dupMap = await loadUserDuplicateMap(userId, dates);
    const reportIds = plan.map((p) => p.reportId);
    const reportDupMap = await loadUserCbrcReportDuplicateMap(userId, reportIds);
    attachCbrcDuplicateFlags(plan, dupMap, reportDupMap);

    const summary = summarizeCbrcPlan(plan);
    res.json({
      success: true,
      data: {
        summary,
        sessions: plan.map(planItemForJsonResponse),
      },
    });
  } catch (error) {
    console.error('报告表预览失败:', error);
    return sendControllerError(res, error, {
      defaultMessage: '预览失败',
      defaultCode: 'PERSONAL_IMPORT_OPERATION_FAILED',
    });
  }
};

function normalizeJsonImportBody(body) {
  if (Array.isArray(body)) {
    return { list: body, skipDuplicates: true };
  }
  if (body && typeof body === 'object' && Array.isArray(body.records)) {
    return {
      list: body.records,
      skipDuplicates: body.skipDuplicates !== false,
    };
  }
  return { list: null, skipDuplicates: true };
}

async function buildJsonImportPlan(list, validBirdIdSet) {
  const plan = [];
  for (let i = 0; i < list.length; i++) {
    const raw = list[i];
    const issues = [];

    if (!raw?.location?.name || !raw?.date) {
      issues.push('缺少 location.name 或 date');
    }
    if (!Array.isArray(raw?.birds) || raw.birds.length === 0) {
      issues.push('birds 不能为空');
    }

    const locName =
      raw?.location?.name && typeof raw.location.name === 'string'
        ? raw.location.name.trim().slice(0, 500)
        : '';
    if (!locName && !issues.includes('缺少 location.name 或 date')) {
      issues.push('地点名称无效');
    }

    const birdsForRecord = [];
    if (Array.isArray(raw?.birds)) {
      for (const b of raw.birds) {
        if (!b?.birdId) continue;
        const idStr = b.birdId.toString();
        if (!mongoose.isValidObjectId(idStr)) continue;
        if (!validBirdIdSet.has(idStr)) continue;
        birdsForRecord.push({
          birdId: idStr,
          count: Math.max(1, parseInt(b.count, 10) || 1),
        });
      }
    }

    if (issues.length === 0 && birdsForRecord.length === 0) {
      issues.push('没有有效的 birdId');
    }

    let date = null;
    let dateDisplay = '—';
    if (raw?.date) {
      date = new Date(raw.date);
      if (Number.isNaN(date.getTime())) {
        issues.push('date 无法解析');
        date = null;
      } else {
        dateDisplay = localDateKey(date);
      }
    }

    const status = issues.length ? 'invalid' : 'ok';
    plan.push({
      index: i,
      status,
      issues,
      date,
      dateDisplay,
      locationDisplay: locName || '—',
      titlePreview: (raw?.title && String(raw.title).slice(0, 80)) || '',
      birdCount: birdsForRecord.length,
      birdsForRecord,
      raw,
    });
  }
  return plan;
}

function attachJsonDuplicateFlags(plan, dupMapFromDb) {
  const keyToFirstIndex = new Map();
  for (const p of plan) {
    p.duplicateOfExisting = null;
    p.duplicateInBatch = null;
    if (p.status !== 'ok') continue;

    const key = duplicateCacheKey(
      localDateKey(p.date),
      normalizeLocName(p.locationDisplay),
      signatureFromBirds(p.birdsForRecord)
    );

    const existing = lookupDuplicate(dupMapFromDb, p.date, p.locationDisplay, p.birdsForRecord);
    if (existing) {
      p.duplicateOfExisting = { recordId: existing.recordId, title: existing.title };
    }

    if (keyToFirstIndex.has(key)) {
      const firstIdx = keyToFirstIndex.get(key);
      if (firstIdx !== p.index) {
        p.duplicateInBatch = { firstIndex: firstIdx };
      }
    } else {
      keyToFirstIndex.set(key, p.index);
    }
  }
}

// @desc    预览 JSON 导入（不写入）
// @route   POST /api/personal/import/json/preview
const previewJsonImport = async (req, res) => {
  try {
    const userId = req.user.id;
    const { list } = normalizeJsonImportBody(req.body);
    if (!Array.isArray(list)) {
      return res.status(400).json({
        success: false,
        message: '请求体须为记录数组，或包含 records 数组的对象',
      });
    }
    if (list.length > MAX_BATCH) {
      return res.status(400).json({
        success: false,
        message: `单次最多预览 ${MAX_BATCH} 条记录`,
      });
    }

    const allBirdIds = new Set();
    for (const raw of list) {
      if (!Array.isArray(raw?.birds)) continue;
      for (const b of raw.birds) {
        if (!b?.birdId) continue;
        const idStr = b.birdId.toString();
        if (mongoose.isValidObjectId(idStr)) allBirdIds.add(idStr);
      }
    }
    const idList = [...allBirdIds];
    const existingBirds =
      idList.length > 0
        ? await Bird.find({ _id: { $in: idList } })
            .select('_id')
            .lean()
        : [];
    const validBirdIdSet = new Set(existingBirds.map((d) => d._id.toString()));

    const plan = await buildJsonImportPlan(list, validBirdIdSet);
    const dates = plan.filter((p) => p.status === 'ok').map((p) => p.date);
    const dupMap = await loadUserDuplicateMap(userId, dates);
    attachJsonDuplicateFlags(plan, dupMap);

    const ok = plan.filter((p) => p.status === 'ok');
    const summary = {
      rowCount: list.length,
      validRows: ok.length,
      invalidRows: plan.length - ok.length,
      duplicateWithExisting: ok.filter((p) => p.duplicateOfExisting).length,
      duplicateWithinUpload: ok.filter((p) => p.duplicateInBatch).length,
      wouldImportIfSkipDup: ok.filter((p) => !p.duplicateOfExisting && !p.duplicateInBatch).length,
    };

    res.json({
      success: true,
      data: {
        summary,
        rows: plan.map((p) => ({
          index: p.index,
          status: p.status,
          issues: p.issues,
          dateDisplay: p.dateDisplay,
          locationDisplay: p.locationDisplay,
          titlePreview: p.titlePreview,
          birdCount: p.birdCount,
          duplicateOfExisting: p.duplicateOfExisting,
          duplicateInBatch: p.duplicateInBatch,
        })),
      },
    });
  } catch (error) {
    console.error('JSON 预览失败:', error);
    return sendControllerError(res, error, {
      defaultMessage: '预览失败',
      defaultCode: 'PERSONAL_IMPORT_OPERATION_FAILED',
    });
  }
};

// @desc    从 JSON 批量导入观鸟记录（通常与备份导出格式兼容）
// @route   POST /api/personal/import/json
// @access  Private
const importFromJson = async (req, res) => {
  try {
    const userId = req.user.id;
    const { list, skipDuplicates } = normalizeJsonImportBody(req.body);

    if (!Array.isArray(list)) {
      return res.status(400).json({
        success: false,
        message: '请求体须为记录数组，或包含 records 数组的对象',
      });
    }
    if (list.length > MAX_BATCH) {
      return res.status(400).json({
        success: false,
        message: `单次最多导入 ${MAX_BATCH} 条记录`,
      });
    }

    const allBirdIds = new Set();
    for (const raw of list) {
      if (!Array.isArray(raw?.birds)) continue;
      for (const b of raw.birds) {
        if (!b?.birdId) continue;
        const idStr = b.birdId.toString();
        if (mongoose.isValidObjectId(idStr)) allBirdIds.add(idStr);
      }
    }

    const idList = [...allBirdIds];
    const existingBirds =
      idList.length > 0
        ? await Bird.find({ _id: { $in: idList } })
            .select('_id')
            .lean()
        : [];
    const validBirdIdSet = new Set(existingBirds.map((d) => d._id.toString()));

    const plan = await buildJsonImportPlan(list, validBirdIdSet);
    const dates = plan.filter((p) => p.status === 'ok').map((p) => p.date);
    const dupMap = await loadUserDuplicateMap(userId, dates);
    attachJsonDuplicateFlags(plan, dupMap);

    let created = 0;
    let skippedDuplicate = 0;
    const errors = [];
    const seenKeys = new Set();

    for (const p of plan) {
      const i = p.index;
      const raw = p.raw;
      try {
        if (p.status !== 'ok') {
          errors.push({ index: i, message: p.issues.join('；') });
          continue;
        }

        const birds = [];
        for (const b of raw.birds) {
          if (!b?.birdId) continue;
          const idStr = b.birdId.toString();
          if (!mongoose.isValidObjectId(idStr)) continue;
          if (!validBirdIdSet.has(idStr)) continue;
          birds.push({
            birdId: idStr,
            notes: b.notes || '',
            count: Math.max(1, parseInt(b.count, 10) || 1),
            images: sanitizeImages(b.images),
          });
        }
        if (!birds.length) {
          errors.push({ index: i, message: '没有有效的 birdId' });
          continue;
        }

        const loc = raw.location;
        const locName =
          typeof loc.name === 'string' ? loc.name.trim().slice(0, 500) : '';

        const sigBirds = birds.map((b) => ({ birdId: b.birdId, count: b.count }));
        const dupKey = duplicateCacheKey(
          localDateKey(p.date),
          normalizeLocName(locName),
          signatureFromBirds(sigBirds)
        );

        const dbDup = lookupDuplicate(dupMap, p.date, locName, sigBirds);
        if (skipDuplicates && dbDup) {
          skippedDuplicate += 1;
          errors.push({
            index: i,
            message: '与已有记录重复，已跳过',
            duplicateOf: dbDup,
          });
          continue;
        }
        if (skipDuplicates && seenKeys.has(dupKey)) {
          skippedDuplicate += 1;
          errors.push({
            index: i,
            message: '与本次上传中另一条记录重复，已跳过',
          });
          continue;
        }

        const enrichedLocation = await enrichLocationPayload(locName, loc.address || {});
        const fromFile = normalizeCoordinates(loc.coordinates);
        const locationPayload = stripImportMeta(enrichedLocation);
        if (fromFile) {
          locationPayload.coordinates = fromFile;
        }

        await Record.create({
          title: (raw.title && String(raw.title).slice(0, 500)) || '',
          description: (raw.description && String(raw.description).slice(0, 20000)) || '',
          location: locationPayload,
          date: new Date(raw.date),
          observer: userId,
          birds,
          weather: raw.weather || '',
          temperature: raw.temperature,
          humidity: raw.humidity,
          wind: raw.wind || '',
          images: sanitizeImages(raw.images),
          notes: raw.notes || '',
          status: raw.status === 'draft' ? 'draft' : 'published',
          tags: Array.isArray(raw.tags) ? raw.tags : [],
          isPublic: raw.isPublic !== false,
        });
        created += 1;
        seenKeys.add(dupKey);
      } catch (e) {
        errors.push({ index: i, message: e.message || '写入失败' });
      }
    }

    res.json({
      success: true,
      data: {
        created,
        attempted: list.length,
        skippedDuplicate,
        errors,
      },
    });
  } catch (error) {
    console.error('导入失败:', error);
    return sendControllerError(res, error, {
      defaultMessage: '导入失败',
      defaultCode: 'PERSONAL_IMPORT_OPERATION_FAILED',
    });
  }
};

// @desc    中国鸟类记录中心「报告」导出表（多行同一场次、多鸟种）
// @route   POST /api/personal/import/cbrc-table
// @access  Private
// body: { rows: string[][] } 首行为表头
const importFromCbrcTable = async (req, res) => {
  try {
    const userId = req.user.id;
    const { rows, skipDuplicates = true } = req.body;

    const built = await buildCbrcPlan(rows);
    if (built.error) {
      return res.status(400).json({ success: false, message: built.error });
    }
    const { plan } = built;

    const dates = plan.filter((p) => p.status === 'ok').map((p) => p.date);
    const dupMap = await loadUserDuplicateMap(userId, dates);
    const reportIds = plan.map((p) => p.reportId);
    const reportDupMap = await loadUserCbrcReportDuplicateMap(userId, reportIds);

    let created = 0;
    let skippedDuplicate = 0;
    const errors = [];
    const skippedBirds = [];
    const seenKeys = new Set();
    const seenReportIds = new Set();

    for (const p of plan) {
      const i = p.index;
      const s = p.session;
      if (p.status === 'bad_date') {
        errors.push({ index: i, message: `观测开始时间无法解析: ${s.startRaw || '(空)'}` });
        continue;
      }
      if (p.status === 'no_birds') {
        errors.push({
          index: i,
          message: '该场次没有匹配到库中鸟种（请核对中文名/学名是否在图鉴中）',
          location: p.locationDisplay,
        });
        for (const name of p.skippedNames) {
          skippedBirds.push(name);
        }
        continue;
      }

      const date = p.date;
      const displayLoc = p.locationDisplay;

      const birds = p.birdsForRecord.map((b) => ({
        birdId: b.birdId,
        notes: '',
        count: b.count,
        images: [],
      }));

      for (const br of p.birdsResolved) {
        if (!br.matched) {
          skippedBirds.push(`${br.chineseName}${br.latinName ? ` (${br.latinName})` : ''}`);
        }
      }

      const rid = (s.reportId || '').trim();
      if (skipDuplicates && rid) {
        if (reportDupMap.has(rid)) {
          skippedDuplicate += 1;
          errors.push({
            index: i,
            message: '与已有记录报告编号重复，已跳过',
            reportId: rid,
            duplicateOf: reportDupMap.get(rid),
            location: displayLoc,
          });
          continue;
        }
        if (seenReportIds.has(rid)) {
          skippedDuplicate += 1;
          errors.push({
            index: i,
            message: '本次上传中报告编号重复，已跳过',
            reportId: rid,
            location: displayLoc,
          });
          continue;
        }
      }

      const dupKey = duplicateCacheKey(
        localDateKey(date),
        normalizeLocName(displayLoc),
        signatureFromBirds(p.birdsForRecord)
      );
      const dbDup = lookupDuplicate(dupMap, date, displayLoc, p.birdsForRecord);

      if (skipDuplicates && dbDup) {
        skippedDuplicate += 1;
        errors.push({
          index: i,
          message: '与已有记录重复（日期+地点+鸟种），已跳过',
          duplicateOf: dbDup,
          location: displayLoc,
        });
        continue;
      }
      if (skipDuplicates && seenKeys.has(dupKey)) {
        skippedDuplicate += 1;
        errors.push({
          index: i,
          message: '与本次上传中另一条记录重复（日期+地点+鸟种），已跳过',
          location: displayLoc,
        });
        continue;
      }

      try {
        const descParts = [];
        if (s.reportId) descParts.push(`报告编号 ${s.reportId}`);
        if (s.endRaw) descParts.push(`观测结束 ${s.endRaw}`);
        descParts.push('来源：中国鸟类记录中心导出');
        const y = date.getFullYear();
        const mo = String(date.getMonth() + 1).padStart(2, '0');
        const da = String(date.getDate()).padStart(2, '0');
        const localDateStr = `${y}-${mo}-${da}`;
        const enrichedLocation = await enrichLocationPayload(displayLoc, {
          province: s.province || '',
          city: s.city || '',
          district: s.district || '',
          detail: s.point || '',
        });
        const createPayload = {
          title: (s.point ? `${s.point} 观鸟记录` : `观鸟记录 ${localDateStr}`).slice(0, 500),
          description: descParts.join('；').slice(0, 20000),
          location: stripImportMeta(enrichedLocation),
          date,
          observer: userId,
          birds,
          weather: '',
          images: [],
          notes: '',
          status: 'published',
          tags: ['导入', '中国鸟类记录中心'],
          isPublic: true,
        };
        if (rid) createPayload.cbrcReportId = rid;
        const doc = await Record.create(createPayload);
        created += 1;
        seenKeys.add(dupKey);
        dupMap.set(dupKey, { recordId: doc._id.toString(), title: doc.title || '' });
        if (rid) {
          seenReportIds.add(rid);
          reportDupMap.set(rid, { recordId: doc._id.toString(), title: doc.title || '' });
        }
      } catch (e) {
        errors.push({ index: i, message: e.message || '写入失败' });
      }
    }

    res.json({
      success: true,
      data: {
        created,
        attempted: plan.length,
        skippedDuplicate,
        errors,
        skippedBirdSamples: [...new Set(skippedBirds)].slice(0, 40),
        skippedBirdRows: skippedBirds.length,
      },
    });
  } catch (error) {
    console.error('报告表导入失败:', error);
    return sendControllerError(res, error, {
      defaultMessage: '导入失败',
      defaultCode: 'PERSONAL_IMPORT_OPERATION_FAILED',
    });
  }
};

module.exports = {
  previewImport,
  applyImport,
  importFromJson,
  importFromCbrcTable,
  previewCbrcTable,
  previewJsonImport,
  buildCbrcPlan,
  parseCbrcReportSessions,
};
