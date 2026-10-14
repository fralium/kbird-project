const Location = require('../models/locationModel');
const Record = require('../models/recordModel');
const { clearCache } = require('../middleware/cache');
const { sendControllerError } = require('../middleware/controllerError');
const { devLog, devError } = require('../utils/devLogger');
const { getTempUploadsRoot } = require('../config/dataPaths');
const {
  stripLocationRegionPrefix,
  normalizeLocationName,
  resolveCanonicalLocationName,
  buildLocationRecordMatchers,
  findActiveLocationByFlexibleName,
} = require('../utils/locationName');
const {
  publicPublishedRecordFilter,
  publicNonDraftRecordFilter,
} = require('../utils/publicRecordFilter');

// 统一：仅统计已发布的观鸟记录
const RECORD_STATUS_PUBLISHED = 'published';

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** 地点关键词：子串匹配名称、描述、地址、标签（中文友好，不依赖 text 索引分词） */
function applyLocationSearchToQuery(query, search) {
  const q = String(search || '').trim();
  if (!q) return;
  const rx = new RegExp(escapeRegex(q), 'i');
  query.$or = [
    { name: rx },
    { description: rx },
    { 'address.province': rx },
    { 'address.city': rx },
    { 'address.district': rx },
    { 'address.street': rx },
    { tags: rx },
  ];
}

async function buildLocationStatsMap(locationNames) {
  const normalizedNames = [...new Set((locationNames || []).map(normalizeLocationName).filter(Boolean))];
  if (normalizedNames.length === 0) {
    return new Map();
  }

  const canonicalSet = new Set(normalizedNames);
  const nameMatchers = normalizedNames.flatMap((name) => buildLocationRecordMatchers(name));

  const records = await Record.find(
    publicPublishedRecordFilter({
      $or: nameMatchers,
    })
  )
    .select('location.name location.address birds.birdId')
    .limit(5000)
    .lean();

  const statsMap = new Map(
    normalizedNames.map((name) => [
      name,
      {
        totalRecords: 0,
        totalSightings: 0,
        uniqueSpecies: 0,
        _birdIds: new Set(),
        district: '',
        city: '',
        province: '',
      },
    ])
  );

  records.forEach((record) => {
    const canonical = resolveCanonicalLocationName(
      record?.location?.name,
      record?.location?.address?.detail || record?.location?.address?.street,
      canonicalSet
    );
    const bucket = statsMap.get(canonical);
    if (!bucket) return;
    bucket.totalRecords += 1;
    bucket.totalSightings += 1;
    const addr = record?.location?.address || {};
    if (!bucket.district && String(addr.district || '').trim()) {
      bucket.district = String(addr.district).trim();
      bucket.city = String(addr.city || '').trim();
      bucket.province = String(addr.province || '').trim();
    }
    (Array.isArray(record.birds) ? record.birds : []).forEach((bird) => {
      const id = bird?.birdId;
      if (id) bucket._birdIds.add(String(id));
    });
  });

  const result = new Map();
  statsMap.forEach((value, key) => {
    result.set(key, {
      totalRecords: value.totalRecords,
      totalSightings: value.totalSightings,
      uniqueSpecies: value._birdIds.size,
      district: value.district,
      city: value.city,
      province: value.province,
    });
  });
  return result;
}

function mergeLocationAddressFromRecordStats(address, stats) {
  const next = {
    province: String(address?.province || '').trim(),
    city: String(address?.city || '').trim(),
    district: String(address?.district || '').trim(),
    street: String(address?.street || address?.detail || '').trim(),
  };
  if (!next.district && stats?.district) next.district = String(stats.district).trim();
  if (!next.city && stats?.city) next.city = String(stats.city).trim();
  if (!next.province && stats?.province) next.province = String(stats.province).trim();
  return next;
}

async function persistFilledLocationAddress(locations, previousById) {
  const writes = [];
  locations.forEach((loc) => {
    const prev = previousById.get(String(loc._id));
    const district = String(loc.address?.district || '').trim();
    if (!district || String(prev?.district || '').trim()) return;
    writes.push(
      Location.updateOne(
        { _id: loc._id },
        {
          $set: {
            'address.district': district,
            ...(loc.address?.city ? { 'address.city': loc.address.city } : {}),
            ...(loc.address?.province ? { 'address.province': loc.address.province } : {}),
          },
        }
      )
    );
  });
  if (writes.length) await Promise.all(writes);
}

function attachLocationStats(locations, statsMap) {
  const previousById = new Map();
  const withStats = locations.map((loc) => {
    const nameKey = normalizeLocationName(loc.name);
    const stats = statsMap.get(nameKey) || {
      totalRecords: 0,
      totalSightings: 0,
      uniqueSpecies: 0,
    };
    previousById.set(String(loc._id), { district: loc.address?.district || '' });
    return {
      ...loc,
      address: mergeLocationAddressFromRecordStats(loc.address, stats),
      stats: {
        totalRecords: stats.totalRecords || 0,
        totalSightings: stats.totalSightings || 0,
        uniqueSpecies: stats.uniqueSpecies || 0,
        lastVisited: loc.stats?.lastVisited,
      },
    };
  });
  persistFilledLocationAddress(withStats, previousById).catch((err) => {
    devError('回写地点区县失败:', err);
  });
  return withStats;
}

// 为单个地点从 Record 计算观察次数与鸟类种类（共用逻辑）
async function computeLocationStats(location) {
  const statsMap = await buildLocationStatsMap([location?.name]);
  const key = normalizeLocationName(location?.name);
  const stats = statsMap.get(key) || {
    totalRecords: 0,
    totalSightings: 0,
    uniqueSpecies: 0,
  };
  return {
    ...stats,
    lastVisited: location.stats?.lastVisited,
  };
}

// @desc    获取所有地点
// @route   GET /api/locations
// @access  Public
const getLocations = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      type,
      city,
      province,
      sortBy = 'name',
      sortOrder = 'asc',
      suggestions,
    } = req.query;

    // 搜索建议（前端 ?suggestions=true&search=）
    if (suggestions === 'true' || suggestions === true) {
      const q = String(search || '').trim();
      if (!q) {
        return res.status(200).json({ success: true, suggestions: [] });
      }
      const sugQuery = { status: 'active' };
      applyLocationSearchToQuery(sugQuery, q);
      const locs = await Location.find(sugQuery)
        .select('name')
        .sort({ name: 1 })
        .limit(20)
        .lean();
      const seen = new Set();
      const names = [];
      for (const l of locs) {
        if (l.name && !seen.has(l.name)) {
          seen.add(l.name);
          names.push(l.name);
        }
      }
      return res.status(200).json({ success: true, suggestions: names });
    }

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    let query = { status: 'active' };

    applyLocationSearchToQuery(query, search);
    if (type) {
      query.type = type;
    }
    if (city) {
      query['address.city'] = new RegExp(escapeRegex(city), 'i');
    }
    if (province === '未标注') {
      // 小结里的「未标注」对应空/缺省省份，不能按字面量「未标注」匹配
      query.$and = [
        ...(query.$and || []),
        {
          $or: [
            { address: { $exists: false } },
            { 'address.province': { $exists: false } },
            { 'address.province': null },
            { 'address.province': '' },
            { 'address.province': /^\s*$/ },
          ],
        },
      ];
    } else if (province) {
      query['address.province'] = new RegExp(escapeRegex(province), 'i');
    }

    const sortByStats = sortBy === 'stats.totalRecords' || sortBy === 'stats.uniqueSpecies';
    const isDesc = sortOrder === 'desc';
    /** 按统计排序需在内存完成；桌面场景地点量有限，硬顶防止无界加载 */
    const LOCATION_STATS_SORT_CAP = 3000;

    let locations;
    let total;

    if (sortByStats) {
      total = await Location.countDocuments(query);
      locations = await Location.find(query)
        .populate('createdBy', 'name avatar')
        .select('-images.photographer')
        .limit(LOCATION_STATS_SORT_CAP)
        .lean();

      const statsMap = await buildLocationStatsMap(locations.map((loc) => loc.name));
      const locationsWithStats = attachLocationStats(locations, statsMap);

      const key = sortBy === 'stats.totalRecords' ? 'totalRecords' : 'uniqueSpecies';
      locationsWithStats.sort((a, b) => {
        const va = a.stats[key] || 0;
        const vb = b.stats[key] || 0;
        return isDesc ? vb - va : va - vb;
      });

      const effectiveTotal = Math.min(total, LOCATION_STATS_SORT_CAP);
      const paginated = locationsWithStats.slice(skip, skip + limitNum);

      return res.status(200).json({
        success: true,
        data: paginated,
        pagination: {
          currentPage: pageNum,
          totalPages: Math.ceil(effectiveTotal / limitNum) || 1,
          totalItems: effectiveTotal,
          itemsPerPage: limitNum,
          hasNextPage: pageNum < Math.ceil(effectiveTotal / limitNum),
          hasPrevPage: pageNum > 1,
          capped: total > LOCATION_STATS_SORT_CAP,
        }
      });
    }

    // 非按统计排序：按字段排序后分页，再为当前页计算统计
    let sort = {};
    if (sortBy === 'distance' && req.query.lat && req.query.lng) {
      query.coordinates = {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [parseFloat(req.query.lng), parseFloat(req.query.lat)]
          },
          $maxDistance: 50000
        }
      };
    } else {
      sort[sortBy] = isDesc ? -1 : 1;
    }

    locations = await Location.find(query)
      .populate('createdBy', 'name avatar')
      .sort(sort)
      .skip(skip)
      .limit(limitNum)
      .select('-images.photographer');

    total = await Location.countDocuments(query);

    const plainLocations = locations.map((location) => location.toObject());
    const statsMap = await buildLocationStatsMap(plainLocations.map((location) => location.name));
    const locationsWithStats = attachLocationStats(plainLocations, statsMap);

    res.status(200).json({
      success: true,
      data: locationsWithStats,
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(total / limitNum) || 1,
        totalItems: total,
        itemsPerPage: limitNum,
        hasNextPage: pageNum < Math.ceil(total / limitNum),
        hasPrevPage: pageNum > 1
      }
    });
  } catch (error) {
    return sendControllerError(res, error, {
      defaultMessage: '获取地点列表失败',
      defaultCode: 'LOCATION_OPERATION_FAILED',
    });
  }
};

// @desc    按名称获取一个地点（用于记录详情页解析坐标）
// @route   GET /api/locations/by-name?name=xxx
// @access  Public
const getLocationByName = async (req, res) => {
  try {
    const name = (req.query.name || '').trim();
    if (!name) {
      const missingNameError = new Error('请提供 name 参数');
      missingNameError.statusCode = 400;
      missingNameError.code = 'MISSING_LOCATION_NAME';
      return sendControllerError(res, missingNameError, {
        defaultMessage: '请提供 name 参数',
        defaultCode: 'MISSING_LOCATION_NAME',
        fallbackStatus: 400,
      });
    }
    // Query-style lookup: miss is a successful empty result (not a missing resource path).
    // Callers treat this as optional dictionary match; 404 would spam browsers on expected misses.
    const location = await findActiveLocationByFlexibleName(Location, name);
    if (!location) {
      return res.status(200).json({
        success: true,
        data: null,
        message: '未找到该名称的地点',
        code: 'LOCATION_NOT_FOUND',
      });
    }
    res.status(200).json({ success: true, data: location });
  } catch (error) {
    return sendControllerError(res, error, {
      defaultMessage: '按名称查询地点失败',
      defaultCode: 'LOCATION_FETCH_FAILED',
    });
  }
};

// @desc    获取单个地点详情
// @route   GET /api/locations/:id
// @access  Public
const getLocation = async (req, res) => {
  try {
    const location = await Location.findById(req.params.id)
      .populate('createdBy', 'name avatar')
      .populate('images.photographer', 'name avatar');

    if (!location) {
      const notFoundError = new Error('地点不存在');
      notFoundError.statusCode = 404;
      notFoundError.code = 'LOCATION_NOT_FOUND';
      return sendControllerError(res, notFoundError, {
        defaultMessage: '地点不存在',
        defaultCode: 'LOCATION_NOT_FOUND',
        fallbackStatus: 404,
      });
    }

    if (location.status !== 'active') {
      const notFoundError = new Error('地点不存在');
      notFoundError.statusCode = 404;
      notFoundError.code = 'LOCATION_NOT_FOUND';
      return sendControllerError(res, notFoundError, {
        defaultMessage: '地点不存在',
        defaultCode: 'LOCATION_NOT_FOUND',
        fallbackStatus: 404,
      });
    }

    // 使用Record数据计算实际的观察记录统计数据（与列表统计同一套模糊匹配）
    const Record = require('../models/recordModel');
    const nameMatchers = buildLocationRecordMatchers(location.name);
    const LOCATION_DETAIL_RECORD_CAP = 2000;
    const recordsAtLocation = nameMatchers.length
      ? await Record.find(
          publicPublishedRecordFilter({
            $or: nameMatchers,
          })
        )
          .select('birds.birdId date')
          .populate('birds.birdId', 'name scientificName')
          .limit(LOCATION_DETAIL_RECORD_CAP)
          .lean()
      : [];

    // 统计该地点观察到的鸟类种类数
    const uniqueBirdIds = new Set();
    const birdSpecies = [];
    recordsAtLocation.forEach(record => {
      (record.birds || []).forEach(bird => {
        const birdDoc = bird?.birdId;
        if (!birdDoc?._id) return;
        uniqueBirdIds.add(birdDoc._id.toString());
        birdSpecies.push({
          _id: birdDoc._id,
          name: birdDoc.name,
          scientificName: birdDoc.scientificName
        });
      });
    });

    // 统计常见鸟类（基于Record数据）
    const birdCountMap = new Map();
    birdSpecies.forEach(bird => {
      const key = bird._id.toString();
      if (birdCountMap.has(key)) {
        birdCountMap.set(key, birdCountMap.get(key) + 1);
      } else {
        birdCountMap.set(key, 1);
      }
    });
    
    const commonSpecies = Array.from(birdCountMap.entries())
      .map(([birdId, count]) => {
        const bird = birdSpecies.find(b => b._id.toString() === birdId);
        return {
          _id: bird._id,
          name: bird.name,
          scientificName: bird.scientificName,
          count: count
        };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const now = new Date();
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const speciesSetAllTime = new Set();
    const speciesSetBeforeMonth = new Set();
    const speciesSetThisMonth = new Set();
    const speciesSetLast7Days = new Set();
    const speciesSetLast30Days = new Set();
    const recentSpeciesCountMap = new Map();
    let lastObservedAt = null;

    recordsAtLocation.forEach(record => {
      const observedAt = record.date ? new Date(record.date) : null;
      if (observedAt && !Number.isNaN(observedAt.getTime())) {
        if (!lastObservedAt || observedAt > lastObservedAt) {
          lastObservedAt = observedAt;
        }
      }

      (record.birds || []).forEach(item => {
        const birdDoc = item.birdId;
        if (!birdDoc?._id) return;
        const birdIdStr = birdDoc._id.toString();

        speciesSetAllTime.add(birdIdStr);

        if (observedAt && observedAt < monthStart) {
          speciesSetBeforeMonth.add(birdIdStr);
        }
        if (observedAt && observedAt >= monthStart) {
          speciesSetThisMonth.add(birdIdStr);
        }
        if (observedAt && observedAt >= sevenDaysAgo) {
          speciesSetLast7Days.add(birdIdStr);
        }
        if (observedAt && observedAt >= thirtyDaysAgo) {
          speciesSetLast30Days.add(birdIdStr);
          const existing = recentSpeciesCountMap.get(birdIdStr) || {
            _id: birdDoc._id,
            name: birdDoc.name,
            scientificName: birdDoc.scientificName,
            count: 0,
          };
          existing.count += Number(item.count) > 0 ? Number(item.count) : 1;
          recentSpeciesCountMap.set(birdIdStr, existing);
        }
      });
    });

    const newSpeciesThisMonth = Array.from(speciesSetThisMonth).filter(
      (birdId) => !speciesSetBeforeMonth.has(birdId)
    ).length;

    const topRecentSpecies = Array.from(recentSpeciesCountMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    // 更新地点的统计数据
    const actualStats = {
      totalRecords: recordsAtLocation.length,
      totalSightings: recordsAtLocation.length, // 保持兼容性
      uniqueSpecies: uniqueBirdIds.size,
      lastVisited: location.stats?.lastVisited
    };

    // 创建包含实际统计数据的响应对象
    const locationWithStats = {
      ...location.toObject(),
      stats: actualStats,
      hotspotStats: {
        recent7DaysSpecies: speciesSetLast7Days.size,
        recent30DaysSpecies: speciesSetLast30Days.size,
        newSpeciesThisMonth,
        totalSpeciesAllTime: speciesSetAllTime.size,
        lastObservedAt,
        topRecentSpecies,
      },
      birdStats: {
        totalSpecies: actualStats.uniqueSpecies,
        commonSpecies: commonSpecies,
        rareSpecies: [] // 可以根据需要添加稀有鸟类逻辑
      }
    };

    res.status(200).json({
      success: true,
      data: locationWithStats,
    });
  } catch (error) {
    return sendControllerError(res, error, {
      defaultMessage: '获取地点详情失败',
      defaultCode: 'LOCATION_OPERATION_FAILED',
    });
  }
};

// @desc    创建新地点
// @route   POST /api/locations
// @access  Private
const createLocation = async (req, res) => {
  try {
    const {
      name,
      description,
      coordinates,
      address,
      type,
      environment,
      birding,
      facilities,
      tags
    } = req.body;

    const locationName = normalizeLocationName(name);
    if (!locationName) {
      const missingNameError = new Error('地点名称不能为空');
      missingNameError.statusCode = 400;
      missingNameError.code = 'MISSING_LOCATION_NAME';
      return sendControllerError(res, missingNameError, {
        defaultMessage: '地点名称不能为空',
        defaultCode: 'MISSING_LOCATION_NAME',
        fallbackStatus: 400,
      });
    }

    const rawCoords = Array.isArray(coordinates)
      ? coordinates
      : coordinates?.coordinates || [];
    const lng = Number(rawCoords[0]);
    const lat = Number(rawCoords[1]);
    if (!Number.isFinite(lng) || !Number.isFinite(lat) || (lng === 0 && lat === 0)) {
      const missingCoordsError = new Error('请设置有效的经纬度坐标');
      missingCoordsError.statusCode = 400;
      missingCoordsError.code = 'MISSING_LOCATION_COORDINATES';
      return sendControllerError(res, missingCoordsError, {
        defaultMessage: '请设置有效的经纬度坐标',
        defaultCode: 'MISSING_LOCATION_COORDINATES',
        fallbackStatus: 400,
      });
    }

    // 查重：精确名（任意状态）+ 灵活匹配已有活跃地点（去前缀等）
    const existingExact = await Location.findOne({ name: locationName });
    const existingFlexible =
      existingExact || (await findActiveLocationByFlexibleName(Location, locationName));
    if (existingFlexible) {
      const duplicateError = new Error(
        existingFlexible.name === locationName
          ? '地点名称已存在'
          : `地点已存在为「${existingFlexible.name}」，请勿重复添加`
      );
      duplicateError.statusCode = 400;
      duplicateError.code = 'DUPLICATE_LOCATION_NAME';
      return sendControllerError(res, duplicateError, {
        defaultMessage: '地点名称已存在',
        defaultCode: 'DUPLICATE_LOCATION_NAME',
        fallbackStatus: 400,
      });
    }

    const normalizedAddress = address
      ? {
          province: address.province ?? '',
          city: address.city ?? '',
          district: address.district ?? '',
          street: address.street ?? address.detail ?? '',
        }
      : {};

    const locationData = {
      name: locationName,
      description,
      coordinates: {
        type: 'Point',
        coordinates: [lng, lat],
      },
      address: normalizedAddress,
      type: type || '其他',
      environment: environment || {},
      birding: birding || {},
      facilities: facilities || {},
      tags: tags || [],
      createdBy: req.user.id,
    };

    const location = await Location.create(locationData);

    await location.populate('createdBy', 'name avatar');

    // 清除地点列表缓存，确保新地点立即显示
    clearCache('/api/locations');

    res.status(201).json({
      success: true,
      message: '地点创建成功',
      data: location,
    });
  } catch (error) {
    return sendControllerError(res, error, {
      defaultMessage: '创建地点失败',
      defaultCode: 'LOCATION_OPERATION_FAILED',
    });
  }
};

// 前端「观鸟难度」与 schema enum 的映射（前端用简单/中等/困难，schema 用初级/中级/高级）
const DIFFICULTY_MAP = { '简单': '初级', '中等': '中级', '困难': '高级' };

const LOCATION_TYPE_ENUM = [
  '公园',
  '自然保护区',
  '湿地',
  '森林',
  '山区',
  '城市',
  '乡村',
  '海岸',
  '湖泊',
  '河流',
  '其他',
];
const WATER_SOURCE_ENUM = ['有水源', '无水源', '季节性水源'];
const ENV_ACCESS_ENUM = [
  '容易到达',
  '需要步行',
  '需要爬山',
  '需要特殊装备',
  '限制进入',
];
/** 前端曾用「农田」等写法，映射到合法 enum */
const TYPE_ALIASES = { 农田: '乡村' };
/** 前端「需要坐船」等映射到 schema */
const ACCESS_ALIASES = { 需要坐船: '需要特殊装备' };

function normalizeLocationType(value) {
  const v = String(value || '').trim();
  if (TYPE_ALIASES[v]) return TYPE_ALIASES[v];
  if (LOCATION_TYPE_ENUM.includes(v)) return v;
  return '其他';
}

function normalizeWaterSource(value) {
  const v = String(value || '').trim();
  if (WATER_SOURCE_ENUM.includes(v)) return v;
  if (v && /水|湖|河|溪|池|湿|泉|塘|库/i.test(v)) return '有水源';
  return '无水源';
}

function normalizeEnvAccessibility(fromBirding, fromEnv) {
  const raw = String(fromBirding || fromEnv || '').trim();
  const mapped = ACCESS_ALIASES[raw] || raw;
  if (ENV_ACCESS_ENUM.includes(mapped)) return mapped;
  return '容易到达';
}

// @desc    更新地点
// @route   PUT /api/locations/:id
// @access  Private
const updateLocation = async (req, res) => {
  try {
    const location = await Location.findById(req.params.id);

    if (!location) {
      const notFoundError = new Error('地点不存在');
      notFoundError.statusCode = 404;
      notFoundError.code = 'LOCATION_NOT_FOUND';
      return sendControllerError(res, notFoundError, {
        defaultMessage: '地点不存在',
        defaultCode: 'LOCATION_NOT_FOUND',
        fallbackStatus: 404,
      });
    }

    // 检查权限：创建者或管理员可修改
    const isCreator = location.createdBy && location.createdBy.toString() === req.user.id;
    const isAdmin = req.user.role === 'admin';
    if (!isCreator && !isAdmin) {
      const forbiddenError = new Error('无权限修改此地点');
      forbiddenError.statusCode = 403;
      forbiddenError.code = 'LOCATION_UPDATE_FORBIDDEN';
      return sendControllerError(res, forbiddenError, {
        defaultMessage: '无权限修改此地点',
        defaultCode: 'LOCATION_UPDATE_FORBIDDEN',
        fallbackStatus: 403,
      });
    }

    const oldName = location.name;

    // 显式白名单，禁止 status/images/$operator 等 mass assignment
    const body = {};
    const src = req.body || {};
    for (const key of Object.keys(src)) {
      if (key.startsWith('$')) {
        const forbiddenError = new Error('非法更新字段');
        forbiddenError.statusCode = 400;
        forbiddenError.code = 'LOCATION_INVALID_UPDATE';
        return sendControllerError(res, forbiddenError, {
          defaultMessage: '非法更新字段',
          defaultCode: 'LOCATION_INVALID_UPDATE',
          fallbackStatus: 400,
        });
      }
    }

    if (src.name != null) body.name = src.name;
    if (src.description != null) body.description = src.description;
    if (src.type != null) body.type = src.type;
    if (src.coordinates != null) body.coordinates = src.coordinates;
    if (src.address != null) body.address = src.address;
    if (src.environment != null) body.environment = src.environment;
    if (src.birding != null) body.birding = src.birding;
    if (src.facilities != null) body.facilities = src.facilities;
    if (src.tags != null) body.tags = src.tags;
    if (src.notes != null) body.notes = src.notes;

    if (body.type != null) {
      body.type = normalizeLocationType(body.type);
    }

    if (body.coordinates) {
      const coords = body.coordinates?.coordinates || body.coordinates;
      const arr = Array.isArray(coords) ? coords : [coords?.longitude ?? coords?.[0], coords?.latitude ?? coords?.[1]];
      const lng = Number(arr[0]);
      const lat = Number(arr[1]);
      if (!Number.isFinite(lng) || !Number.isFinite(lat) || (lng === 0 && lat === 0)) {
        const badCoordsError = new Error('请设置有效的经纬度坐标');
        badCoordsError.statusCode = 400;
        badCoordsError.code = 'MISSING_LOCATION_COORDINATES';
        return sendControllerError(res, badCoordsError, {
          defaultMessage: '请设置有效的经纬度坐标',
          defaultCode: 'MISSING_LOCATION_COORDINATES',
          fallbackStatus: 400,
        });
      }
      body.coordinates = {
        type: 'Point',
        coordinates: [lng, lat],
      };
    }
    // address: schema 为 province/city/district/street（前端可能传 detail）
    if (body.address) {
      body.address = {
        province: body.address.province ?? '',
        city: body.address.city ?? '',
        district: body.address.district ?? '',
        street: body.address.street ?? body.address.detail ?? '',
      };
    }
    // environment: schema 为 habitat [String], vegetation [String], waterSource, accessibility
    // 前端水源多为自由文本；可达性在 birding.accessibility，需写入 environment.accessibility
    if (body.environment || body.birding) {
      const toArr = (v) => (Array.isArray(v) ? v : (v != null && v !== '' ? [String(v)] : []));
      const envIn = body.environment || {};
      body.environment = {
        habitat: toArr(envIn.habitat),
        vegetation: toArr(envIn.vegetation),
        waterSource: normalizeWaterSource(envIn.waterSource),
        accessibility: normalizeEnvAccessibility(
          body.birding?.accessibility,
          envIn.accessibility
        ),
      };
    }
    // birding: schema 为 bestSeason [String], commonSpecies [String], rareSpecies [String], difficulty（前端可能传 bestTime/facilities/accessibility）
    if (body.birding) {
      const toArr = (v) => (Array.isArray(v) ? v : (v != null && v !== '' ? [String(v)] : []));
      body.birding = {
        bestSeason: toArr(body.birding.bestSeason ?? body.birding.bestTime),
        commonSpecies: toArr(body.birding.commonSpecies),
        rareSpecies: toArr(body.birding.rareSpecies),
        difficulty: DIFFICULTY_MAP[body.birding.difficulty] || body.birding.difficulty || '初级',
      };
    }
    // facilities: schema 为 parking/restroom/shelter/observationPlatform/informationBoard（前端可能传 observationDeck/trail）
    if (body.facilities) {
      body.facilities = {
        parking: !!body.facilities.parking,
        restroom: !!body.facilities.restroom,
        shelter: body.facilities.shelter ?? body.facilities.trail ?? false,
        observationPlatform: body.facilities.observationPlatform ?? body.facilities.observationDeck ?? false,
        informationBoard: !!body.facilities.informationBoard,
      };
    }

    const updatedLocation = await Location.findByIdAndUpdate(
      req.params.id,
      { $set: body },
      { new: true, runValidators: true }
    ).populate('createdBy', 'name avatar');

    // 同步到「当前用户」使用该地点名的观鸟记录（避免改写他人记录坐标）
    const locCoords = updatedLocation.coordinates?.coordinates;
    const hasValidLocCoords =
      Array.isArray(locCoords) &&
      locCoords.length >= 2 &&
      Number.isFinite(Number(locCoords[0])) &&
      Number.isFinite(Number(locCoords[1])) &&
      !(Number(locCoords[0]) === 0 && Number(locCoords[1]) === 0);

    const recordLocationPayload = {
      'location.name': updatedLocation.name,
      'location.address': {
        province: updatedLocation.address?.province ?? '',
        city: updatedLocation.address?.city ?? '',
        district: updatedLocation.address?.district ?? '',
        detail: updatedLocation.address?.street ?? updatedLocation.address?.detail ?? '',
      },
    };
    if (hasValidLocCoords) {
      recordLocationPayload['location.coordinates'] = {
        type: 'Point',
        coordinates: [Number(locCoords[0]), Number(locCoords[1])],
      };
    }
    const nameMatchers = buildLocationRecordMatchers(oldName);
    const locationNameFilter = nameMatchers.length
      ? { $or: nameMatchers }
      : { 'location.name': oldName };
    const recordFilter = isAdmin
      ? locationNameFilter
      : { $and: [locationNameFilter, { observer: req.user.id }] };
    const recordResult = await Record.updateMany(recordFilter, { $set: recordLocationPayload });
    if (recordResult.modifiedCount > 0) {
      clearCache('/api/records');
      clearCache('/api/records\\?');
    }

    clearCache('/api/locations');

    res.status(200).json({
      success: true,
      message: '地点更新成功',
      data: updatedLocation,
      recordsUpdated: recordResult.modifiedCount,
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      const msg = Object.values(error.errors || {}).map(e => e.message).join('；') || error.message;
      const validationError = new Error('数据校验失败：' + msg);
      validationError.statusCode = 400;
      validationError.code = 'VALIDATION_ERROR';
      return sendControllerError(res, validationError, {
        defaultMessage: '数据校验失败：' + msg,
        defaultCode: 'VALIDATION_ERROR',
        fallbackStatus: 400,
      });
    }
    if (error.code === 11000) {
      const duplicateError = new Error('地点名称已存在，请使用其他名称');
      duplicateError.statusCode = 400;
      duplicateError.code = 'DUPLICATE_LOCATION_NAME';
      return sendControllerError(res, duplicateError, {
        defaultMessage: '地点名称已存在，请使用其他名称',
        defaultCode: 'DUPLICATE_LOCATION_NAME',
        fallbackStatus: 400,
      });
    }
    devError('更新地点失败:', error);
    return sendControllerError(res, error, {
      defaultMessage: '更新地点失败',
      defaultCode: 'LOCATION_OPERATION_FAILED',
    });
  }
};

// @desc    删除地点
// @route   DELETE /api/locations/:id
// @access  Private
const deleteLocation = async (req, res) => {
  try {
    const location = await Location.findById(req.params.id);

    if (!location) {
      const notFoundError = new Error('地点不存在');
      notFoundError.statusCode = 404;
      notFoundError.code = 'LOCATION_NOT_FOUND';
      return sendControllerError(res, notFoundError, {
        defaultMessage: '地点不存在',
        defaultCode: 'LOCATION_NOT_FOUND',
        fallbackStatus: 404,
      });
    }

    // 检查权限：创建者或管理员可删除
    const isCreator = location.createdBy && location.createdBy.toString() === req.user.id;
    const isAdmin = req.user.role === 'admin';
    if (!isCreator && !isAdmin) {
      const forbiddenError = new Error('无权限删除此地点');
      forbiddenError.statusCode = 403;
      forbiddenError.code = 'LOCATION_DELETE_FORBIDDEN';
      return sendControllerError(res, forbiddenError, {
        defaultMessage: '无权限删除此地点',
        defaultCode: 'LOCATION_DELETE_FORBIDDEN',
        fallbackStatus: 403,
      });
    }

    // 软删除：将状态改为archived
    location.status = 'archived';
    await location.save();

    // 清除地点列表缓存，确保删除立即生效
    clearCache('/api/locations');

    res.status(200).json({
      success: true,
      message: '地点删除成功',
    });
  } catch (error) {
    return sendControllerError(res, error, {
      defaultMessage: '删除地点失败',
      defaultCode: 'LOCATION_OPERATION_FAILED',
    });
  }
};

// @desc    搜索附近地点
// @route   GET /api/locations/nearby
// @access  Public
const getNearbyLocations = async (req, res) => {
  try {
    const { lat, lng, radius = 10 } = req.query;

    if (!lat || !lng) {
      const missingCoordinatesError = new Error('请提供经纬度坐标');
      missingCoordinatesError.statusCode = 400;
      missingCoordinatesError.code = 'MISSING_COORDINATES';
      return sendControllerError(res, missingCoordinatesError, {
        defaultMessage: '请提供经纬度坐标',
        defaultCode: 'MISSING_COORDINATES',
        fallbackStatus: 400,
      });
    }

    const locations = await Location.find({
      status: 'active',
      coordinates: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [parseFloat(lng), parseFloat(lat)]
          },
          $maxDistance: radius * 1000 // 转换为米
        }
      }
    })
    .populate('createdBy', 'name avatar')
    .limit(20);

    res.status(200).json({
      success: true,
      data: locations,
    });
  } catch (error) {
    return sendControllerError(res, error, {
      defaultMessage: '获取附近地点失败',
      defaultCode: 'LOCATION_OPERATION_FAILED',
    });
  }
};

// @desc    获取地点统计信息
// @route   GET /api/locations/stats
// @access  Public
const getLocationStats = async (req, res) => {
  try {
    const stats = await Location.aggregate([
      { $match: { status: 'active' } },
      {
        $group: {
          _id: null,
          totalLocations: { $sum: 1 },
          avgSightings: { $avg: '$stats.totalSightings' },
          totalSightings: { $sum: '$stats.totalSightings' },
          totalSpecies: { $sum: '$stats.uniqueSpecies' }
        }
      }
    ]);

    const typeStats = await Location.aggregate([
      { $match: { status: 'active' } },
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    const cityStats = await Location.aggregate([
      { $match: { status: 'active', 'address.city': { $ne: '' } } },
      {
        $group: {
          _id: '$address.city',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    res.status(200).json({
      success: true,
      data: {
        overview: stats[0] || {},
        byType: typeStats,
        byCity: cityStats
      }
    });
  } catch (error) {
    return sendControllerError(res, error, {
      defaultMessage: '获取地点统计失败',
      defaultCode: 'LOCATION_OPERATION_FAILED',
    });
  }
};

// @desc    获取热门地点（按观鸟记录聚合，包含仅出现在记录中的地点如午潮山）
// @route   GET /api/locations/popular
// @access  Public
const getPopularLocations = async (req, res) => {
  try {
    const Record = require('../models/recordModel');
    const { limit = 8, days } = req.query;
    const limitNum = Math.min(parseInt(limit, 10) || 8, 50);
    const daysNum = days !== undefined && days !== '' ? parseInt(days, 10) : null;

    const matchStage = publicNonDraftRecordFilter({
      'location.name': { $exists: true, $ne: '', $type: 'string' },
    });
    if (daysNum != null && daysNum > 0) {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysNum);
      matchStage.createdAt = { $gte: startDate, $lte: endDate };
    }

    const popularLocations = await Record.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$location.name',
          recordCount: { $sum: 1 },
          lastRecordDate: { $max: '$createdAt' },
          uniqueUsers: { $addToSet: '$observer' },
          allBirdIds: { $push: '$birds.birdId' }
        }
      },
      {
        $addFields: {
          name: '$_id',
          userCount: { $size: '$uniqueUsers' },
          uniqueSpecies: {
            $size: {
              $reduce: {
                input: '$allBirdIds',
                initialValue: [],
                in: { $setUnion: ['$$value', { $ifNull: ['$$this', []] }] }
              }
            }
          }
        }
      },
      { $sort: { recordCount: -1, lastRecordDate: -1 } },
      { $limit: limitNum }
    ]);

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const locationsWithFlags = [];
    for (const loc of popularLocations) {
      const matchedDoc = await findActiveLocationByFlexibleName(Location, loc.name);
      locationsWithFlags.push({
        ...loc,
        _id: matchedDoc?._id || null,
        coordinates: matchedDoc?.coordinates || null,
        address: matchedDoc?.address || loc.address || {},
        stats: {
          totalRecords: loc.recordCount,
          uniqueSpecies: loc.uniqueSpecies,
        },
        isNew: new Date(loc.lastRecordDate) > sevenDaysAgo,
      });
    }

    res.status(200).json({
      success: true,
      data: locationsWithFlags,
      meta: {
        total: locationsWithFlags.length,
        period: daysNum != null ? `${daysNum}天` : '全部',
        generatedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    return sendControllerError(res, error, {
      defaultMessage: '获取热门地点失败',
      defaultCode: 'LOCATION_OPERATION_FAILED',
    });
  }
};

// @desc    从观鸟记录同步地点到地点名录（确保记录中的地点都出现在名录中）
// @route   POST /api/locations/sync-from-records
// @access  Private
const syncLocationsFromRecords = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role || 'user';
    const sourceIp = req.ip || req.connection?.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';

    // 非管理员仅同步本人记录中的地点，避免任意登录用户扫全库写名录
    const syncMatch = {
      status: { $ne: 'draft' },
      'location.name': { $exists: true, $regex: /\S/ },
    };
    if (userRole !== 'admin') {
      syncMatch.observer = userId;
    }

    const distinctLocations = await Record.aggregate([
      { $match: syncMatch },
      { $addFields: { locNameNorm: { $trim: { input: { $ifNull: ['$location.name', ''] } } } } },
      { $match: { locNameNorm: { $regex: /\S/ } } },
      { $sort: { date: -1 } },
      { $group: { _id: '$locNameNorm', location: { $first: '$location' } } },
    ]);

    let created = 0;
    let reactivated = 0;
    let linkedExisting = 0;
    const createdNames = [];

    // 已有短名地点时，避免再同步出「省市区 + 短名」的重复条目
    const activeLocations = await Location.find({ status: 'active' }).select('name').lean();
    const activeNameSet = new Set(
      activeLocations.map((loc) => normalizeLocationName(loc.name)).filter(Boolean)
    );

    for (const item of distinctLocations) {
      const name = typeof item._id === 'string' ? String(item._id).trim() : '';
      if (!name) continue;
      const loc = item.location || {};
      const canonicalName = resolveCanonicalLocationName(
        name,
        loc.address?.detail || loc.address?.street || '',
        activeNameSet
      );
      const stripped = stripLocationRegionPrefix(name);
      const preferredName = (() => {
        if (canonicalName && activeNameSet.has(canonicalName)) return canonicalName;
        if (stripped && activeNameSet.has(stripped)) return stripped;
        if (stripped && stripped !== name) return stripped;
        return name;
      })();

      if (preferredName !== name && activeNameSet.has(preferredName)) {
        // 记录用的是带前缀长名，但地点名录已有短名：不新建长名地点
        linkedExisting += 1;
        continue;
      }

      const existing = await Location.findOne({ name: preferredName });
      if (existing) {
        // 若已存在但为 inactive/archived，恢复为 active 以便在地点名录中显示
        if (existing.status && existing.status !== 'active') {
          existing.status = 'active';
          await existing.save({ validateBeforeSave: false });
          reactivated++;
          activeNameSet.add(normalizeLocationName(existing.name));
        }
        const recAddr = loc.address || {};
        const addressPatch = {};
        if (!String(existing.address?.district || '').trim() && recAddr.district) {
          addressPatch['address.district'] = String(recAddr.district).trim();
        }
        if (!String(existing.address?.city || '').trim() && recAddr.city) {
          addressPatch['address.city'] = String(recAddr.city).trim();
        }
        if (!String(existing.address?.province || '').trim() && recAddr.province) {
          addressPatch['address.province'] = String(recAddr.province).trim();
        }
        if (Object.keys(addressPatch).length) {
          await Location.updateOne({ _id: existing._id }, { $set: addressPatch });
        }
        continue;
      }

      const coords = loc.coordinates?.coordinates;
      const hasValidCoords =
        Array.isArray(coords) &&
        coords.length >= 2 &&
        Number.isFinite(Number(coords[0])) &&
        Number.isFinite(Number(coords[1])) &&
        !(Number(coords[0]) === 0 && Number(coords[1]) === 0);
      // 无有效坐标时仍创建地点条目，坐标置 [0,0]（未设置），不伪造杭州
      const coordinates = hasValidCoords
        ? { type: 'Point', coordinates: [Number(coords[0]), Number(coords[1])] }
        : { type: 'Point', coordinates: [0, 0] };

      const address = loc.address || {};
      try {
        await Location.create({
          name: preferredName.trim(),
          description: '',
          coordinates,
          address: {
            province: address.province || '',
            city: address.city || '',
            district: address.district || '',
            street: address.detail || address.street || '',
          },
          type: '其他',
          createdBy: userId,
        });
        created++;
        createdNames.push(preferredName.trim());
        activeNameSet.add(preferredName.trim());
      } catch (createErr) {
        if (createErr.code === 11000) {
          // 并发或边界情况导致重复，跳过即可
          continue;
        }
        throw createErr;
      }
    }

    clearCache('/api/locations');

    const skipped = distinctLocations.length - created - reactivated - linkedExisting;
    const changed = created + reactivated;
    let msg = `同步完成：从观鸟记录发现 ${distinctLocations.length} 个地点`;
    if (created > 0) msg += `，新增 ${created} 个`;
    if (reactivated > 0) msg += `，恢复显示 ${reactivated} 个`;
    if (linkedExisting > 0) msg += `，${linkedExisting} 个已对应现有短名地点`;
    if (changed === 0) msg = skipped > 0 || linkedExisting > 0 ? `${msg}，均已在名录中` : '观鸟记录中暂无有效地点数据';

    devLog('[location.sync-from-records]', {
      userId,
      userRole,
      sourceIp,
      userAgent,
      totalInRecords: distinctLocations.length,
      created,
      reactivated,
      linkedExisting,
      skipped,
      changed,
    });

    res.status(200).json({
      success: true,
      message: msg,
      data: {
        created,
        reactivated,
        linkedExisting,
        skipped,
        totalInRecords: distinctLocations.length,
        createdNames: createdNames.slice(0, 50),
      },
    });
  } catch (error) {
    return sendControllerError(res, error, {
      defaultMessage: '地点同步失败',
      defaultCode: 'LOCATION_OPERATION_FAILED',
    });
  }
};

// @desc    地点统计小结（总数 + 按省份）
// @route   GET /api/locations/summary
// @access  Public
const getLocationSummary = async (req, res) => {
  try {
    const summary = await Location.aggregate([
      { $match: { status: 'active' } },
      {
        $addFields: {
          prov: {
            $trim: {
              input: { $ifNull: ['$address.province', ''] },
            },
          },
        },
      },
      {
        $group: {
          _id: { $cond: [{ $eq: ['$prov', ''] }, '未标注', '$prov'] },
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1, _id: 1 } },
    ]);
    const total = summary.reduce((s, x) => s + x.count, 0);
    const byProvince = summary.reduce((acc, x) => {
      acc[x._id || '未标注'] = x.count;
      return acc;
    }, {});
    res.status(200).json({
      success: true,
      data: { total, byProvince, list: summary },
    });
  } catch (error) {
    return sendControllerError(res, error, {
      defaultMessage: '获取地点小结失败',
      defaultCode: 'LOCATION_OPERATION_FAILED',
    });
  }
};

const {
  resolveActiveUploadUrl,
} = require('../utils/safeUploadPath');
const path = require('path');
const fs = require('fs');
const { todayLocalDateKey } = require('../utils/dateCoords');

const canManageLocation = (reqUser, location) => {
  if (!reqUser || !location) return false;
  const userId = String(reqUser.id || reqUser._id || '');
  if (!userId) return false;
  if (reqUser.role === 'admin') return true;
  const createdBy = location.createdBy?._id || location.createdBy;
  // 无创建者的历史地点仅管理员可改（避免任意登录用户接管）
  if (!createdBy) return false;
  return String(createdBy) === userId;
};

const canDeleteLocationImage = (reqUser, location, image) => {
  if (!reqUser || !image) return false;
  if (canManageLocation(reqUser, location)) return true;
  const photographer = image.photographer?._id || image.photographer;
  const userId = String(reqUser.id || reqUser._id || '');
  return photographer && userId && String(photographer) === userId;
};

// @desc    为地点添加生境照片
// @route   POST /api/locations/:id/images
// @access  Private
const addLocationImage = async (req, res) => {
  try {
    const location = await Location.findById(req.params.id);
    if (!location || location.status !== 'active') {
      const notFoundError = new Error('地点不存在');
      notFoundError.statusCode = 404;
      notFoundError.code = 'LOCATION_NOT_FOUND';
      return sendControllerError(res, notFoundError, {
        defaultMessage: '地点不存在',
        defaultCode: 'LOCATION_NOT_FOUND',
        fallbackStatus: 404,
      });
    }

    const resolved = resolveActiveUploadUrl(req.body?.url);
    if (!resolved) {
      const badUrlError = new Error('图片URL必须来自受控上传目录');
      badUrlError.statusCode = 400;
      badUrlError.code = 'INVALID_IMAGE_URL';
      return sendControllerError(res, badUrlError, {
        defaultMessage: '图片URL必须来自受控上传目录',
        defaultCode: 'INVALID_IMAGE_URL',
        fallbackStatus: 400,
      });
    }

    if (!Array.isArray(location.images)) location.images = [];
    if (location.images.length >= 30) {
      const limitError = new Error('每个地点最多保存 30 张生境照片');
      limitError.statusCode = 400;
      limitError.code = 'LOCATION_IMAGE_LIMIT';
      return sendControllerError(res, limitError, {
        defaultMessage: '每个地点最多保存 30 张生境照片',
        defaultCode: 'LOCATION_IMAGE_LIMIT',
        fallbackStatus: 400,
      });
    }

    location.images.push({
      url: resolved.url,
      caption: String(req.body?.caption || '').slice(0, 200),
      photographer: req.user.id || req.user._id,
      uploadedAt: new Date(),
    });
    location.markModified('images');
    await location.save();

    clearCache('/api/locations');
    clearCache(`/api/locations/${location._id}`);

    const populated = await Location.findById(location._id)
      .populate('createdBy', 'name avatar')
      .populate('images.photographer', 'name avatar');

    res.status(201).json({
      success: true,
      message: '生境照片已添加',
      data: populated,
    });
  } catch (error) {
    return sendControllerError(res, error, {
      defaultMessage: '添加生境照片失败',
      defaultCode: 'LOCATION_IMAGE_ADD_FAILED',
    });
  }
};

const resolveLocationImageIndex = (location, rawIndex) => {
  const imageIndex = Number.parseInt(rawIndex, 10);
  if (
    !Number.isInteger(imageIndex) ||
    imageIndex < 0 ||
    !Array.isArray(location.images) ||
    imageIndex >= location.images.length
  ) {
    return null;
  }
  return imageIndex;
};

const sendLocationNotFound = (res) => {
  const notFoundError = new Error('地点不存在');
  notFoundError.statusCode = 404;
  notFoundError.code = 'LOCATION_NOT_FOUND';
  return sendControllerError(res, notFoundError, {
    defaultMessage: '地点不存在',
    defaultCode: 'LOCATION_NOT_FOUND',
    fallbackStatus: 404,
  });
};

const sendInvalidLocationImageIndex = (res) => {
  const badIndexError = new Error('无效的图片索引');
  badIndexError.statusCode = 400;
  badIndexError.code = 'INVALID_IMAGE_INDEX';
  return sendControllerError(res, badIndexError, {
    defaultMessage: '无效的图片索引',
    defaultCode: 'INVALID_IMAGE_INDEX',
    fallbackStatus: 400,
  });
};

const populateLocationWithImages = (id) =>
  Location.findById(id)
    .populate('createdBy', 'name avatar')
    .populate('images.photographer', 'name avatar');

// @desc    更新地点生境照片说明
// @route   PUT /api/locations/:id/images/:imageIndex
// @access  Private
const updateLocationImage = async (req, res) => {
  try {
    const location = await Location.findById(req.params.id);
    if (!location || location.status !== 'active') {
      return sendLocationNotFound(res);
    }

    const imageIndex = resolveLocationImageIndex(location, req.params.imageIndex);
    if (imageIndex == null) {
      return sendInvalidLocationImageIndex(res);
    }

    const image = location.images[imageIndex];
    if (!canDeleteLocationImage(req.user, location, image)) {
      const forbiddenError = new Error('无权限修改此生境照片');
      forbiddenError.statusCode = 403;
      forbiddenError.code = 'LOCATION_IMAGE_UPDATE_FORBIDDEN';
      return sendControllerError(res, forbiddenError, {
        defaultMessage: '无权限修改此生境照片',
        defaultCode: 'LOCATION_IMAGE_UPDATE_FORBIDDEN',
        fallbackStatus: 403,
      });
    }

    if (req.body?.caption === undefined) {
      const badBodyError = new Error('请提供照片说明');
      badBodyError.statusCode = 400;
      badBodyError.code = 'CAPTION_REQUIRED';
      return sendControllerError(res, badBodyError, {
        defaultMessage: '请提供照片说明',
        defaultCode: 'CAPTION_REQUIRED',
        fallbackStatus: 400,
      });
    }

    location.images[imageIndex].caption = String(req.body.caption || '').trim().slice(0, 200);
    location.markModified('images');
    await location.save();

    clearCache('/api/locations');
    clearCache(`/api/locations/${location._id}`);

    const populated = await populateLocationWithImages(location._id);
    res.status(200).json({
      success: true,
      message: '照片说明已更新',
      data: populated,
    });
  } catch (error) {
    return sendControllerError(res, error, {
      defaultMessage: '更新生境照片失败',
      defaultCode: 'LOCATION_IMAGE_UPDATE_FAILED',
    });
  }
};

// @desc    将地点生境照片设为封面（移到第一张）
// @route   PUT /api/locations/:id/images/:imageIndex/set-main
// @access  Private
const setMainLocationImage = async (req, res) => {
  try {
    const location = await Location.findById(req.params.id);
    if (!location || location.status !== 'active') {
      return sendLocationNotFound(res);
    }

    if (!Array.isArray(location.images) || location.images.length === 0) {
      const emptyError = new Error('该地点暂无生境照片');
      emptyError.statusCode = 400;
      emptyError.code = 'NO_IMAGES';
      return sendControllerError(res, emptyError, {
        defaultMessage: '该地点暂无生境照片',
        defaultCode: 'NO_IMAGES',
        fallbackStatus: 400,
      });
    }

    const imageIndex = resolveLocationImageIndex(location, req.params.imageIndex);
    if (imageIndex == null) {
      return sendInvalidLocationImageIndex(res);
    }

    if (!canManageLocation(req.user, location)) {
      const forbiddenError = new Error('无权限设置地点封面');
      forbiddenError.statusCode = 403;
      forbiddenError.code = 'LOCATION_IMAGE_COVER_FORBIDDEN';
      return sendControllerError(res, forbiddenError, {
        defaultMessage: '无权限设置地点封面',
        defaultCode: 'LOCATION_IMAGE_COVER_FORBIDDEN',
        fallbackStatus: 403,
      });
    }

    if (imageIndex === 0) {
      const populated = await populateLocationWithImages(location._id);
      return res.status(200).json({
        success: true,
        message: '该照片已是封面',
        data: populated,
      });
    }

    const [selected] = location.images.splice(imageIndex, 1);
    location.images.unshift(selected);
    location.markModified('images');
    await location.save();

    clearCache('/api/locations');
    clearCache(`/api/locations/${location._id}`);

    const populated = await populateLocationWithImages(location._id);
    res.status(200).json({
      success: true,
      message: '已设为封面',
      data: populated,
    });
  } catch (error) {
    return sendControllerError(res, error, {
      defaultMessage: '设置封面失败',
      defaultCode: 'LOCATION_IMAGE_COVER_FAILED',
    });
  }
};

// @desc    删除地点生境照片
// @route   DELETE /api/locations/:id/images/:imageIndex
// @access  Private
const deleteLocationImage = async (req, res) => {
  try {
    const location = await Location.findById(req.params.id);
    if (!location || location.status !== 'active') {
      const notFoundError = new Error('地点不存在');
      notFoundError.statusCode = 404;
      notFoundError.code = 'LOCATION_NOT_FOUND';
      return sendControllerError(res, notFoundError, {
        defaultMessage: '地点不存在',
        defaultCode: 'LOCATION_NOT_FOUND',
        fallbackStatus: 404,
      });
    }

    const imageIndex = Number.parseInt(req.params.imageIndex, 10);
    if (
      !Number.isInteger(imageIndex) ||
      imageIndex < 0 ||
      !Array.isArray(location.images) ||
      imageIndex >= location.images.length
    ) {
      const badIndexError = new Error('无效的图片索引');
      badIndexError.statusCode = 400;
      badIndexError.code = 'INVALID_IMAGE_INDEX';
      return sendControllerError(res, badIndexError, {
        defaultMessage: '无效的图片索引',
        defaultCode: 'INVALID_IMAGE_INDEX',
        fallbackStatus: 400,
      });
    }

    const imageToDelete = location.images[imageIndex];
    if (!canDeleteLocationImage(req.user, location, imageToDelete)) {
      const forbiddenError = new Error('无权限删除此生境照片');
      forbiddenError.statusCode = 403;
      forbiddenError.code = 'LOCATION_IMAGE_DELETE_FORBIDDEN';
      return sendControllerError(res, forbiddenError, {
        defaultMessage: '无权限删除此生境照片',
        defaultCode: 'LOCATION_IMAGE_DELETE_FORBIDDEN',
        fallbackStatus: 403,
      });
    }

    try {
      const today = todayLocalDateKey();
      const tempDir = path.join(getTempUploadsRoot(), today);
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      const resolvedSource = resolveActiveUploadUrl(imageToDelete.url);
      if (resolvedSource && fs.existsSync(resolvedSource.absPath)) {
        fs.renameSync(resolvedSource.absPath, path.join(tempDir, resolvedSource.fileName));
      }
    } catch (fileError) {
      devError('移动地点生境照片失败:', fileError.message);
    }

    location.images.splice(imageIndex, 1);
    location.markModified('images');
    await location.save();

    clearCache('/api/locations');
    clearCache(`/api/locations/${location._id}`);

    const populated = await Location.findById(location._id)
      .populate('createdBy', 'name avatar')
      .populate('images.photographer', 'name avatar');

    res.status(200).json({
      success: true,
      message: '生境照片已删除',
      data: populated,
    });
  } catch (error) {
    return sendControllerError(res, error, {
      defaultMessage: '删除生境照片失败',
      defaultCode: 'LOCATION_IMAGE_DELETE_FAILED',
    });
  }
};

module.exports = {
  getLocations,
  getLocation,
  getLocationByName,
  createLocation,
  updateLocation,
  deleteLocation,
  getNearbyLocations,
  getLocationStats,
  getPopularLocations,
  getLocationSummary,
  syncLocationsFromRecords,
  addLocationImage,
  updateLocationImage,
  setMainLocationImage,
  deleteLocationImage,
};
