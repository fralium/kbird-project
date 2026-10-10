const RegionBirdList = require('../models/regionBirdListModel');
const Bird = require('../models/birdModel');
const Record = require('../models/recordModel');
const Location = require('../models/locationModel');
const { sendControllerError } = require('../middleware/controllerError');
const { clearCache } = require('../middleware/cache');
const { canonicalizeBirdName } = require('../../data/birdNameAliases');

const MAX_SPECIES = 20000;

const normalizeSciKey = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');

const sciBinomialKey = (value) => {
  const parts = normalizeSciKey(value).split(' ').filter(Boolean);
  if (parts.length >= 2) return `${parts[0]} ${parts[1]}`;
  return parts[0] || '';
};

const normalizeNameKey = (value) =>
  canonicalizeBirdName(String(value || '').trim()).replace(/\s+/g, '');

const firstBirdImageUrl = (images) => {
  if (!Array.isArray(images) || !images.length) return '';
  const first = images.find((img) => img && (img.url || typeof img === 'string'));
  if (!first) return '';
  return typeof first === 'string' ? String(first).trim() : String(first.url || '').trim();
};

const attachRegionListCovers = async (rows) => {
  if (!Array.isArray(rows) || !rows.length) return rows;

  const birdIds = [];
  const seenBird = new Set();
  rows.forEach((row) => {
    (row.species || []).forEach((s) => {
      const id = s?.birdId ? String(s.birdId) : '';
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
    birdMap = new Map(birds.map((b) => [String(b._id), b]));
  }

  const locIds = [
    ...new Set(
      rows
        .map((row) => (row.locationId ? String(row.locationId) : ''))
        .filter(Boolean)
    ),
  ];
  let locMap = new Map();
  if (locIds.length) {
    const locs = await Location.find({ _id: { $in: locIds } })
      .select('name images')
      .lean();
    locMap = new Map(locs.map((loc) => [String(loc._id), loc]));
  }

  return rows.map((row) => {
    const { species, ...rest } = row;
    const coverBirds = [];
    (species || []).forEach((s) => {
      const bird = s?.birdId ? birdMap.get(String(s.birdId)) : null;
      if (!bird) return;
      const url = firstBirdImageUrl(bird.images);
      if (!url) return;
      coverBirds.push({
        url,
        name: bird.name || s.name || '',
        level: bird.chinaProtectionLevel,
      });
    });
    coverBirds.sort((a, b) => {
      const rank = (lv) => (lv === '国家一级' ? 0 : lv === '国家二级' ? 1 : 2);
      const d = rank(a.level) - rank(b.level);
      if (d !== 0) return d;
      return String(a.name).localeCompare(String(b.name), 'zh');
    });

    const loc = row.locationId ? locMap.get(String(row.locationId)) : null;
    const habitatImageUrl = loc ? firstBirdImageUrl(loc.images) : '';

    return {
      ...rest,
      coverBirds: coverBirds.slice(0, 8),
      habitatImageUrl,
    };
  });
};

const toIdString = (ref) => {
  if (!ref) return '';
  if (ref._id) return String(ref._id);
  return String(ref);
};

/** 当前用户已见鸟种匹配键（id / 中文名 / 学名） */
const buildObservedMatchKeys = async (userId) => {
  const records = await Record.find({
    observer: userId,
    status: { $ne: 'draft' },
  })
    .select('birds.birdId')
    .lean();

  const idSet = new Set();
  for (const rec of records) {
    for (const bird of rec.birds || []) {
      const bid = toIdString(bird?.birdId);
      if (bid) idSet.add(bid);
    }
  }

  const nameSet = new Set();
  const sciSet = new Set();
  if (idSet.size > 0) {
    const birds = await Bird.find({ _id: { $in: [...idSet] } })
      .select('name scientificName')
      .lean();
    birds.forEach((bird) => {
      const name = normalizeNameKey(bird.name);
      if (name) nameSet.add(name);
      const sci = normalizeSciKey(bird.scientificName);
      if (sci) sciSet.add(sci);
      const bin = sciBinomialKey(bird.scientificName);
      if (bin) sciSet.add(bin);
    });
  }

  return { idSet, nameSet, sciSet };
};

const isSpeciesObserved = (item, keys) => {
  const bid = toIdString(item?.birdId);
  if (bid && keys.idSet.has(bid)) return true;
  const name = normalizeNameKey(item?.name);
  if (name && keys.nameSet.has(name)) return true;
  const sci = normalizeSciKey(item?.scientificName);
  if (sci && keys.sciSet.has(sci)) return true;
  const bin = sciBinomialKey(item?.scientificName);
  if (bin && keys.sciSet.has(bin)) return true;
  return false;
};

const countSeenSpecies = (species, keys) => {
  if (!Array.isArray(species) || !keys) return 0;
  let seen = 0;
  for (const item of species) {
    if (isSpeciesObserved(item, keys)) seen += 1;
  }
  return seen;
};

const sendClientError = (res, status, message, code) =>
  res.status(status).json({ success: false, message, code });

const parseVersionYear = (raw) => {
  if (raw == null || String(raw).trim() === '') return undefined;
  const year = Number.parseInt(String(raw), 10);
  return Number.isFinite(year) && year >= 1900 && year <= 2100 ? year : undefined;
};

const parseVersionMonth = (raw) => {
  if (raw == null || String(raw).trim() === '') return undefined;
  const month = Number.parseInt(String(raw), 10);
  return Number.isFinite(month) && month >= 1 && month <= 12 ? month : undefined;
};

const parseAdminDivision = (body = {}) => {
  const province = String(body.province || '').trim();
  const city = String(body.city || '').trim();
  const district = String(body.district || '').trim();
  const spot = String(body.spot || '').trim();
  let locationId = null;
  if (body.locationId) {
    const raw = String(body.locationId).trim();
    if (/^[a-fA-F0-9]{24}$/.test(raw)) locationId = raw;
  }
  const regionKey = String(
    body.regionKey || [province, city, district, spot].filter(Boolean).join('/')
  ).trim();
  return { province, city, district, spot, locationId, regionKey };
};

const canManageList = (doc, user) => {
  if (!user) return false;
  if (user.role === 'admin') return true;
  const ownerId = doc.uploadedBy?._id || doc.uploadedBy;
  return ownerId && String(ownerId) === String(user._id);
};

const normalizeSpecies = (rawList) => {
  if (!Array.isArray(rawList)) return [];
  return rawList
    .map((item) => {
      const name = String(item?.name || item?.chineseName || '').trim();
      const scientificName = String(item?.scientificName || item?.latinName || '').trim();
      if (!name && !scientificName) return null;
      const recordCount = Number.parseInt(String(item?.recordCount ?? item?.count ?? 0), 10);
      return {
        code: String(item?.code || item?.id || '').trim(),
        name: name || scientificName,
        scientificName,
        englishName: String(item?.englishName || '').trim(),
        order: String(item?.order || '').trim(),
        family: String(item?.family || '').trim(),
        recordCount: Number.isFinite(recordCount) && recordCount >= 0 ? recordCount : 0,
        birdId: null,
      };
    })
    .filter(Boolean);
};

const linkSpeciesToBirds = async (species) => {
  if (!species.length) return species;
  try {
    const hasAnyName = species.some((s) => String(s.name || '').trim());
    const hasAnySci = species.some((s) => String(s.scientificName || '').trim());
    if (!hasAnyName && !hasAnySci) return species;

    // 名录可能很大：按中文名/学名精确匹配，未命中再回退 binomial；并吃全局异名表与鸟种 nameAliases
    const birds = await Bird.find({}).select('_id name scientificName nameAliases').lean();
    const byName = new Map();
    const bySci = new Map();
    const byBinomial = new Map();
    birds.forEach((b) => {
      const id = b._id;
      const main = String(b.name || '').trim();
      if (main && !byName.has(main)) byName.set(main, id);
      (b.nameAliases || []).forEach((alias) => {
        const key = String(alias || '').trim();
        if (key && !byName.has(key)) byName.set(key, id);
      });
      const full = normalizeSciKey(b.scientificName);
      const bin = sciBinomialKey(b.scientificName);
      if (full && !bySci.has(full)) bySci.set(full, id);
      if (bin && !byBinomial.has(bin)) byBinomial.set(bin, id);
    });

    return species.map((item) => {
      if (item.birdId) return item;
      const rawName = String(item.name || '').trim();
      const canonical = canonicalizeBirdName(rawName);
      const sciFull = normalizeSciKey(item.scientificName);
      const sciBin = sciBinomialKey(item.scientificName);
      const birdId =
        byName.get(rawName) ||
        byName.get(canonical) ||
        bySci.get(sciFull) ||
        byBinomial.get(sciBin) ||
        null;
      return { ...item, birdId };
    });
  } catch (error) {
    // 关联失败不阻断清单保存
    return species;
  }
};

/** 物种对比/合并主键：code > 中文名 > 学名（与清单 diff 一致） */
const speciesMatchKey = (item) => {
  const code = String(item?.code || '').trim().toLowerCase();
  if (code) return `code:${code}`;
  const name = normalizeNameKey(item?.name);
  if (name) return `name:${name}`;
  const bin = sciBinomialKey(item?.scientificName);
  if (bin) return `sci:${bin}`;
  const sci = normalizeSciKey(item?.scientificName);
  if (sci) return `sci:${sci}`;
  return '';
};

const cloneSpeciesRow = (item) => ({
  code: String(item?.code || '').trim(),
  name: String(item?.name || '').trim(),
  scientificName: String(item?.scientificName || '').trim(),
  englishName: String(item?.englishName || '').trim(),
  order: String(item?.order || '').trim(),
  family: String(item?.family || '').trim(),
  recordCount:
    Number.isFinite(Number(item?.recordCount)) && Number(item.recordCount) >= 0
      ? Number(item.recordCount)
      : 0,
  birdId: item?.birdId || null,
});

const diffSpeciesLists = (currentList = [], nextList = []) => {
  const currentMap = new Map();
  (currentList || []).forEach((item) => {
    const key = speciesMatchKey(item);
    if (key && !currentMap.has(key)) currentMap.set(key, item);
  });
  const nextMap = new Map();
  (nextList || []).forEach((item) => {
    const key = speciesMatchKey(item);
    if (key && !nextMap.has(key)) nextMap.set(key, item);
  });

  const added = [];
  const removed = [];
  let unchangedCount = 0;

  nextMap.forEach((item, key) => {
    if (currentMap.has(key)) unchangedCount += 1;
    else added.push(cloneSpeciesRow(item));
  });
  currentMap.forEach((item, key) => {
    if (!nextMap.has(key)) removed.push(cloneSpeciesRow(item));
  });

  return { added, removed, unchangedCount };
};

const formatVersionLabel = (year, month) => {
  const y = Number(year);
  const m = Number(month);
  if (Number.isFinite(y) && Number.isFinite(m) && m >= 1 && m <= 12) {
    return `${y}年${m}月`;
  }
  if (Number.isFinite(y)) return `${y}年`;
  return '未标注版本';
};

// GET /api/region-lists
const listRegionBirdLists = async (req, res) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(200, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;
    const q = String(req.query.q || '').trim();
    const withProgress = Boolean(req.user);

    const filter = {};
    if (String(req.query.exactDivision || '') === '1') {
      filter.province = String(req.query.province || '').trim();
      filter.city = String(req.query.city || '').trim();
      filter.district = String(req.query.district || '').trim();
      filter.spot = String(req.query.spot || '').trim();
    } else if (q) {
      filter.$or = [
        { regionName: { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } },
        { title: { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } },
        { province: { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } },
        { city: { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } },
        { district: { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } },
        { spot: { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } },
        { source: { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } },
      ];
    }

    const listSelect =
      'regionName title province city district spot locationId year versionMonth speciesCount uploadedBy createdAt updatedAt species.birdId species.name';

    const [total, rows, observedKeys] = await Promise.all([
      RegionBirdList.countDocuments(filter),
      RegionBirdList.find(filter)
        .select(listSelect)
        .populate('uploadedBy', 'name')
        .sort({ province: 1, city: 1, district: 1, spot: 1, regionName: 1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      withProgress ? buildObservedMatchKeys(req.user.id || req.user._id) : Promise.resolve(null),
    ]);

    const withCovers = await attachRegionListCovers(rows);
    const data = withCovers.map((row) => {
      const speciesCount = Number(row.speciesCount) || 0;
      const payload = { ...row, speciesCount };
      if (withProgress && observedKeys) {
        const original = rows.find((r) => String(r._id) === String(row._id));
        const seenCount = countSeenSpecies(original?.species, observedKeys);
        payload.seenCount = seenCount;
        payload.unseenCount = Math.max(0, speciesCount - seenCount);
      }
      return payload;
    });

    res.status(200).json({
      success: true,
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (error) {
    return sendControllerError(res, error, {
      defaultMessage: '获取各地鸟种列表失败',
      defaultCode: 'REGION_LIST_FETCH_FAILED',
    });
  }
};

// GET /api/region-lists/:id
const getRegionBirdList = async (req, res) => {
  try {
    const doc = await RegionBirdList.findById(req.params.id)
      .populate('uploadedBy', 'name')
      .lean();
    if (!doc) {
      return sendClientError(res, 404, '未找到该地区鸟种清单', 'REGION_LIST_NOT_FOUND');
    }

    const search = String(req.query.search || '').trim().toLowerCase();
    const order = String(req.query.order || '').trim();
    const family = String(req.query.family || '').trim();
    const sortBy = String(req.query.sortBy || 'recordCount');
    const sortOrder = String(req.query.sortOrder || 'desc') === 'asc' ? 1 : -1;

    let species = Array.isArray(doc.species)
      ? doc.species.map((item, storageIndex) => ({ ...item, storageIndex }))
      : [];
    // 读取时补齐 birdId，兼容旧上传未关联或名录变更
    const needsLink = species.some((item) => !item?.birdId);
    if (needsLink) {
      const linked = await linkSpeciesToBirds(species);
      species = linked.map((item, idx) => ({
        ...item,
        storageIndex:
          item.storageIndex != null ? item.storageIndex : species[idx]?.storageIndex ?? idx,
      }));
    }
    if (search) {
      species = species.filter((item) => {
        const hay = `${item.code || ''} ${item.name || ''} ${item.scientificName || ''} ${item.englishName || ''}`.toLowerCase();
        return hay.includes(search);
      });
    }
    if (order) {
      // 目筛选：支持中文别名 / 拉丁名互通（如 啄木鸟目 ↔ Piciformes ↔ 鴷形目）
      const orderNeedle = String(order).trim().toLowerCase();
      species = species.filter((item) => {
        const raw = String(item.order || '').trim();
        if (!raw) return false;
        if (raw === order || raw.toLowerCase() === orderNeedle) return true;
        // loose: both resolve via client; server keeps simple includes for latin/cn
        return (
          raw.toLowerCase().includes(orderNeedle) ||
          orderNeedle.includes(raw.toLowerCase())
        );
      });
    }
    if (family) species = species.filter((item) => item.family === family);

    species.sort((a, b) => {
      const av = a[sortBy];
      const bv = b[sortBy];
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * sortOrder;
      return String(av || '').localeCompare(String(bv || ''), 'zh') * sortOrder;
    });

    const orders = [...new Set((doc.species || []).map((s) => s.order).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b, 'zh')
    );
    const families = [...new Set((doc.species || []).map((s) => s.family).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b, 'zh')
    );

    res.status(200).json({
      success: true,
      data: {
        ...doc,
        species,
        filterOptions: { orders, families },
        filteredCount: species.length,
      },
    });
  } catch (error) {
    return sendControllerError(res, error, {
      defaultMessage: '获取地区鸟种详情失败',
      defaultCode: 'REGION_LIST_DETAIL_FAILED',
    });
  }
};

// POST /api/region-lists
const createRegionBirdList = async (req, res) => {
  try {
    const regionName = String(req.body?.regionName || '').trim();
    if (!regionName) {
      return sendClientError(res, 400, '请填写地区名称', 'MISSING_REGION_NAME');
    }

    const speciesInput = normalizeSpecies(req.body?.species);
    if (speciesInput.length === 0) {
      return sendClientError(res, 400, '未解析到有效鸟种数据', 'EMPTY_SPECIES');
    }
    if (speciesInput.length > MAX_SPECIES) {
      return sendClientError(
        res,
        400,
        `鸟种过多（${speciesInput.length}），最多 ${MAX_SPECIES} 种`,
        'TOO_MANY_SPECIES'
      );
    }

    const species = await linkSpeciesToBirds(speciesInput);
    const totalRecordCount = species.reduce((sum, item) => sum + (item.recordCount || 0), 0);
    const year = parseVersionYear(req.body?.year);
    const versionMonth = parseVersionMonth(req.body?.versionMonth ?? req.body?.month);
    const { province, city, district, spot, locationId, regionKey } = parseAdminDivision(req.body);

    if (!province) {
      return sendClientError(res, 400, '请选择省份', 'MISSING_PROVINCE');
    }

    const existing = await RegionBirdList.findOne({
      province,
      city: city || '',
      district: district || '',
      spot: spot || '',
    })
      .select('_id regionName year versionMonth spot')
      .lean();
    if (existing) {
      return res.status(409).json({
        success: false,
        message: `「${existing.regionName}」已有清单，请打开后发布新版本，而不是重复创建`,
        code: 'REGION_LIST_EXISTS',
        data: {
          _id: existing._id,
          regionName: existing.regionName,
          year: existing.year,
          versionMonth: existing.versionMonth,
          spot: existing.spot,
        },
      });
    }

    let doc;
    try {
      doc = await RegionBirdList.create({
        regionName,
        province,
        city,
        district,
        spot,
        locationId,
        regionKey,
        title: String(req.body?.title || `${regionName}鸟种清单`).trim(),
        source: String(req.body?.source || '观鸟记录中心').trim() || '观鸟记录中心',
        year,
        versionMonth,
        originalFilename: String(req.body?.originalFilename || '').trim(),
        speciesCount: species.length,
        totalRecordCount,
        species,
        uploadedBy: req.user?._id,
      });
    } catch (createError) {
      if (createError?.code === 11000) {
        return res.status(409).json({
          success: false,
          message: '该省市区/鸟点已有清单，请打开后发布新版本',
          code: 'REGION_LIST_EXISTS',
        });
      }
      throw createError;
    }

    clearCache('/api/region-lists');

    res.status(201).json({
      success: true,
      data: {
        _id: doc._id,
        regionName: doc.regionName,
        province: doc.province,
        city: doc.city,
        district: doc.district,
        spot: doc.spot,
        locationId: doc.locationId,
        title: doc.title,
        speciesCount: doc.speciesCount,
        totalRecordCount: doc.totalRecordCount,
      },
      message: `已保存「${doc.regionName}」共 ${doc.speciesCount} 种`,
    });
  } catch (error) {
    return sendControllerError(res, error, {
      defaultMessage: '保存地区鸟种清单失败',
      defaultCode: 'REGION_LIST_CREATE_FAILED',
    });
  }
};

// PUT /api/region-lists/:id — 编辑清单信息（不含物种表）
const updateRegionBirdList = async (req, res) => {
  try {
    const doc = await RegionBirdList.findById(req.params.id);
    if (!doc) {
      return sendClientError(res, 404, '未找到该地区鸟种清单', 'REGION_LIST_NOT_FOUND');
    }
    if (!canManageList(doc, req.user)) {
      return sendClientError(res, 403, '无权编辑此清单', 'REGION_LIST_UPDATE_FORBIDDEN');
    }

    if (req.body?.regionName !== undefined) {
      const regionName = String(req.body.regionName || '').trim();
      if (!regionName) {
        return sendClientError(res, 400, '请填写地区名称', 'MISSING_REGION_NAME');
      }
      doc.regionName = regionName;
    }
    if (req.body?.title !== undefined) {
      doc.title = String(req.body.title || '').trim();
    }
    if (req.body?.source !== undefined) {
      doc.source = String(req.body.source || '').trim() || '观鸟记录中心';
    }
    if (req.body?.year !== undefined) {
      const y = parseVersionYear(req.body.year);
      doc.year = y === undefined ? null : y;
    }
    if (req.body?.versionMonth !== undefined || req.body?.month !== undefined) {
      const m = parseVersionMonth(req.body.versionMonth ?? req.body.month);
      doc.versionMonth = m === undefined ? null : m;
    }
    if (
      req.body?.province !== undefined ||
      req.body?.city !== undefined ||
      req.body?.district !== undefined ||
      req.body?.spot !== undefined ||
      req.body?.locationId !== undefined ||
      req.body?.regionKey !== undefined
    ) {
      const next = parseAdminDivision({
        province: req.body.province !== undefined ? req.body.province : doc.province,
        city: req.body.city !== undefined ? req.body.city : doc.city,
        district: req.body.district !== undefined ? req.body.district : doc.district,
        spot: req.body.spot !== undefined ? req.body.spot : doc.spot,
        locationId:
          req.body.locationId !== undefined ? req.body.locationId : doc.locationId,
        regionKey: req.body.regionKey,
      });
      if (req.body?.province !== undefined && !next.province) {
        return sendClientError(res, 400, '请选择省份', 'MISSING_PROVINCE');
      }
      const conflict = await RegionBirdList.findOne({
        _id: { $ne: doc._id },
        province: next.province,
        city: next.city || '',
        district: next.district || '',
        spot: next.spot || '',
      })
        .select('_id regionName')
        .lean();
      if (conflict) {
        return sendClientError(
          res,
          409,
          `与「${conflict.regionName}」地区/鸟点重复，请调整后再保存`,
          'REGION_LIST_EXISTS'
        );
      }
      doc.province = next.province;
      doc.city = next.city;
      doc.district = next.district;
      doc.spot = next.spot;
      doc.locationId = next.locationId;
      doc.regionKey = next.regionKey;
    }

    await doc.save();
    clearCache('/api/region-lists');

    res.status(200).json({
      success: true,
      data: {
        _id: doc._id,
        regionName: doc.regionName,
        province: doc.province,
        city: doc.city,
        district: doc.district,
        spot: doc.spot,
        locationId: doc.locationId,
        title: doc.title,
        source: doc.source,
        year: doc.year,
        versionMonth: doc.versionMonth,
        regionKey: doc.regionKey,
        speciesCount: doc.speciesCount,
        totalRecordCount: doc.totalRecordCount,
      },
      message: '清单信息已更新',
    });
  } catch (error) {
    if (error?.code === 11000) {
      return sendClientError(
        res,
        409,
        '与已有清单的省市区/鸟点冲突，请调整后再保存',
        'REGION_LIST_EXISTS'
      );
    }
    return sendControllerError(res, error, {
      defaultMessage: '更新地区鸟种清单失败',
      defaultCode: 'REGION_LIST_UPDATE_FAILED',
    });
  }
};

// DELETE /api/region-lists/:id
const deleteRegionBirdList = async (req, res) => {
  try {
    const doc = await RegionBirdList.findById(req.params.id);
    if (!doc) {
      return sendClientError(res, 404, '未找到该地区鸟种清单', 'REGION_LIST_NOT_FOUND');
    }

    if (!canManageList(doc, req.user)) {
      return sendClientError(res, 403, '无权删除此清单', 'REGION_LIST_DELETE_FORBIDDEN');
    }

    await doc.deleteOne();
    clearCache('/api/region-lists');

    res.status(200).json({
      success: true,
      message: '已删除',
    });
  } catch (error) {
    return sendControllerError(res, error, {
      defaultMessage: '删除地区鸟种清单失败',
      defaultCode: 'REGION_LIST_DELETE_FAILED',
    });
  }
};

// POST /api/region-lists/:id/versions/preview
const previewRegionBirdListVersion = async (req, res) => {
  try {
    const doc = await RegionBirdList.findById(req.params.id).lean();
    if (!doc) {
      return sendClientError(res, 404, '未找到该地区鸟种清单', 'REGION_LIST_NOT_FOUND');
    }
    if (!canManageList(doc, req.user)) {
      return sendClientError(res, 403, '无权发布此清单的新版本', 'REGION_LIST_VERSION_FORBIDDEN');
    }

    const year = parseVersionYear(req.body?.year);
    const versionMonth = parseVersionMonth(req.body?.versionMonth ?? req.body?.month);
    if (!year || !versionMonth) {
      return sendClientError(res, 400, '请指定新版本的年份与月份', 'MISSING_VERSION');
    }

    const sameAsCurrent =
      Number(doc.year) === year && Number(doc.versionMonth) === versionMonth;
    if (sameAsCurrent) {
      return sendClientError(
        res,
        400,
        `当前已是 ${formatVersionLabel(year, versionMonth)}版本，请换一个年月`,
        'DUPLICATE_VERSION'
      );
    }

    const speciesInput = normalizeSpecies(req.body?.species);
    if (speciesInput.length === 0) {
      return sendClientError(res, 400, '未解析到有效鸟种数据', 'EMPTY_SPECIES');
    }
    if (speciesInput.length > MAX_SPECIES) {
      return sendClientError(
        res,
        400,
        `鸟种过多（${speciesInput.length}），最多 ${MAX_SPECIES} 种`,
        'TOO_MANY_SPECIES'
      );
    }

    const nextSpecies = await linkSpeciesToBirds(speciesInput);
    const { added, removed, unchangedCount } = diffSpeciesLists(doc.species || [], nextSpecies);

    res.status(200).json({
      success: true,
      data: {
        currentVersion: {
          year: doc.year,
          versionMonth: doc.versionMonth,
          label: formatVersionLabel(doc.year, doc.versionMonth),
          speciesCount: doc.speciesCount || (doc.species || []).length,
        },
        nextVersion: {
          year,
          versionMonth,
          label: formatVersionLabel(year, versionMonth),
          speciesCount: nextSpecies.length,
        },
        added,
        removed,
        unchangedCount,
        addedCount: added.length,
        removedCount: removed.length,
      },
    });
  } catch (error) {
    return sendControllerError(res, error, {
      defaultMessage: '版本对比失败',
      defaultCode: 'REGION_LIST_VERSION_PREVIEW_FAILED',
    });
  }
};

// POST /api/region-lists/:id/versions — 确认发布新版本
const publishRegionBirdListVersion = async (req, res) => {
  try {
    const doc = await RegionBirdList.findById(req.params.id);
    if (!doc) {
      return sendClientError(res, 404, '未找到该地区鸟种清单', 'REGION_LIST_NOT_FOUND');
    }
    if (!canManageList(doc, req.user)) {
      return sendClientError(res, 403, '无权发布此清单的新版本', 'REGION_LIST_VERSION_FORBIDDEN');
    }

    const year = parseVersionYear(req.body?.year);
    const versionMonth = parseVersionMonth(req.body?.versionMonth ?? req.body?.month);
    if (!year || !versionMonth) {
      return sendClientError(res, 400, '请指定新版本的年份与月份', 'MISSING_VERSION');
    }

    const sameAsCurrent =
      Number(doc.year) === year && Number(doc.versionMonth) === versionMonth;
    if (sameAsCurrent) {
      return sendClientError(
        res,
        400,
        `当前已是 ${formatVersionLabel(year, versionMonth)}版本，请换一个年月`,
        'DUPLICATE_VERSION'
      );
    }

    const speciesInput = normalizeSpecies(req.body?.species);
    if (speciesInput.length === 0) {
      return sendClientError(res, 400, '未解析到有效鸟种数据', 'EMPTY_SPECIES');
    }
    if (speciesInput.length > MAX_SPECIES) {
      return sendClientError(
        res,
        400,
        `鸟种过多（${speciesInput.length}），最多 ${MAX_SPECIES} 种`,
        'TOO_MANY_SPECIES'
      );
    }

    const nextSpecies = await linkSpeciesToBirds(speciesInput);
    const { added, removed, unchangedCount } = diffSpeciesLists(doc.species || [], nextSpecies);
    const totalRecordCount = nextSpecies.reduce((sum, item) => sum + (item.recordCount || 0), 0);
    const originalFilename = String(req.body?.originalFilename || '').trim();

    doc.versionHistory = doc.versionHistory || [];
    doc.versionHistory.unshift({
      year: doc.year,
      versionMonth: doc.versionMonth,
      speciesCount: doc.speciesCount || (doc.species || []).length,
      originalFilename: doc.originalFilename || '',
      publishedAt: new Date(),
      uploadedBy: req.user?._id,
      changes: { added, removed },
      nextYear: year,
      nextVersionMonth: versionMonth,
    });

    doc.species = nextSpecies;
    doc.speciesCount = nextSpecies.length;
    doc.totalRecordCount = totalRecordCount;
    doc.year = year;
    doc.versionMonth = versionMonth;
    if (originalFilename) doc.originalFilename = originalFilename;

    await doc.save();
    clearCache('/api/region-lists');

    res.status(200).json({
      success: true,
      data: {
        _id: doc._id,
        year: doc.year,
        versionMonth: doc.versionMonth,
        speciesCount: doc.speciesCount,
        totalRecordCount: doc.totalRecordCount,
        originalFilename: doc.originalFilename,
        versionHistory: doc.versionHistory,
        diff: {
          addedCount: added.length,
          removedCount: removed.length,
          unchangedCount,
        },
      },
      message: `已发布 ${formatVersionLabel(year, versionMonth)}版本（+${added.length} / -${removed.length}）`,
    });
  } catch (error) {
    return sendControllerError(res, error, {
      defaultMessage: '发布新版本失败',
      defaultCode: 'REGION_LIST_VERSION_PUBLISH_FAILED',
    });
  }
};

// POST /api/region-lists/:id/species/link — 将清单行关联到鸟种库 birdId
const linkRegionSpeciesToCatalog = async (req, res) => {
  try {
    const doc = await RegionBirdList.findById(req.params.id);
    if (!doc) {
      return sendClientError(res, 404, '未找到该地区鸟种清单', 'REGION_LIST_NOT_FOUND');
    }
    if (!canManageList(doc, req.user)) {
      return sendClientError(res, 403, '无权修改此清单', 'REGION_LIST_LINK_FORBIDDEN');
    }

    const speciesIndex = Number.parseInt(
      String(req.body?.storageIndex ?? req.body?.speciesIndex),
      10
    );
    const birdId = req.body?.birdId;
    if (!Number.isFinite(speciesIndex) || speciesIndex < 0 || speciesIndex >= doc.species.length) {
      return sendClientError(res, 400, '无效的鸟种行', 'INVALID_SPECIES_INDEX');
    }
    if (!birdId) {
      return sendClientError(res, 400, '缺少鸟种 ID', 'MISSING_BIRD_ID');
    }

    const bird = await Bird.findById(birdId).select('_id name scientificName').lean();
    if (!bird) {
      return sendClientError(res, 404, '鸟种库中不存在该记录', 'BIRD_NOT_FOUND');
    }

    // 可选：用名称二次校验，避免前端传错下标
    const expectName = String(req.body?.name || '').trim();
    const row = doc.species[speciesIndex];
    if (expectName && row?.name && String(row.name).trim() !== expectName) {
      const byName = doc.species.findIndex((s) => String(s?.name || '').trim() === expectName);
      if (byName >= 0) {
        doc.species[byName].birdId = bird._id;
        await doc.save();
        clearCache('/api/region-lists');
        return res.status(200).json({
          success: true,
          data: {
            speciesIndex: byName,
            storageIndex: byName,
            birdId: bird._id,
            name: bird.name,
            scientificName: bird.scientificName,
          },
          message: `已关联「${bird.name}」`,
        });
      }
      return sendClientError(res, 400, '行下标与鸟种名不一致', 'SPECIES_INDEX_NAME_MISMATCH');
    }

    doc.species[speciesIndex].birdId = bird._id;
    await doc.save();
    clearCache('/api/region-lists');

    res.status(200).json({
      success: true,
      data: {
        speciesIndex,
        storageIndex: speciesIndex,
        birdId: bird._id,
        name: bird.name,
        scientificName: bird.scientificName,
      },
      message: `已关联「${bird.name}」`,
    });
  } catch (error) {
    return sendControllerError(res, error, {
      defaultMessage: '关联鸟种失败',
      defaultCode: 'REGION_LIST_LINK_FAILED',
    });
  }
};

module.exports = {
  listRegionBirdLists,
  getRegionBirdList,
  createRegionBirdList,
  updateRegionBirdList,
  deleteRegionBirdList,
  previewRegionBirdListVersion,
  publishRegionBirdListVersion,
  linkRegionSpeciesToCatalog,
};
