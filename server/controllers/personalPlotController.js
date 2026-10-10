const mongoose = require('mongoose');
const PersonalPlot = require('../models/personalPlotModel');
const Bird = require('../models/birdModel');
const Location = require('../models/locationModel');
const { sendControllerError } = require('../middleware/controllerError');
const { buildCbrcPlan } = require('./personalImportController');
const {
  findActiveLocationByFlexibleName,
  stripLocationRegionPrefix,
} = require('../utils/locationName');

const PLOT_SOURCES = new Set(['cbrc', 'manual', 'other']);

const findSpeciesListHeaderIndex = (rows, maxScan = 25) => {
  const limit = Math.min(rows.length, maxScan);
  for (let i = 0; i < limit; i++) {
    const header = (rows[i] || []).map((c) =>
      String(c ?? '')
        .replace(/^\uFEFF/, '')
        .replace(/[\s\u00a0\u3000]+/g, '')
        .trim()
    );
    const hasCn = header.some((h) => /中文名|鸟种中文|中文名称|^鸟名$/.test(h));
    const hasRecordCount = header.some((h) => /记录次数/.test(h));
    const hasReportId = header.some((h) => /报告编号/.test(h));
    const hasReportMeta = header.some((h) => /观测地点|记录用户|公开状态/.test(h));
    // 总清单：有记录次数，且不是「报告列表」
    if (hasCn && hasRecordCount && !hasReportMeta) return i;
    if (hasCn && header.some((h) => /拉丁/.test(h)) && !hasReportId && !hasReportMeta && hasRecordCount) {
      return i;
    }
  }
  return -1;
};

const normalizeHeaderRow = (row = []) =>
  (row || []).map((c) =>
    String(c ?? '')
      .replace(/^\uFEFF/, '')
      .replace(/[\s\u00a0\u3000]+/g, '')
      .trim()
  );

const findCol = (header, patterns, fallback = -1) => {
  for (let i = 0; i < header.length; i++) {
    if (patterns.some((re) => re.test(header[i]))) return i;
  }
  return fallback;
};

const findHeaderIndexBy = (rows, predicate, maxScan = 25) => {
  const limit = Math.min(rows.length, maxScan);
  for (let i = 0; i < limit; i++) {
    if (predicate(normalizeHeaderRow(rows[i]))) return i;
  }
  return -1;
};

/** 报告列表：报告编号 + 观测时间/地点/记录用户（无中文名种列） */
const findReportListHeaderIndex = (rows) =>
  findHeaderIndexBy(rows, (header) => {
    const hasReportId = header.some((h) => /报告编号/.test(h));
    const hasMeta = header.some((h) => /观测时间|观测地点|记录用户|公开状态/.test(h));
    const hasCn = header.some((h) => /中文名|鸟种中文|^鸟名$/.test(h));
    return hasReportId && hasMeta && !hasCn;
  });

/** 报告鸟种明细：中文名 +（数量/图片/鸟种编号），可有报告编号 */
const findReportBirdsHeaderIndex = (rows) =>
  findHeaderIndexBy(rows, (header) => {
    const hasCn = header.some((h) => /中文名|鸟种中文|中文名称|^鸟名$/.test(h));
    const hasBirdHint = header.some((h) => /鸟种编号|拉丁名|拉丁学名|^数量$|图片/.test(h));
    const hasRecordCount = header.some((h) => /记录次数/.test(h));
    const hasReportListMeta = header.some((h) => /观测地点|记录用户|公开状态/.test(h));
    return hasCn && hasBirdHint && !hasRecordCount && !hasReportListMeta;
  });

const parseObservationTimeRange = (raw) => {
  const s = String(raw || '')
    .trim()
    .replace(/\//g, '-');
  if (!s) return { start: null, end: null };
  const parts = s.split(/\s*至\s*/);
  const start = parseDate(parts[0]);
  const end = parts[1] ? parseDate(parts[1]) : null;
  return { start, end };
};

const parseReportListRows = (rows) => {
  const headerIndex = findReportListHeaderIndex(rows);
  if (headerIndex < 0) return { error: '无法识别为报告列表（需含报告编号与观测时间/地点）' };
  const header = normalizeHeaderRow(rows[headerIndex]);
  const colId = findCol(header, [/报告编号/], 0);
  const colTime = findCol(header, [/观测时间/, /观察时间/], -1);
  const colUser = findCol(header, [/记录用户/, /记录人/, /用户/], -1);
  const colLoc = findCol(header, [/观测地点/, /观察地点/, /地点/], -1);
  const colCount = findCol(header, [/鸟种数量/, /^数量$/], -1);
  const colPublic = findCol(header, [/公开状态/, /公开/], -1);

  const reports = [];
  for (let i = headerIndex + 1; i < rows.length; i++) {
    const row = rows[i] || [];
    const reportId = String(row[colId] ?? '').trim();
    if (!reportId) continue;
    const timeRaw = colTime >= 0 ? String(row[colTime] ?? '').trim() : '';
    const { start, end } = parseObservationTimeRange(timeRaw);
    reports.push({
      reportId,
      startAt: start,
      endAt: end,
      timeRaw,
      observer: colUser >= 0 ? String(row[colUser] ?? '').trim() : '',
      locationText: colLoc >= 0 ? String(row[colLoc] ?? '').trim() : '',
      speciesCountHint:
        colCount >= 0
          ? Math.max(0, Number.parseInt(String(row[colCount] ?? '').replace(/,/g, ''), 10) || 0)
          : 0,
      publicStatus: colPublic >= 0 ? String(row[colPublic] ?? '').trim() : '',
    });
  }
  if (!reports.length) return { error: '报告列表中没有可用行' };
  return { reports, headerIndex };
};

const parseReportBirdsRows = (rows) => {
  const headerIndex = findReportBirdsHeaderIndex(rows);
  if (headerIndex < 0) return { error: '无法识别为报告鸟种明细' };
  const header = normalizeHeaderRow(rows[headerIndex]);
  const colReport = findCol(header, [/报告编号/], -1);
  const colCn = findCol(header, [/中文名/, /鸟种中文/, /中文名称/, /^鸟名$/], 1);
  const colLatin = findCol(header, [/拉丁学名/, /拉丁名/, /^学名$/], 2);
  const colCode = findCol(header, [/鸟种编号/], 0);
  const colOrder = findCol(header, [/^目$/], -1);
  const colFamily = findCol(header, [/^科$/], -1);
  const colCount = findCol(header, [/^数量$/, /鸟种数量/], -1);

  const birds = [];
  for (let i = headerIndex + 1; i < rows.length; i++) {
    const row = rows[i] || [];
    const name = String(row[colCn] ?? '').trim();
    const scientificName = String(row[colLatin] ?? '').trim();
    if (!name && !scientificName) continue;
    birds.push({
      reportId: colReport >= 0 ? String(row[colReport] ?? '').trim() : '',
      code: colCode >= 0 ? String(row[colCode] ?? '').trim() : '',
      name: name || scientificName,
      scientificName,
      order: colOrder >= 0 ? String(row[colOrder] ?? '').trim() : '',
      family: colFamily >= 0 ? String(row[colFamily] ?? '').trim() : '',
      count:
        colCount >= 0
          ? Math.max(1, Number.parseInt(String(row[colCount] ?? '').replace(/,/g, ''), 10) || 1)
          : 1,
    });
  }
  if (!birds.length) return { error: '报告鸟种明细中没有可用行' };
  return { birds, headerIndex, hasReportIdColumn: colReport >= 0 };
};

const parsePlotSpeciesListRows = (rows) => {
  const headerIndex = findSpeciesListHeaderIndex(rows);
  if (headerIndex < 0) return { error: '无法识别为鸟种清单表' };
  const header = normalizeHeaderRow(rows[headerIndex]);
  const colCn = findCol(header, [/中文名/, /鸟种中文/, /中文名称/, /^鸟名$/], 1);
  const colLatin = findCol(header, [/拉丁学名/, /拉丁名/, /^学名$/], 2);
  const colCode = findCol(header, [/鸟种编号/, /编号/], 0);
  const colCount = findCol(header, [/记录次数/, /^数量$/], -1);
  const colOrder = findCol(header, [/^目$/], -1);
  const colFamily = findCol(header, [/^科$/], -1);

  const species = [];
  for (let i = headerIndex + 1; i < rows.length; i++) {
    const row = rows[i] || [];
    const name = String(row[colCn] ?? '').trim();
    const scientificName = String(row[colLatin] ?? '').trim();
    if (!name && !scientificName) continue;
    const recordCount =
      colCount >= 0
        ? Number.parseInt(String(row[colCount] ?? '').replace(/,/g, ''), 10)
        : 0;
    species.push({
      code: colCode >= 0 ? String(row[colCode] ?? '').trim() : '',
      name: name || scientificName,
      scientificName,
      order: colOrder >= 0 ? String(row[colOrder] ?? '').trim() : '',
      family: colFamily >= 0 ? String(row[colFamily] ?? '').trim() : '',
      recordCount: Number.isFinite(recordCount) && recordCount > 0 ? recordCount : 0,
    });
  }
  if (!species.length) return { error: '清单中没有可用鸟种行' };
  return { species, headerIndex };
};

const upsertPlotReport = (plot, report) => {
  if (!Array.isArray(plot.reports)) plot.reports = [];
  const idx = plot.reports.findIndex((r) => String(r.reportId) === String(report.reportId));
  if (idx >= 0) {
    const existing = plot.reports[idx];
    existing.startAt = report.startAt || existing.startAt;
    existing.endAt = report.endAt || existing.endAt;
    existing.timeRaw = report.timeRaw || existing.timeRaw;
    existing.observer = report.observer || existing.observer;
    existing.locationText = report.locationText || existing.locationText;
    existing.speciesCountHint = report.speciesCountHint || existing.speciesCountHint;
    existing.publicStatus = report.publicStatus || existing.publicStatus;
    return existing;
  }
  plot.reports.push({
    ...report,
    birdsImported: 0,
    importedAt: null,
  });
  return plot.reports[plot.reports.length - 1];
};

const findPlotReport = (plot, reportId) => {
  const id = String(reportId || '').trim();
  if (!id) return null;
  return (plot.reports || []).find((r) => String(r.reportId) === id) || null;
};

const parseDate = (value) => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

const normalizeSource = (raw, fallback = 'manual') => {
  const s = String(raw || '').trim().toLowerCase();
  if (PLOT_SOURCES.has(s)) return s;
  return fallback;
};

const refreshSpeciesRollup = (speciesDoc) => {
  const entries = Array.isArray(speciesDoc.entries) ? speciesDoc.entries : [];
  speciesDoc.times = entries.length;
  if (entries.length === 0) {
    speciesDoc.firstSeenAt = null;
    speciesDoc.lastSeenAt = null;
    speciesDoc.observers = [];
    speciesDoc.sources = [];
    return;
  }
  const dates = entries
    .map((e) => (e.date ? new Date(e.date) : null))
    .filter((d) => d && !Number.isNaN(d.getTime()))
    .sort((a, b) => a - b);
  speciesDoc.firstSeenAt = dates[0] || null;
  speciesDoc.lastSeenAt = dates[dates.length - 1] || null;
  speciesDoc.observers = [
    ...new Set(entries.map((e) => String(e.observer || '').trim()).filter(Boolean)),
  ];
  speciesDoc.sources = [
    ...new Set(entries.map((e) => normalizeSource(e.source)).filter(Boolean)),
  ];
};

const refreshPlotStats = (plot) => {
  const species = Array.isArray(plot.species) ? plot.species : [];
  const reports = Array.isArray(plot.reports) ? plot.reports : [];
  plot.statsCache = {
    speciesCount: species.length,
    entryCount: species.reduce((n, s) => n + (Array.isArray(s.entries) ? s.entries.length : 0), 0),
    reportCount: reports.length,
    reportsWithBirds: reports.filter((r) => (r.birdsImported || 0) > 0).length,
    updatedAt: new Date(),
  };
};

const findSpeciesIndex = (plot, { birdId, name, scientificName } = {}) => {
  const list = plot.species || [];
  if (birdId) {
    const idStr = String(birdId);
    const byId = list.findIndex((s) => s.birdId && String(s.birdId) === idStr);
    if (byId >= 0) return byId;
  }
  const n = String(name || '').trim();
  if (n) {
    const byName = list.findIndex((s) => String(s.name || '').trim() === n);
    if (byName >= 0) return byName;
  }
  const sci = String(scientificName || '').trim();
  if (sci) {
    const bySci = list.findIndex((s) => String(s.scientificName || '').trim() === sci);
    if (bySci >= 0) return bySci;
  }
  return -1;
};

const hasExternalKey = (plot, externalKey) => {
  const key = String(externalKey || '').trim();
  if (!key) return false;
  return (plot.species || []).some((s) =>
    (s.entries || []).some((e) => String(e.externalKey || '').trim() === key)
  );
};

const loadOwnedPlot = async (plotId, userId) => {
  if (!mongoose.Types.ObjectId.isValid(plotId)) return null;
  return PersonalPlot.findOne({ _id: plotId, owner: userId });
};

const sanitizePlotMeta = (body = {}) => {
  const payload = {};
  if (typeof body.title === 'string') payload.title = body.title.trim().slice(0, 120);
  if (typeof body.province === 'string') payload.province = body.province.trim().slice(0, 80);
  if (typeof body.city === 'string') payload.city = body.city.trim().slice(0, 80);
  if (typeof body.district === 'string') payload.district = body.district.trim().slice(0, 80);
  if (typeof body.spot === 'string') payload.spot = body.spot.trim().slice(0, 120);
  if (typeof body.notes === 'string') payload.notes = body.notes.trim().slice(0, 5000);
  if (body.locationId === null || body.locationId === '') {
    payload.locationId = null;
  } else if (body.locationId && mongoose.Types.ObjectId.isValid(body.locationId)) {
    payload.locationId = body.locationId;
  }
  return payload;
};

const resolveBirdMeta = async ({ birdId, name, scientificName }) => {
  let bird = null;
  if (birdId && mongoose.Types.ObjectId.isValid(birdId)) {
    bird = await Bird.findById(birdId).select('_id name scientificName order family').lean();
  }
  if (!bird && name) {
    bird = await Bird.findOne({
      $or: [{ name: String(name).trim() }, { nameAliases: String(name).trim() }],
    })
      .select('_id name scientificName order family')
      .lean();
  }
  if (!bird && scientificName) {
    bird = await Bird.findOne({ scientificName: String(scientificName).trim() })
      .select('_id name scientificName order family')
      .lean();
  }
  if (!bird) {
    return {
      birdId: null,
      name: String(name || '').trim(),
      scientificName: String(scientificName || '').trim(),
      order: '',
      family: '',
    };
  }
  return {
    birdId: bird._id,
    name: bird.name || String(name || '').trim(),
    scientificName: bird.scientificName || String(scientificName || '').trim(),
    order: bird.order || '',
    family: bird.family || '',
  };
};

const ensureSpecies = async (plot, tip) => {
  const meta = await resolveBirdMeta(tip);
  if (!meta.name) {
    const err = new Error('请填写鸟种中文名');
    err.statusCode = 400;
    throw err;
  }
  let idx = findSpeciesIndex(plot, meta);
  if (idx >= 0) {
    const existing = plot.species[idx];
    if (!existing.birdId && meta.birdId) existing.birdId = meta.birdId;
    if (!existing.scientificName && meta.scientificName) {
      existing.scientificName = meta.scientificName;
    }
    if (!existing.order && meta.order) existing.order = meta.order;
    if (!existing.family && meta.family) existing.family = meta.family;
    return { species: existing, index: idx, created: false };
  }
  plot.species.push({
    birdId: meta.birdId,
    name: meta.name,
    scientificName: meta.scientificName,
    order: meta.order,
    family: meta.family,
    firstSeenAt: null,
    lastSeenAt: null,
    times: 0,
    observers: [],
    sources: [],
    notes: typeof tip.notes === 'string' ? tip.notes.trim().slice(0, 2000) : '',
    entries: [],
  });
  idx = plot.species.length - 1;
  return { species: plot.species[idx], index: idx, created: true };
};

const appendEntryToSpecies = (speciesDoc, entryInput, { skipIfExternalKeyExists, plot } = {}) => {
  const date = parseDate(entryInput.date);
  if (!date) {
    const err = new Error('条目需要有效日期');
    err.statusCode = 400;
    throw err;
  }
  const externalKey = String(entryInput.externalKey || '').trim().slice(0, 300);
  if (externalKey && skipIfExternalKeyExists && hasExternalKey(plot, externalKey)) {
    return { skipped: true, reason: 'duplicate_external_key' };
  }
  speciesDoc.entries.push({
    date,
    observer: String(entryInput.observer || '').trim().slice(0, 120),
    source: normalizeSource(entryInput.source),
    reportId: String(entryInput.reportId || '').trim().slice(0, 80),
    locationText: String(entryInput.locationText || '').trim().slice(0, 300),
    externalKey,
    note: String(entryInput.note || '').trim().slice(0, 1000),
  });
  refreshSpeciesRollup(speciesDoc);
  return { skipped: false };
};

const firstBirdImageUrl = (images) => {
  if (!Array.isArray(images) || !images.length) return '';
  const first = images.find((img) => img && (img.url || typeof img === 'string'));
  if (!first) return '';
  return typeof first === 'string' ? String(first).trim() : String(first.url || '').trim();
};

const hashCoverSalt = (input) => {
  const text = String(input || '');
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  }
  return hash;
};

/**
 * 从自留地关联地点 + 报告观测点提取生境图（标注地点名）
 */
const collectPlotHabitatImages = async (plot) => {
  if (!plot) return [];

  const seenLocIds = new Set();
  const byUrl = new Map();
  const representative = [];
  const extras = [];

  const pushLoc = (loc) => {
    if (!loc) return;
    const locId = loc._id ? String(loc._id) : '';
    if (locId) {
      if (seenLocIds.has(locId)) return;
      seenLocIds.add(locId);
    }
    const locName = String(loc.name || '').trim() || '未命名地点';
    const images = Array.isArray(loc.images) ? loc.images : [];
    let firstKept = false;
    images.forEach((img) => {
      const url = typeof img === 'string' ? String(img).trim() : String(img?.url || '').trim();
      if (!url || byUrl.has(url)) return;
      const item = {
        url,
        caption: locName,
        locationId: locId,
        locationName: locName,
      };
      byUrl.set(url, item);
      if (!firstKept) {
        representative.push(item);
        firstKept = true;
      } else {
        extras.push(item);
      }
    });
  };

  const idCandidates = [];
  if (plot.locationId) idCandidates.push(String(plot.locationId));
  (plot.reports || []).forEach((r) => {
    if (r?.locationId) idCandidates.push(String(r.locationId));
  });
  const uniqueIds = [...new Set(idCandidates.filter((id) => mongoose.Types.ObjectId.isValid(id)))].slice(
    0,
    40
  );
  if (uniqueIds.length) {
    const docs = await Location.find({ _id: { $in: uniqueIds }, status: 'active' })
      .select('name images')
      .lean();
    docs.forEach(pushLoc);
  }

  const nameCandidates = new Set();
  (plot.reports || []).forEach((r) => {
    const text = String(r?.locationText || '').trim();
    if (!text) return;
    nameCandidates.add(text);
    const stripped = stripLocationRegionPrefix(text);
    if (stripped) nameCandidates.add(stripped);
  });
  [plot.title, plot.spot, plot.district, plot.city]
    .map((v) => String(v || '').trim())
    .filter(Boolean)
    .forEach((v) => nameCandidates.add(v));

  // 短名优先，提高短观鸟点命中率
  const names = [...nameCandidates]
    .filter(Boolean)
    .sort((a, b) => a.length - b.length)
    .slice(0, 48);

  for (const name of names) {
    try {
      const loc = await findActiveLocationByFlexibleName(Location, name);
      if (loc) pushLoc(typeof loc.toObject === 'function' ? loc.toObject() : loc);
    } catch {
      // ignore single miss
    }
  }

  return [...representative, ...extras].slice(0, 24);
};

// @desc 列出当前用户自留地
// @route GET /api/personal/plots
const listPlots = async (req, res) => {
  try {
    const plots = await PersonalPlot.find({ owner: req.user.id })
      .select(
        'title province city district spot locationId notes statsCache species.birdId species.name reports.locationText reports.locationId createdAt updatedAt'
      )
      .sort({ updatedAt: -1 })
      .lean();

    const birdIds = [];
    const seenBird = new Set();
    plots.forEach((plot) => {
      (plot.species || []).forEach((row) => {
        const id = row?.birdId ? String(row.birdId) : '';
        if (!id || seenBird.has(id)) return;
        seenBird.add(id);
        birdIds.push(id);
      });
    });

    let birdMap = new Map();
    if (birdIds.length) {
      const birds = await Bird.find({
        _id: { $in: birdIds },
        chinaProtectionLevel: { $in: ['国家一级', '国家二级'] },
        'images.0': { $exists: true },
      })
        .select('name chinaProtectionLevel images')
        .lean();
      birdMap = new Map(birds.map((bird) => [String(bird._id), bird]));
    }

    const data = await Promise.all(
      plots.map(async (plot) => {
        const candidates = [];
        (plot.species || []).forEach((row) => {
          const bird = row?.birdId ? birdMap.get(String(row.birdId)) : null;
          if (!bird) return;
          const url = firstBirdImageUrl(bird.images);
          if (!url) return;
          candidates.push({
            url,
            name: bird.name || row.name || '',
            level: bird.chinaProtectionLevel,
          });
        });
        candidates.sort(
          (a, b) =>
            hashCoverSalt(`${plot._id}|${a.name}|${a.url}`) -
            hashCoverSalt(`${plot._id}|${b.name}|${b.url}`)
        );

        const habitatImages = await collectPlotHabitatImages(plot);
        const { species, reports, ...rest } = plot;
        return {
          ...rest,
          // 国一/国二且带图的代表性鸟种，供前端与生境插画随机选用
          coverBirds: candidates.slice(0, 8),
          // 供列表封面优先使用真实生境图
          habitatImages,
        };
      })
    );

    return res.json({ success: true, data });
  } catch (error) {
    return sendControllerError(res, error, {
      defaultMessage: '获取自留地列表失败',
      defaultCode: 'PERSONAL_PLOT_LIST_FAILED',
    });
  }
};

// @desc 创建自留地
// @route POST /api/personal/plots
const createPlot = async (req, res) => {
  try {
    const meta = sanitizePlotMeta(req.body);
    if (!meta.title) {
      return res.status(400).json({ success: false, message: '请填写自留地名称' });
    }
    const plot = await PersonalPlot.create({
      owner: req.user.id,
      ...meta,
      species: [],
      statsCache: {
        speciesCount: 0,
        entryCount: 0,
        reportCount: 0,
        reportsWithBirds: 0,
        updatedAt: new Date(),
      },
    });
    return res.status(201).json({ success: true, data: plot });
  } catch (error) {
    return sendControllerError(res, error, {
      defaultMessage: '创建自留地失败',
      defaultCode: 'PERSONAL_PLOT_CREATE_FAILED',
    });
  }
};

// @desc 自留地详情
// @route GET /api/personal/plots/:id
const getPlotById = async (req, res) => {
  try {
    const plot = await loadOwnedPlot(req.params.id, req.user.id);
    if (!plot) {
      return res.status(404).json({ success: false, message: '自留地不存在' });
    }
    const plain = typeof plot.toObject === 'function' ? plot.toObject() : plot;
    const habitatImages = await collectPlotHabitatImages(plain);
    return res.json({
      success: true,
      data: {
        ...plain,
        habitatImages,
      },
    });
  } catch (error) {
    return sendControllerError(res, error, {
      defaultMessage: '获取自留地失败',
      defaultCode: 'PERSONAL_PLOT_GET_FAILED',
    });
  }
};

// @desc 更新自留地元信息
// @route PUT /api/personal/plots/:id
const updatePlot = async (req, res) => {
  try {
    const plot = await loadOwnedPlot(req.params.id, req.user.id);
    if (!plot) {
      return res.status(404).json({ success: false, message: '自留地不存在' });
    }
    const meta = sanitizePlotMeta(req.body);
    if (meta.title !== undefined && !meta.title) {
      return res.status(400).json({ success: false, message: '名称不能为空' });
    }
    Object.assign(plot, meta);
    await plot.save();
    return res.json({ success: true, data: plot });
  } catch (error) {
    return sendControllerError(res, error, {
      defaultMessage: '更新自留地失败',
      defaultCode: 'PERSONAL_PLOT_UPDATE_FAILED',
    });
  }
};

// @desc 更新单份报告的地点关联（词典 locationId）
// @route PUT /api/personal/plots/:id/reports/:reportId
const updatePlotReport = async (req, res) => {
  try {
    const plot = await loadOwnedPlot(req.params.id, req.user.id);
    if (!plot) {
      return res.status(404).json({ success: false, message: '自留地不存在' });
    }
    const report = findPlotReport(plot, req.params.reportId);
    if (!report) {
      return res.status(404).json({ success: false, message: '报告不存在' });
    }

    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'locationId')) {
      const raw = req.body.locationId;
      if (raw === null || raw === '') {
        report.locationId = null;
      } else if (mongoose.Types.ObjectId.isValid(raw)) {
        report.locationId = raw;
      } else {
        return res.status(400).json({ success: false, message: 'locationId 无效' });
      }
    }

    if (typeof req.body?.locationText === 'string') {
      report.locationText = req.body.locationText.trim().slice(0, 300);
    }

    // Optional: also set/clear the plot-wide primary catalog link
    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'plotLocationId')) {
      const raw = req.body.plotLocationId;
      if (raw === null || raw === '') {
        plot.locationId = null;
      } else if (mongoose.Types.ObjectId.isValid(raw)) {
        plot.locationId = raw;
      }
    }

    await plot.save();
    return res.json({ success: true, data: plot });
  } catch (error) {
    return sendControllerError(res, error, {
      defaultMessage: '更新报告地点失败',
      defaultCode: 'PERSONAL_PLOT_REPORT_UPDATE_FAILED',
    });
  }
};

// @desc 删除自留地
// @route DELETE /api/personal/plots/:id
const deletePlot = async (req, res) => {
  try {
    const plot = await loadOwnedPlot(req.params.id, req.user.id);
    if (!plot) {
      return res.status(404).json({ success: false, message: '自留地不存在' });
    }
    await plot.deleteOne();
    return res.json({ success: true, message: '已删除' });
  } catch (error) {
    return sendControllerError(res, error, {
      defaultMessage: '删除自留地失败',
      defaultCode: 'PERSONAL_PLOT_DELETE_FAILED',
    });
  }
};

// @desc 新增鸟种（可附带首条条目）
// @route POST /api/personal/plots/:id/species
const addSpecies = async (req, res) => {
  try {
    const plot = await loadOwnedPlot(req.params.id, req.user.id);
    if (!plot) {
      return res.status(404).json({ success: false, message: '自留地不存在' });
    }
    const { species, created } = await ensureSpecies(plot, {
      birdId: req.body.birdId,
      name: req.body.name,
      scientificName: req.body.scientificName,
      notes: req.body.notes,
    });
    if (typeof req.body.notes === 'string' && req.body.notes.trim()) {
      species.notes = req.body.notes.trim().slice(0, 2000);
    }
    if (req.body.entry && typeof req.body.entry === 'object') {
      appendEntryToSpecies(species, req.body.entry, {
        skipIfExternalKeyExists: true,
        plot,
      });
    } else {
      refreshSpeciesRollup(species);
    }
    refreshPlotStats(plot);
    await plot.save();
    return res.status(created ? 201 : 200).json({
      success: true,
      data: plot,
      meta: { speciesId: String(species._id), created },
    });
  } catch (error) {
    if (error.statusCode === 400) {
      return res.status(400).json({ success: false, message: error.message });
    }
    return sendControllerError(res, error, {
      defaultMessage: '添加鸟种失败',
      defaultCode: 'PERSONAL_PLOT_ADD_SPECIES_FAILED',
    });
  }
};

// @desc 更新鸟种备注等
// @route PUT /api/personal/plots/:id/species/:speciesId
const updateSpecies = async (req, res) => {
  try {
    const plot = await loadOwnedPlot(req.params.id, req.user.id);
    if (!plot) {
      return res.status(404).json({ success: false, message: '自留地不存在' });
    }
    const species = plot.species.id(req.params.speciesId);
    if (!species) {
      return res.status(404).json({ success: false, message: '鸟种不存在' });
    }
    if (typeof req.body.notes === 'string') {
      species.notes = req.body.notes.trim().slice(0, 2000);
    }
    if (typeof req.body.name === 'string' && req.body.name.trim()) {
      species.name = req.body.name.trim().slice(0, 120);
    }
    if (typeof req.body.scientificName === 'string') {
      species.scientificName = req.body.scientificName.trim().slice(0, 200);
    }
    await plot.save();
    return res.json({ success: true, data: plot });
  } catch (error) {
    return sendControllerError(res, error, {
      defaultMessage: '更新鸟种失败',
      defaultCode: 'PERSONAL_PLOT_UPDATE_SPECIES_FAILED',
    });
  }
};

// @desc 删除鸟种（含条目）
// @route DELETE /api/personal/plots/:id/species/:speciesId
const deleteSpecies = async (req, res) => {
  try {
    const plot = await loadOwnedPlot(req.params.id, req.user.id);
    if (!plot) {
      return res.status(404).json({ success: false, message: '自留地不存在' });
    }
    const species = plot.species.id(req.params.speciesId);
    if (!species) {
      return res.status(404).json({ success: false, message: '鸟种不存在' });
    }
    species.deleteOne();
    refreshPlotStats(plot);
    await plot.save();
    return res.json({ success: true, data: plot });
  } catch (error) {
    return sendControllerError(res, error, {
      defaultMessage: '删除鸟种失败',
      defaultCode: 'PERSONAL_PLOT_DELETE_SPECIES_FAILED',
    });
  }
};

// @desc 按种或按名称追加观察条目（无种则创建）
// @route POST /api/personal/plots/:id/entries
const addEntry = async (req, res) => {
  try {
    const plot = await loadOwnedPlot(req.params.id, req.user.id);
    if (!plot) {
      return res.status(404).json({ success: false, message: '自留地不存在' });
    }

    let species = null;
    if (req.body.speciesId) {
      species = plot.species.id(req.body.speciesId);
      if (!species) {
        return res.status(404).json({ success: false, message: '鸟种不存在' });
      }
    } else {
      const ensured = await ensureSpecies(plot, {
        birdId: req.body.birdId,
        name: req.body.name,
        scientificName: req.body.scientificName,
      });
      species = ensured.species;
    }

    const result = appendEntryToSpecies(
      species,
      {
        date: req.body.date,
        observer: req.body.observer,
        source: req.body.source || 'manual',
        externalKey: req.body.externalKey,
        note: req.body.note,
      },
      { skipIfExternalKeyExists: true, plot }
    );
    if (result.skipped) {
      return res.status(409).json({
        success: false,
        message: '该外部条目已存在，已跳过',
        code: 'DUPLICATE_EXTERNAL_KEY',
      });
    }
    refreshPlotStats(plot);
    await plot.save();
    return res.status(201).json({ success: true, data: plot });
  } catch (error) {
    if (error.statusCode === 400) {
      return res.status(400).json({ success: false, message: error.message });
    }
    return sendControllerError(res, error, {
      defaultMessage: '添加条目失败',
      defaultCode: 'PERSONAL_PLOT_ADD_ENTRY_FAILED',
    });
  }
};

// @desc 删除条目
// @route DELETE /api/personal/plots/:id/species/:speciesId/entries/:entryId
const deleteEntry = async (req, res) => {
  try {
    const plot = await loadOwnedPlot(req.params.id, req.user.id);
    if (!plot) {
      return res.status(404).json({ success: false, message: '自留地不存在' });
    }
    const species = plot.species.id(req.params.speciesId);
    if (!species) {
      return res.status(404).json({ success: false, message: '鸟种不存在' });
    }
    const entry = species.entries.id(req.params.entryId);
    if (!entry) {
      return res.status(404).json({ success: false, message: '条目不存在' });
    }
    entry.deleteOne();
    refreshSpeciesRollup(species);
    refreshPlotStats(plot);
    await plot.save();
    return res.json({ success: true, data: plot });
  } catch (error) {
    return sendControllerError(res, error, {
      defaultMessage: '删除条目失败',
      defaultCode: 'PERSONAL_PLOT_DELETE_ENTRY_FAILED',
    });
  }
};

const scopeHint = (plot, session) => {
  const hints = [];
  const soft = (a, b, label) => {
    const left = String(a || '').trim();
    const right = String(b || '').trim();
    if (!left || !right) return;
    if (left !== right && !left.includes(right) && !right.includes(left)) {
      hints.push(`${label}不一致：自留地「${left}」vs 文件「${right}」`);
    }
  };
  soft(plot.province, session.province, '省');
  soft(plot.city, session.city, '市');
  soft(plot.district, session.district, '区县');
  soft(plot.spot, session.point, '点位');
  return hints;
};

// @desc CBRC 导入到自留地：报告列表 / 报告鸟种 / 宽表报告 / 总清单（不写 Record）
// @route POST /api/personal/plots/:id/import/cbrc
const importCbrcToPlot = async (req, res) => {
  try {
    const plot = await loadOwnedPlot(req.params.id, req.user.id);
    if (!plot) {
      return res.status(404).json({ success: false, message: '自留地不存在' });
    }
    const rows = req.body?.rows;
    if (!Array.isArray(rows) || rows.length < 2) {
      return res.status(400).json({
        success: false,
        message: '请提供二维数组：表头 + 数据行',
      });
    }

    const defaultObserver = String(req.body.defaultObserver || '').trim().slice(0, 120);
    const defaultDate = parseDate(req.body.defaultDate) || new Date();
    const force = req.body.force !== false;
    const forcedMode = String(req.body.mode || '').trim(); // report_list | report_birds | auto
    const bodyReportId = String(req.body.reportId || '').trim();

    // —— 1) 报告列表（报告编号 + 时间/地点/用户）——
    if (forcedMode === 'report_list' || (!forcedMode && findReportListHeaderIndex(rows) >= 0)) {
      const parsed = parseReportListRows(rows);
      if (parsed.error) {
        return res.status(400).json({ success: false, message: parsed.error });
      }
      let added = 0;
      let updated = 0;
      parsed.reports.forEach((r) => {
        const existed = Boolean(findPlotReport(plot, r.reportId));
        upsertPlotReport(plot, r);
        if (existed) updated += 1;
        else added += 1;
      });
      refreshPlotStats(plot);
      await plot.save();
      return res.json({
        success: true,
        data: plot,
        summary: {
          mode: 'report_list',
          added,
          updated,
          skippedDup: updated,
          skippedInvalid: 0,
          unmatchedKept: 0,
          fileCount: parsed.reports.length,
          reportCount: plot.reports.length,
          hint:
            added === 0 && updated > 0
              ? `文件 ${parsed.reports.length} 份报告均已存在，已刷新元信息。请继续上传鸟种明细。`
              : `文件 ${parsed.reports.length} 份：新增 ${added}，已有并刷新 ${updated}。请继续上传各报告的鸟种明细表。`,
        },
      });
    }

    // —— 2) 报告鸟种明细（可指定 reportId）——
    const looksLikeReportBirds =
      forcedMode === 'report_birds' ||
      (!forcedMode && findReportBirdsHeaderIndex(rows) >= 0);
    if (looksLikeReportBirds) {
      const parsed = parseReportBirdsRows(rows);
      if (parsed.error) {
        return res.status(400).json({ success: false, message: parsed.error });
      }

      let added = 0;
      let skippedDup = 0;
      let skippedInvalid = 0;
      let unmatchedKept = 0;
      let missingReport = 0;
      const touchedReports = new Map();

      for (const bird of parsed.birds) {
        const reportId = bird.reportId || bodyReportId;
        if (!reportId) {
          missingReport += 1;
          continue;
        }
        let reportMeta = findPlotReport(plot, reportId);
        if (!reportMeta) {
          // 明细先到、列表未传：先建占位报告
          reportMeta = upsertPlotReport(plot, {
            reportId,
            startAt: defaultDate,
            endAt: null,
            timeRaw: '',
            observer: defaultObserver,
            locationText: '',
            speciesCountHint: 0,
            publicStatus: '',
          });
        }

        const { species } = await ensureSpecies(plot, {
          name: bird.name,
          scientificName: bird.scientificName,
        });
        if (!species.birdId) unmatchedKept += 1;
        if (bird.order && !species.order) species.order = bird.order;
        if (bird.family && !species.family) species.family = bird.family;

        const observer = reportMeta.observer || defaultObserver;
        const date = reportMeta.startAt || defaultDate;
        const externalKey = `${reportId}|${bird.code || bird.name}`;
        const result = appendEntryToSpecies(
          species,
          {
            date,
            observer,
            source: 'cbrc',
            reportId,
            locationText: reportMeta.locationText || '',
            externalKey,
            note: bird.count > 1 ? `数量 ${bird.count}` : '',
          },
          { skipIfExternalKeyExists: true, plot }
        );
        if (result.skipped) skippedDup += 1;
        else {
          added += 1;
          touchedReports.set(reportId, (touchedReports.get(reportId) || 0) + 1);
        }
      }

      if (missingReport > 0 && added === 0) {
        return res.status(400).json({
          success: false,
          message:
            '鸟种明细缺少报告编号。请先导入报告列表，并在导入时选择对应报告编号；或使用带「报告编号」列的明细表。',
        });
      }

      touchedReports.forEach((count, reportId) => {
        const reportMeta = findPlotReport(plot, reportId);
        if (!reportMeta) return;
        reportMeta.birdsImported = (reportMeta.birdsImported || 0) + count;
        reportMeta.importedAt = new Date();
      });

      refreshPlotStats(plot);
      await plot.save();
      return res.json({
        success: true,
        data: plot,
        summary: {
          mode: 'report_birds',
          added,
          skippedDup,
          skippedInvalid,
          unmatchedKept,
          missingReport,
          reportsTouched: touchedReports.size,
          hint:
            missingReport > 0
              ? `有 ${missingReport} 行因缺少报告编号已跳过。`
              : '鸟种已关联到报告；种级汇总已更新。',
        },
      });
    }

    // —— 3) 宽表「报告」导出（一行一种 + 开始时间）——
    const built = await buildCbrcPlan(rows);
    if (!built.error) {
      const scopeWarnings = [];
      let added = 0;
      let skippedDup = 0;
      let skippedInvalid = 0;
      let unmatchedKept = 0;

      for (const item of built.plan) {
        if (item.status === 'bad_date') {
          skippedInvalid += 1;
          continue;
        }
        const hints = scopeHint(plot, {
          province: item.province,
          city: item.city,
          district: item.district,
          point: item.point,
        });
        if (hints.length) {
          scopeWarnings.push(...hints.map((h) => `会话#${item.index + 1}: ${h}`));
          if (!force) continue;
        }

        if (item.reportId) {
          upsertPlotReport(plot, {
            reportId: item.reportId,
            startAt: item.date,
            endAt: null,
            timeRaw: item.dateDisplay || '',
            observer: defaultObserver,
            locationText: item.locationDisplay || '',
            speciesCountHint: (item.birdsResolved || []).length,
            publicStatus: '',
          });
        }

        const date = item.date;
        const birds = Array.isArray(item.birdsResolved) ? item.birdsResolved : [];
        let sessionAdded = 0;
        for (const bird of birds) {
          const name = bird.chineseName || '';
          if (!name) {
            skippedInvalid += 1;
            continue;
          }
          if (!bird.matched) unmatchedKept += 1;

          const { species } = await ensureSpecies(plot, {
            birdId: bird.birdId,
            name,
            scientificName: bird.latinName || '',
          });

          const dayKey = date ? date.toISOString().slice(0, 10) : 'nodate';
          const idPart = bird.birdId || name;
          const externalKey = `${item.reportId || 'noreport'}|${dayKey}|${idPart}`;

          const result = appendEntryToSpecies(
            species,
            {
              date: date || defaultDate,
              observer: defaultObserver,
              source: 'cbrc',
              reportId: item.reportId || '',
              locationText: item.locationDisplay || '',
              externalKey,
              note: item.locationDisplay || '',
            },
            { skipIfExternalKeyExists: true, plot }
          );
          if (result.skipped) skippedDup += 1;
          else {
            added += 1;
            sessionAdded += 1;
          }
        }
        if (item.reportId && sessionAdded > 0) {
          const reportMeta = findPlotReport(plot, item.reportId);
          if (reportMeta) {
            reportMeta.birdsImported = (reportMeta.birdsImported || 0) + sessionAdded;
            reportMeta.importedAt = new Date();
          }
        }
      }

      refreshPlotStats(plot);
      await plot.save();

      return res.json({
        success: true,
        data: plot,
        summary: {
          mode: 'report',
          added,
          skippedDup,
          skippedInvalid,
          unmatchedKept,
          sessionCount: built.plan.length,
          scopeWarningCount: scopeWarnings.length,
          scopeWarnings: scopeWarnings.slice(0, 20),
        },
      });
    }

    // —— 4) 总鸟种清单（仅种+次数）——
    const listParsed = parsePlotSpeciesListRows(rows);
    if (listParsed.error) {
      return res.status(400).json({
        success: false,
        message:
          '无法识别表格。请上传：①报告列表（报告编号+观测时间/地点）；②报告鸟种明细（中文名，并选择报告编号）；或宽表报告 / 总清单。',
      });
    }

    let added = 0;
    let skippedDup = 0;
    let unmatchedKept = 0;
    const dayKey = defaultDate.toISOString().slice(0, 10);

    for (const bird of listParsed.species) {
      const { species, created } = await ensureSpecies(plot, {
        name: bird.name,
        scientificName: bird.scientificName,
      });
      if (!species.birdId) unmatchedKept += 1;
      if (created || !species.order) {
        if (bird.order) species.order = bird.order;
        if (bird.family) species.family = bird.family;
      }

      const externalKey = `specieslist|${bird.code || bird.name}|${dayKey}`;
      const noteParts = [];
      if (bird.recordCount > 0) noteParts.push(`原清单记录次数 ${bird.recordCount}`);
      const result = appendEntryToSpecies(
        species,
        {
          date: defaultDate,
          observer: defaultObserver,
          source: 'cbrc',
          externalKey,
          note: noteParts.join('；'),
        },
        { skipIfExternalKeyExists: true, plot }
      );
      if (result.skipped) skippedDup += 1;
      else added += 1;
    }

    refreshPlotStats(plot);
    await plot.save();

    return res.json({
      success: true,
      data: plot,
      summary: {
        mode: 'species_list',
        added,
        skippedDup,
        skippedInvalid: 0,
        unmatchedKept,
        speciesListCount: listParsed.species.length,
        hint: '已按总清单导入（无场次信息）。完整账本请用「报告列表 + 报告鸟种明细」。',
      },
    });
  } catch (error) {
    return sendControllerError(res, error, {
      defaultMessage: '导入自留地失败',
      defaultCode: 'PERSONAL_PLOT_CBRC_IMPORT_FAILED',
    });
  }
};

module.exports = {
  listPlots,
  createPlot,
  getPlotById,
  updatePlot,
  updatePlotReport,
  deletePlot,
  addSpecies,
  updateSpecies,
  deleteSpecies,
  addEntry,
  deleteEntry,
  importCbrcToPlot,
  // for tests / reuse
  refreshSpeciesRollup,
  refreshPlotStats,
};
