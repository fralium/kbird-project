const Record = require('../models/recordModel');
const Bird = require('../models/birdModel');
const Location = require('../models/locationModel');
const User = require('../models/userModel');
const jwt = require('jsonwebtoken');
const { getJwtSecret } = require('../config/jwtSecret');
const { clearCache, clearLeaderboardCache } = require('../middleware/cache');
const { sendControllerError } = require('../middleware/controllerError');
const { devError, devLog } = require('../utils/devLogger');
const { sanitizeActiveUploadImageUrl } = require('../utils/safeUploadPath');
const {
  findActiveLocationByFlexibleName,
  buildLocationRecordMatchers,
} = require('../utils/locationName');
const { extractValidLngLat } = require('../utils/dateCoords');
const { buildBirdNameSearchOr } = require('../utils/birdSearch');

const normalizeRecordImage = (img = {}) => {
  const url = sanitizeActiveUploadImageUrl(img.url);
  if (!url) return null;
  return { ...img, url };
};

const normalizeRecordImages = (images = []) =>
  (Array.isArray(images) ? images : []).map(normalizeRecordImage).filter(Boolean);

const mergeLocationAddress = (recordLoc = {}, dictLoc) => {
  const snap = recordLoc.address && typeof recordLoc.address === 'object' ? recordLoc.address : {};
  const fromDict = dictLoc?.address && typeof dictLoc.address === 'object' ? dictLoc.address : {};
  return {
    province: String(snap.province || fromDict.province || '').trim(),
    city: String(snap.city || fromDict.city || '').trim(),
    district: String(snap.district || fromDict.district || '').trim(),
    detail: String(snap.detail || fromDict.street || fromDict.detail || '').trim(),
  };
};

const sendRecordClientError = (res, status, message, code) => {
  const error = new Error(message);
  error.statusCode = status;
  error.code = code;
  return sendControllerError(res, error, {
    defaultMessage: message,
    defaultCode: code,
    fallbackStatus: status,
  });
};

const canManageRecord = (reqUser, record) => {
  if (!reqUser || !record?.observer) return false;
  const userId = String(reqUser.id || reqUser._id || '');
  if (!userId) return false;
  if (String(record.observer) === userId) return true;
  return reqUser.role === 'admin';
};

const getOptionalUserFromAuthHeader = async (req) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.split(' ')[1];
  if (!token) return null;

  try {
    const decoded = jwt.verify(token, getJwtSecret(), { algorithms: ['HS256'] });
    if (!decoded?.id) return null;
    return await User.findById(decoded.id).select('-password');
  } catch (error) {
    return null;
  }
};

const getComparableId = (value) => {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value._id) return String(value._id);
  return String(value);
};

const toNullableNumber = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const toNullableDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const escapeRegex = (value) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const { HABITAT_FILTERS } = require('../../data/habitatFilters');

/** 生境按地点名关键词匹配，与封面归类同一套词表 */
const pushHabitatFilter = (regionFilters, habitat) => {
  const key = String(habitat || '').trim();
  if (!key) return;
  const rule = HABITAT_FILTERS.find((item) => item.key === key);
  if (!rule || !Array.isArray(rule.keywords) || rule.keywords.length === 0) return;
  const pattern = rule.keywords.map((kw) => escapeRegex(kw)).join('|');
  regionFilters.push({
    'location.name': new RegExp(pattern, 'i'),
  });
};

/** 列表/地图共用：文本检索 + 鸟名/学名模糊匹配 */
const applyRecordSearchFilter = async (query, search) => {
  const term = String(search || '').trim();
  if (!term) return query;

  const searchRegex = new RegExp(escapeRegex(term), 'i');
  const orConditions = [
    { 'location.name': searchRegex },
    { title: searchRegex },
    { description: searchRegex },
    { notes: searchRegex },
    { tags: { $in: [searchRegex] } },
  ];

  try {
    const matchedBirds = await Bird.find({
      $or: buildBirdNameSearchOr(term),
    })
      .select('_id')
      .limit(80)
      .lean();

    if (matchedBirds.length > 0) {
      orConditions.push({ 'birds.birdId': { $in: matchedBirds.map((bird) => bird._id) } });
    }
  } catch (error) {
    devError('记录搜索匹配鸟种失败:', error);
  }

  query.$or = orConditions;
  return query;
};

const resolveRecordSort = (sort) => {
  const key = String(sort || 'date_desc').trim();
  if (key === 'date_asc') {
    return { key, mongo: { date: 1, createdAt: 1 }, needsBirdsCount: false };
  }
  if (key === 'birds_desc') {
    return { key, mongo: { birdsCount: -1, date: -1 }, needsBirdsCount: true };
  }
  if (key === 'birds_asc') {
    return { key, mongo: { birdsCount: 1, date: -1 }, needsBirdsCount: true };
  }
  return { key: 'date_desc', mongo: { date: -1, createdAt: -1 }, needsBirdsCount: false };
};


const REGION_CITY_CENTERS = {
  杭州: [120.1551, 30.2741],
  上海: [121.4737, 31.2304],
  苏州: [120.5853, 31.299],
  广州: [113.2644, 23.1291],
  深圳: [114.0579, 22.5431],
  成都: [104.0665, 30.5728],
  景德镇: [117.1784, 29.2688],
  黄山: [118.3376, 29.7147],
  上饶: [117.9712, 28.4444],
  南昌: [115.8582, 28.6829],
  嘉兴: [120.7555, 30.7461],
  绍兴: [120.5821, 30.0511],
  湖州: [120.087, 30.8943],
  临安: [119.7247, 30.2339],
  余杭: [119.9787, 30.4189],
  康定: [101.9645, 30.0507],
  乐平: [117.1282, 28.9784],
  崇明: [121.3975, 31.6228],
};

const REGION_PROVINCE_CENTERS = {
  浙江: [120.1528, 30.2674],
  上海: [121.4737, 31.2304],
  江苏: [118.7674, 32.0415],
  四川: [104.0758, 30.6517],
  广东: [113.2665, 23.1322],
  江西: [115.9092, 28.6757],
  安徽: [117.2857, 31.8612],
};

const normalizeRegionName = (value) =>
  String(value || '')
    .replace(/特别行政区|自治区|自治州|省|市|地区|盟$/g, '')
    .trim();

const extractLngLat = (coordinates) => {
  const raw = Array.isArray(coordinates) ? coordinates : coordinates?.coordinates;
  if (!Array.isArray(raw) || raw.length < 2) return null;
  const lng = Number(raw[0]);
  const lat = Number(raw[1]);
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
  if (lng === 0 && lat === 0) return null;
  return { lng, lat };
};

const resolveRegionCenter = (address = {}) => {
  const cityKey = normalizeRegionName(address.city);
  const provinceKey = normalizeRegionName(address.province);
  const center = REGION_CITY_CENTERS[cityKey] || REGION_PROVINCE_CENTERS[provinceKey];
  if (!Array.isArray(center) || center.length < 2) return null;
  return { lng: center[0], lat: center[1], approximate: true };
};
const MONTH_NAMES_ZH = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

const normalizeEffort = (effort = {}) => {
  const startTime = toNullableDate(effort.startTime);
  const endTime = toNullableDate(effort.endTime);

  let durationMinutes = toNullableNumber(effort.durationMinutes);
  if (durationMinutes == null && startTime && endTime) {
    const minutes = Math.round((endTime.getTime() - startTime.getTime()) / 60000);
    durationMinutes = minutes >= 0 ? minutes : null;
  }

  const distanceKm = toNullableNumber(effort.distanceKm);
  const observersCount = toNullableNumber(effort.observersCount);
  const allowedMethods = new Set(['walk', 'stationary', 'car', 'other']);
  const rawMethods = Array.isArray(effort.observationMethod)
    ? effort.observationMethod
    : [effort.observationMethod];
  const normalizedMethods = rawMethods
    .map((method) => String(method || '').trim())
    .filter((method) => allowedMethods.has(method));
  const dedupedMethods = [...new Set(normalizedMethods)];

  return {
    startTime,
    endTime,
    durationMinutes: durationMinutes != null && durationMinutes >= 0 ? durationMinutes : null,
    distanceKm: distanceKm != null && distanceKm >= 0 ? distanceKm : null,
    observersCount: observersCount != null && observersCount >= 1 ? Math.floor(observersCount) : null,
    isCompleteChecklist: Boolean(effort.isCompleteChecklist),
    observationMethod: dedupedMethods.length > 0 ? dedupedMethods : ['other'],
  };
};

// @desc    获取所有观鸟记录
// @route   GET /api/records
// @access  Public
const getRecords = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      search, 
      location, 
      province,
      city,
      habitat,
      date,
      year,
      observer,
      sort,
      status // 状态筛选（可选）
    } = req.query;
    
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100);
    const sortResolved = resolveRecordSort(sort);

    // 构建查询条件
    const query = {};
    
    // 公开列表仅允许查询已发布记录，禁止通过status访问草稿
    if (status) {
      const statusList = String(status)
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);

      if (statusList.some(s => s === 'draft')) {
        return sendRecordClientError(res, 403, '公开接口不允许访问草稿记录', 'DRAFT_ACCESS_FORBIDDEN');
      }

      const allowedPublicStatuses = ['published'];
      const invalidStatus = statusList.some(s => !allowedPublicStatuses.includes(s));
      if (invalidStatus) {
        return sendRecordClientError(res, 400, '无效的状态参数', 'INVALID_STATUS');
      }

      query.status = statusList.length > 1 ? { $in: statusList } : statusList[0];
    } else {
      // 默认仅显示已发布记录
      query.status = 'published';
    }
    
    // 搜索条件（含鸟名）
    await applyRecordSearchFilter(query, search);
    
    // 地点筛选（与地点名录统计同一套灵活匹配）
    const regionFilters = [];
    if (location) {
      const locationTerm = String(location).trim();
      const locationMatchers = buildLocationRecordMatchers(locationTerm);
      regionFilters.push({
        $or: [
          ...locationMatchers,
          // 保留子串筛选，兼容记录页自由输入（如「天目」）
          { 'location.name': new RegExp(escapeRegex(locationTerm), 'i') },
        ],
      });
    }
    if (province) {
      const provinceRegex = new RegExp(escapeRegex(province), 'i');
      // 兼容旧数据：部分记录只有 city，没有 province
      regionFilters.push({
        $or: [
          { 'location.address.province': provinceRegex },
          { 'location.address.city': provinceRegex },
        ],
      });
    }
    if (city) {
      const cityRegex = new RegExp(escapeRegex(city), 'i');
      regionFilters.push({
        $or: [
          { 'location.address.city': cityRegex },
          { 'location.address.district': cityRegex },
        ],
      });
    }
    pushHabitatFilter(regionFilters, habitat);
    if (regionFilters.length > 0) {
      query.$and = Array.isArray(query.$and) ? query.$and.concat(regionFilters) : regionFilters;
    }
    
    // 观察者筛选
    if (observer) {
      query.observer = observer;
    }
    
    // 日期筛选：指定自然年（与「今天/本周/本月」互斥，优先按年）
    const yearNum = year != null && String(year).trim() !== '' ? parseInt(String(year).trim(), 10) : NaN;
    if (Number.isFinite(yearNum) && yearNum >= 1900 && yearNum <= 2100) {
      const start = new Date(yearNum, 0, 1, 0, 0, 0, 0);
      const end = new Date(yearNum + 1, 0, 1, 0, 0, 0, 0);
      query.date = { $gte: start, $lt: end };
    } else if (date) {
      if (date === 'today') {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        query.date = { $gte: today, $lt: tomorrow };
      } else if (date === 'thisWeek') {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        query.date = { $gte: weekAgo };
      } else if (date === 'thisMonth') {
        const monthAgo = new Date();
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        query.date = { $gte: monthAgo };
      } else {
        // 特定日期
        const targetDate = new Date(date);
        const nextDay = new Date(targetDate);
        nextDay.setDate(nextDay.getDate() + 1);
        query.date = { $gte: targetDate, $lt: nextDay };
      }
    }

    // 计算总数
    const totalItems = await Record.countDocuments(query);
    
    // 计算不重复的鸟种数量
    const uniqueSpeciesPipeline = [
      { $match: query },
      { $unwind: '$birds' },
      { $group: { _id: '$birds.birdId' } },
      { $count: 'uniqueSpecies' }
    ];
    
    const uniqueSpeciesResult = await Record.aggregate(uniqueSpeciesPipeline);
    const uniqueSpeciesCount = uniqueSpeciesResult.length > 0 ? uniqueSpeciesResult[0].uniqueSpecies : 0;
    
    let records;
    if (sortResolved.needsBirdsCount) {
      const sortedRows = await Record.aggregate([
        { $match: query },
        {
          $addFields: {
            birdsCount: { $size: { $ifNull: ['$birds', []] } },
          },
        },
        { $sort: sortResolved.mongo },
        { $skip: (pageNum - 1) * limitNum },
        { $limit: limitNum },
      ]);
      records = await Record.populate(sortedRows, [
        { path: 'observer', select: 'name avatar' },
        {
          path: 'birds.birdId',
          select:
            'name scientificName description habitat distribution images order family genus species category iucnProtectionLevel chinaProtectionLevel',
        },
      ]);
    } else {
      records = await Record.find(query)
        .populate('observer', 'name avatar')
        .populate(
          'birds.birdId',
          'name scientificName description habitat distribution images order family genus species category iucnProtectionLevel chinaProtectionLevel'
        )
        .sort(sortResolved.mongo)
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum);
    }

    // 计算分页信息
    const totalPages = Math.ceil(totalItems / limitNum) || 0;

    res.status(200).json({
      success: true,
      count: totalItems,
      uniqueSpecies: uniqueSpeciesCount,
      sort: sortResolved.key,
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalItems,
        itemsPerPage: limitNum,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1
      },
      data: records
    });
  } catch (error) {
    return sendControllerError(res, error, {
      defaultMessage: '获取观鸟记录失败',
      defaultCode: 'RECORD_OPERATION_FAILED',
    });
  }
};

// @desc    获取记录地图点（聚合，不受列表分页截断）
// @route   GET /api/records/map-points
// @access  Public
const getRecordMapPoints = async (req, res) => {
  try {
    const {
      search,
      location,
      province,
      city,
      habitat,
      date,
      year,
      observer,
      status,
    } = req.query;

    const query = {};

    if (status) {
      const statusList = String(status)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      if (statusList.some((s) => s === 'draft')) {
        return sendRecordClientError(res, 403, '公开接口不允许访问草稿记录', 'DRAFT_ACCESS_FORBIDDEN');
      }
      query.status = statusList.length > 1 ? { $in: statusList } : statusList[0];
    } else {
      query.status = 'published';
    }

    await applyRecordSearchFilter(query, search);

    const regionFilters = [];
    if (location) {
      const locationTerm = String(location).trim();
      const locationMatchers = buildLocationRecordMatchers(locationTerm);
      regionFilters.push({
        $or: [
          ...locationMatchers,
          { 'location.name': new RegExp(escapeRegex(locationTerm), 'i') },
        ],
      });
    }
    if (province) {
      const provinceRegex = new RegExp(escapeRegex(province), 'i');
      regionFilters.push({
        $or: [
          { 'location.address.province': provinceRegex },
          { 'location.address.city': provinceRegex },
        ],
      });
    }
    if (city) {
      const cityRegex = new RegExp(escapeRegex(city), 'i');
      regionFilters.push({
        $or: [
          { 'location.address.city': cityRegex },
          { 'location.address.district': cityRegex },
        ],
      });
    }
    pushHabitatFilter(regionFilters, habitat);
    if (regionFilters.length > 0) {
      query.$and = Array.isArray(query.$and) ? query.$and.concat(regionFilters) : regionFilters;
    }

    if (observer) {
      const mongoose = require('mongoose');
      query.observer = mongoose.Types.ObjectId.isValid(String(observer))
        ? new mongoose.Types.ObjectId(String(observer))
        : observer;
    }

    const yearNum = year != null && String(year).trim() !== '' ? parseInt(String(year).trim(), 10) : NaN;
    if (Number.isFinite(yearNum) && yearNum >= 1900 && yearNum <= 2100) {
      const start = new Date(yearNum, 0, 1, 0, 0, 0, 0);
      const end = new Date(yearNum + 1, 0, 1, 0, 0, 0, 0);
      query.date = { $gte: start, $lt: end };
    } else if (date) {
      if (date === 'today') {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        query.date = { $gte: today, $lt: tomorrow };
      } else if (date === 'thisWeek') {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        query.date = { $gte: weekAgo };
      } else if (date === 'thisMonth') {
        const monthAgo = new Date();
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        query.date = { $gte: monthAgo };
      } else {
        const targetDate = new Date(date);
        const nextDay = new Date(targetDate);
        nextDay.setDate(nextDay.getDate() + 1);
        query.date = { $gte: targetDate, $lt: nextDay };
      }
    }

    const docs = await Record.find(query).select('location birds').lean();

    const namesNeedingLookup = [];
    docs.forEach((doc) => {
      const name = String(doc?.location?.name || '').trim();
      if (!name) return;
      if (!extractLngLat(doc?.location?.coordinates)) namesNeedingLookup.push(name);
    });

    const { findActiveLocationByFlexibleName, resolveCanonicalLocationName, normalizeLocationName } = require('../utils/locationName');
    const locationFallbackMap = new Map();
    if (namesNeedingLookup.length > 0) {
      const uniqueNames = [...new Set(namesNeedingLookup)];
      const allLocDocs = await Location.find({ status: 'active' })
        .select('name coordinates address')
        .lean();
      const canonicalSet = new Set(
        allLocDocs.map((loc) => normalizeLocationName(loc.name)).filter(Boolean)
      );
      const byCanonical = new Map(
        allLocDocs.map((loc) => [normalizeLocationName(loc.name), loc])
      );

      uniqueNames.forEach((rawName) => {
        const canonical = resolveCanonicalLocationName(rawName, '', canonicalSet);
        const loc =
          byCanonical.get(canonical) ||
          byCanonical.get(normalizeLocationName(rawName)) ||
          null;
        const coords = extractLngLat(loc?.coordinates);
        if (coords) {
          locationFallbackMap.set(String(rawName || '').trim(), {
            ...coords,
            address: loc.address || {},
          });
        }
      });

      // 仍可能漏掉：逐个灵活查找（名录较大时兜底）
      for (const rawName of uniqueNames) {
        if (locationFallbackMap.has(rawName)) continue;
        const loc = await findActiveLocationByFlexibleName(Location, rawName);
        const coords = extractLngLat(loc?.coordinates);
        if (coords) {
          locationFallbackMap.set(rawName, {
            ...coords,
            address: loc.address || {},
          });
        }
      }
    }

    const grouped = new Map();
    docs.forEach((doc) => {
      const name = String(doc?.location?.name || '').trim();
      if (!name) return;

      let coords = extractLngLat(doc?.location?.coordinates);
      let approximate = false;
      if (!coords) {
        const fromLib = locationFallbackMap.get(name);
        if (fromLib) {
          coords = { lng: fromLib.lng, lat: fromLib.lat };
        } else {
          const region = resolveRegionCenter(doc?.location?.address || {});
          if (!region) return;
          coords = { lng: region.lng, lat: region.lat };
          approximate = true;
        }
      }

      const key = `${name}|${coords.lng.toFixed(5)}|${coords.lat.toFixed(5)}`;
      if (!grouped.has(key)) {
        grouped.set(key, {
          name,
          lng: Number(coords.lng.toFixed(5)),
          lat: Number(coords.lat.toFixed(5)),
          records: 0,
          birds: 0,
          province: doc?.location?.address?.province || '',
          city: doc?.location?.address?.city || '',
          approximate,
        });
      }
      const item = grouped.get(key);
      item.records += 1;
      item.birds += Array.isArray(doc?.birds) ? doc.birds.length : 0;
    });

    const points = Array.from(grouped.values())
      .sort((a, b) => b.records - a.records || String(a.name).localeCompare(String(b.name), 'zh-CN'))
      .slice(0, 5000);

    return res.json({
      success: true,
      count: points.length,
      data: points,
    });
  } catch (error) {
    return sendControllerError(res, error, {
      defaultMessage: '获取地图点失败',
      defaultCode: 'RECORD_MAP_POINTS_FAILED',
    });
  }
};

// @desc    获取观鸟记录地点筛选选项（省市）
// @route   GET /api/records/location-options
// @access  Public
const getRecordLocationOptions = async (req, res) => {
  try {
    const pipeline = [
      { $match: { status: 'published' } },
      {
        $project: {
          provinceRaw: { $ifNull: ['$location.address.province', ''] },
          cityRaw: { $ifNull: ['$location.address.city', ''] },
        },
      },
      {
        $project: {
          province: { $trim: { input: '$provinceRaw' } },
          city: { $trim: { input: '$cityRaw' } },
        },
      },
      {
        $addFields: {
          normalizedProvince: {
            $cond: [
              { $gt: [{ $strLenCP: '$province' }, 0] },
              '$province',
              {
                $cond: [
                  { $in: ['$city', ['北京市', '天津市', '上海市', '重庆市']] },
                  '$city',
                  '',
                ],
              },
            ],
          },
          normalizedCity: {
            $cond: [
              { $gt: [{ $strLenCP: '$city' }, 0] },
              '$city',
              {
                $cond: [
                  { $in: ['$province', ['北京市', '天津市', '上海市', '重庆市']] },
                  '$province',
                  '',
                ],
              },
            ],
          },
        },
      },
      { $match: { normalizedProvince: { $ne: '' }, normalizedCity: { $ne: '' } } },
      {
        $group: {
          _id: { province: '$normalizedProvince', city: '$normalizedCity' },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.province': 1, count: -1, '_id.city': 1 } },
    ];

    const pairs = await Record.aggregate(pipeline);
    const provinceMap = new Map();

    pairs.forEach((item) => {
      const provinceName = item?._id?.province;
      const cityName = item?._id?.city;
      const count = Number(item?.count || 0);
      if (!provinceName || !cityName) return;

      if (!provinceMap.has(provinceName)) {
        provinceMap.set(provinceName, {
          name: provinceName,
          count: 0,
          cities: [],
        });
      }
      const province = provinceMap.get(provinceName);
      province.count += count;
      province.cities.push({ name: cityName, count });
    });

    const provinces = Array.from(provinceMap.values())
      .map((province) => ({
        ...province,
        cities: province.cities.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'zh-CN')),
      }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'zh-CN'));

    res.status(200).json({
      success: true,
      data: provinces,
    });
  } catch (error) {
    return sendControllerError(res, error, {
      defaultMessage: '获取地点筛选选项失败',
      defaultCode: 'RECORD_OPERATION_FAILED',
    });
  }
};

// @desc    获取本月推荐观察鸟类（按历史观测频次）
// @route   GET /api/records/monthly-observation
// @access  Public
const getMonthlyObservationRecommendations = async (req, res) => {
  try {
    const rawMonth = Number.parseInt(String(req.query.month || ''), 10);
    const month = Number.isFinite(rawMonth) && rawMonth >= 1 && rawMonth <= 12
      ? rawMonth
      : new Date().getMonth() + 1;
    const rawLimit = Number.parseInt(String(req.query.limit || ''), 10);
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 12) : 6;
    const province = String(req.query.province || '').trim();
    const city = String(req.query.city || '').trim();

    const match = {
      status: 'published',
      $expr: { $eq: [{ $month: '$date' }, month] },
    };

    if (province) {
      const provinceRegex = new RegExp(escapeRegex(province), 'i');
      match.$and = (match.$and || []).concat({
        $or: [
          { 'location.address.province': provinceRegex },
          { 'location.address.city': provinceRegex },
        ],
      });
    }
    if (city) {
      const cityRegex = new RegExp(escapeRegex(city), 'i');
      match.$and = (match.$and || []).concat({
        $or: [
          { 'location.address.city': cityRegex },
          { 'location.address.district': cityRegex },
        ],
      });
    }

    const data = await Record.aggregate([
      { $match: match },
      { $unwind: '$birds' },
      {
        $group: {
          _id: '$birds.birdId',
          totalObserved: { $sum: { $ifNull: ['$birds.count', 1] } },
          recordCount: { $sum: 1 },
          lastSeenAt: { $max: '$date' },
        },
      },
      { $sort: { totalObserved: -1, recordCount: -1, lastSeenAt: -1 } },
      { $limit: limit },
      {
        $lookup: {
          from: 'birds',
          localField: '_id',
          foreignField: '_id',
          as: 'bird',
        },
      },
      { $unwind: '$bird' },
      {
        $project: {
          _id: '$bird._id',
          name: '$bird.name',
          scientificName: '$bird.scientificName',
          category: '$bird.category',
          iucnProtectionLevel: '$bird.iucnProtectionLevel',
          chinaProtectionLevel: '$bird.chinaProtectionLevel',
          image: { $arrayElemAt: ['$bird.images', 0] },
          totalObserved: 1,
          recordCount: 1,
          lastSeenAt: 1,
        },
      },
    ]);

    return res.status(200).json({
      success: true,
      data,
      meta: {
        month,
        monthLabel: MONTH_NAMES_ZH[month - 1] || `${month}月`,
        scope: {
          province: province || '',
          city: city || '',
        },
      },
    });
  } catch (error) {
    return sendControllerError(res, error, {
      defaultMessage: '获取本月观察推荐失败',
      defaultCode: 'RECORD_OPERATION_FAILED',
    });
  }
};

// @desc    获取单个观鸟记录
// @route   GET /api/records/:id
// @access  Public
const getRecord = async (req, res) => {
  try {
    const id = req.params.id;
    if (!id) {
      return sendRecordClientError(res, 400, '缺少记录ID', 'MISSING_RECORD_ID');
    }

    const record = await Record.findById(id)
      .populate('observer', 'name avatar')
      .populate('birds.birdId', 'name scientificName englishName description habitat distribution images order family genus species category iucnProtectionLevel chinaProtectionLevel')
      .lean();

    if (!record) {
      return sendRecordClientError(res, 404, '观鸟记录不存在', 'RECORD_NOT_FOUND');
    }

    // 草稿记录仅允许创建者本人或管理员查看
    if (record.status === 'draft') {
      const requester = await getOptionalUserFromAuthHeader(req);
      const isAdmin = requester?.role === 'admin';
      const isOwner = getComparableId(record.observer) === getComparableId(requester?._id);

      if (!isAdmin && !isOwner) {
        return sendRecordClientError(res, 404, '观鸟记录不存在', 'RECORD_NOT_FOUND');
      }
    }

    // 兼容旧数据：location.coordinates 可能是数组 [lng,lat]，统一为 { type, coordinates }
    if (record.location && record.location.coordinates !== undefined) {
      const c = record.location.coordinates;
      if (Array.isArray(c)) {
        record.location.coordinates = { type: 'Point', coordinates: c };
      } else if (c && !c.coordinates && (c.lng != null || c.lat != null)) {
        record.location.coordinates = { type: 'Point', coordinates: [c.lng ?? 0, c.lat ?? 0] };
      }
    }

    res.status(200).json({
      success: true,
      data: record,
    });
  } catch (error) {
    if (error.name === 'CastError') {
      return sendRecordClientError(res, 400, '无效的记录ID格式', 'INVALID_RECORD_ID');
    }
    devError('getRecord 错误:', error);
    return sendControllerError(res, error, {
      defaultMessage: '获取观鸟记录失败',
      defaultCode: 'RECORD_OPERATION_FAILED',
    });
  }
};

// @desc    创建观鸟记录
// @route   POST /api/records
// @access  Private
const createRecord = async (req, res) => {
  try {
    devLog('创建Record请求:', {
      user: req.user,
      body: req.body
    });
    
    const userId = req.user.id;
    const { 
      title, 
      description, 
      location, 
      date, 
      birds, 
      notes, 
      weather, 
      temperature, 
      humidity, 
      wind, 
      effort,
      images, 
      tags 
    } = req.body;

    // 验证必要字段
    if (!location || !location.name || !date || !birds || birds.length === 0) {
      return sendRecordClientError(
        res,
        400,
        '缺少必要字段：地点、日期和鸟类信息',
        'MISSING_REQUIRED_FIELDS'
      );
    }

    if (!extractValidLngLat(location)) {
      const resolved = location?.name
        ? await findActiveLocationByFlexibleName(Location, location.name)
        : null;
      const resolvedCoords = extractValidLngLat(resolved);
      if (resolvedCoords) {
        location.name = resolved.name || location.name;
        location.coordinates = { type: 'Point', coordinates: resolvedCoords };
        if (!location.address || typeof location.address !== 'object') {
          location.address = {};
        }
        location.address.province = location.address.province || resolved.address?.province || '';
        location.address.city = location.address.city || resolved.address?.city || '';
        location.address.district = location.address.district || resolved.address?.district || '';
        location.address.detail =
          location.address.detail ||
          location.address.street ||
          resolved.address?.street ||
          '';
      } else {
        return sendRecordClientError(
          res,
          400,
          '请提供有效的地点坐标（不能为空或 [0,0]）',
          'MISSING_LOCATION_COORDINATES'
        );
      }
    }

    // 验证鸟类是否存在（按去重 ID 校验，允许同种多行）
    devLog('接收到的birds数据:', birds);
    const birdIds = birds.map((bird) => bird.birdId).filter(Boolean);
    const uniqueBirdIds = [...new Set(birdIds.map((id) => String(id)))];
    devLog('提取的birdIds:', birdIds);

    const existingBirds = await Bird.find({ _id: { $in: uniqueBirdIds } });
    devLog('数据库中存在的鸟类数量:', existingBirds.length);
    devLog('请求验证的鸟类数量:', uniqueBirdIds.length);

    if (existingBirds.length !== uniqueBirdIds.length) {
      devLog('鸟类验证失败:', {
        requested: uniqueBirdIds,
        found: existingBirds.map((b) => b._id.toString()),
      });
      return sendRecordClientError(res, 400, '部分鸟类不存在于数据库中', 'BIRD_NOT_FOUND');
    }

    // 处理鸟类照片同步到图片栏
    const birdImageSyncPromises = birds.map(async (bird) => {
      if (bird.images && bird.images.length > 0) {
        const birdDoc = await Bird.findById(bird.birdId);
        if (birdDoc) {
          // 检查每个图片是否已经存在于鸟类的图片库中
          const newImages = bird.images.filter(recordImage => {
            // 检查URL是否已存在
            return !birdDoc.images.some(existingImage => 
              existingImage.url === recordImage.url
            );
          });

          // 如果有新图片，添加到鸟类图片库
          if (newImages.length > 0) {
            const imagesToAdd = normalizeRecordImages(newImages).map((img) => ({
              url: img.url,
              caption: img.caption || '',
              photographer: userId,
              date: new Date(),
              location: location.name,
              source: 'observation_record' // 标记来源
            }));

            if (imagesToAdd.length > 0) {
              await Bird.findByIdAndUpdate(
                bird.birdId,
                { $push: { images: { $each: imagesToAdd } } }
              );
            }
          }
        }
      }
    });

    // 等待所有照片同步完成
    await Promise.all(birdImageSyncPromises);

    // 创建观鸟记录
    const record = await Record.create({
      title: title || `${location.name}观鸟记录`,
      description,
      location,
      date: new Date(date),
      observer: userId,
      birds: birds.map(bird => ({
        birdId: bird.birdId,
        notes: bird.notes || '',
        count: bird.count || 1,
        images: normalizeRecordImages(bird.images || []),
      })),
      notes: notes || '',
      weather: weather || '',
      temperature,
      humidity,
      wind,
      effort: normalizeEffort(effort),
      images: normalizeRecordImages(images || []),
      tags: tags || [],
      status: 'published' // 直接发布，无需审核
    });

    // 填充关联数据
    const populatedRecord = await Record.findById(record._id)
      .populate('observer', 'name email avatar')
      .populate('birds.birdId', 'name scientificName englishName description habitat distribution images order family genus species category iucnProtectionLevel chinaProtectionLevel');

    // 清除相关缓存
    clearCache('/api/records\\?');
    clearCache('/api/locations');
    clearLeaderboardCache();
    
    // 清除相关鸟类的缓存，确保图片同步后能获取到最新数据
    birds.forEach(bird => {
      clearCache(`/api/birds/${bird.birdId}`);
      clearCache(`/api/records/bird/${bird.birdId}\\?`);
    });

    res.status(201).json({
      success: true,
      message: '观鸟记录创建成功',
      data: populatedRecord
    });
  } catch (error) {
    return sendControllerError(res, error, {
      defaultMessage: '创建观鸟记录失败',
      defaultCode: 'RECORD_OPERATION_FAILED',
    });
  }
};

// @desc    编辑观鸟记录
// @route   PUT /api/records/:id
// @access  Private
const editRecord = async (req, res) => {
  try {
    const recordId = req.params.id;
    const userId = req.user.id;
    const { 
      title, 
      description, 
      location, 
      date, 
      birds, 
      notes, 
      weather, 
      temperature, 
      humidity, 
      wind, 
      effort,
      images, 
      tags 
    } = req.body;

    // 查找观鸟记录
    const record = await Record.findById(recordId);

    if (!record) {
      return sendRecordClientError(res, 404, '观鸟记录不存在', 'RECORD_NOT_FOUND');
    }

    // 检查用户权限（所有者或管理员，与前端 canManageRecord 一致）
    if (!canManageRecord(req.user, record)) {
      return sendRecordClientError(res, 403, '您没有权限编辑此观鸟记录', 'RECORD_EDIT_FORBIDDEN');
    }

    // 验证必要字段
    if (!location || !location.name || !date || !birds || birds.length === 0) {
      return sendRecordClientError(
        res,
        400,
        '缺少必要字段：地点、日期和鸟类信息',
        'MISSING_REQUIRED_FIELDS'
      );
    }

    if (!extractValidLngLat(location)) {
      const resolved = location?.name
        ? await findActiveLocationByFlexibleName(Location, location.name)
        : null;
      const resolvedCoords = extractValidLngLat(resolved);
      if (resolvedCoords) {
        location.name = resolved.name || location.name;
        location.coordinates = { type: 'Point', coordinates: resolvedCoords };
        if (!location.address || typeof location.address !== 'object') {
          location.address = {};
        }
        location.address.province = location.address.province || resolved.address?.province || '';
        location.address.city = location.address.city || resolved.address?.city || '';
        location.address.district = location.address.district || resolved.address?.district || '';
        location.address.detail =
          location.address.detail ||
          location.address.street ||
          resolved.address?.street ||
          '';
      } else {
        return sendRecordClientError(
          res,
          400,
          '请提供有效的地点坐标（不能为空或 [0,0]）',
          'MISSING_LOCATION_COORDINATES'
        );
      }
    }

    // 验证鸟类是否存在（按去重 ID 校验，允许同种多行）
    devLog('接收到的birds数据:', birds);
    const birdIds = birds.map((bird) => bird.birdId).filter(Boolean);
    const uniqueBirdIds = [...new Set(birdIds.map((id) => String(id)))];
    devLog('提取的birdIds:', birdIds);

    const existingBirds = await Bird.find({ _id: { $in: uniqueBirdIds } });
    devLog('数据库中存在的鸟类数量:', existingBirds.length);
    devLog('请求验证的鸟类数量:', uniqueBirdIds.length);

    if (existingBirds.length !== uniqueBirdIds.length) {
      devLog('鸟类验证失败:', {
        requested: uniqueBirdIds,
        found: existingBirds.map((b) => b._id.toString()),
      });
      return sendRecordClientError(res, 400, '部分鸟类不存在于数据库中', 'BIRD_NOT_FOUND');
    }

    // 处理鸟类照片同步到图片栏
    const birdImageSyncPromises = birds.map(async (bird) => {
      if (bird.images && bird.images.length > 0) {
        const birdDoc = await Bird.findById(bird.birdId);
        if (birdDoc) {
          // 检查每个图片是否已经存在于鸟类的图片库中
          const newImages = bird.images.filter(recordImage => {
            // 检查URL是否已存在
            return !birdDoc.images.some(existingImage => 
              existingImage.url === recordImage.url
            );
          });

          // 如果有新图片，添加到鸟类图片库
          if (newImages.length > 0) {
            const imagesToAdd = normalizeRecordImages(newImages).map((img) => ({
              url: img.url,
              caption: img.caption || '',
              photographer: userId,
              date: new Date(),
              location: location.name,
              source: 'observation_record' // 标记来源
            }));

            if (imagesToAdd.length > 0) {
              await Bird.findByIdAndUpdate(
                bird.birdId,
                { $push: { images: { $each: imagesToAdd } } }
              );
            }
          }
        }
      }
    });

    // 等待所有照片同步完成
    await Promise.all(birdImageSyncPromises);

    // 更新观鸟记录
    devLog('后端接收到的birds数据:', birds);
    const birdsData = birds.map(bird => ({
      birdId: bird.birdId,
      notes: bird.notes || '',
      count: bird.count || 1,
      images: normalizeRecordImages(bird.images || []),
    }));
    devLog('处理后的birds数据:', birdsData);
    
    const updatedRecord = await Record.findByIdAndUpdate(
      recordId,
      {
        title: title || `${location.name}观鸟记录`,
        description,
        location,
        date: new Date(date),
        birds: birdsData,
        notes: notes || '',
        weather: weather || '',
        temperature,
        humidity,
        wind,
        effort: normalizeEffort(effort),
        images: normalizeRecordImages(images || []),
        tags: tags || [],
        status: 'published' // 编辑后直接发布，无需审核
      },
      { new: true }
    ).populate('observer', 'name email avatar')
     .populate('birds.birdId', 'name scientificName englishName description habitat distribution images order family genus species category iucnProtectionLevel chinaProtectionLevel');

    // 清除相关缓存
    clearCache(`/api/records/${recordId}`);
    clearCache('/api/records\\?');
    clearCache('/api/locations');
    clearLeaderboardCache();
    
    // 清除相关鸟类的缓存，确保图片同步后能获取到最新数据
    birds.forEach(bird => {
      clearCache(`/api/birds/${bird.birdId}`);
      clearCache(`/api/records/bird/${bird.birdId}\\?`);
    });

    res.status(200).json({
      success: true,
      message: '观鸟记录更新成功',
      data: updatedRecord
    });
  } catch (error) {
    return sendControllerError(res, error, {
      defaultMessage: '更新观鸟记录失败',
      defaultCode: 'RECORD_OPERATION_FAILED',
    });
  }
};

// @desc    从观鸟记录中删除特定鸟类
// @route   DELETE /api/records/:id/bird/:birdId
// @access  Private
const deleteBirdFromRecord = async (req, res) => {
  try {
    const recordId = req.params.id;
    const birdId = req.params.birdId;
    const userId = req.user.id;

    devLog('从Record中删除鸟类请求:', {
      recordId: recordId,
      birdId: birdId,
      userId: userId
    });

    // 查找观鸟记录
    const record = await Record.findById(recordId);

    if (!record) {
      devLog('Record不存在:', recordId);
      return sendRecordClientError(res, 404, '观鸟记录不存在', 'RECORD_NOT_FOUND');
    }

    // 检查用户权限
    if (!canManageRecord(req.user, record)) {
      devLog('权限检查失败: 用户无权删除此Record中的鸟类');
      return sendRecordClientError(
        res,
        403,
        '您没有权限删除此观鸟记录中的鸟类',
        'RECORD_EDIT_FORBIDDEN'
      );
    }

    // 查找要删除的鸟类在Record中的索引
    const birdIndex = record.birds.findIndex(bird => bird.birdId.toString() === birdId);
    
    if (birdIndex === -1) {
      devLog('鸟类不在Record中:', birdId);
      return sendRecordClientError(res, 404, '该鸟类不在此观鸟记录中', 'BIRD_NOT_IN_RECORD');
    }

    // 检查删除后是否还有其他鸟类
    if (record.birds.length === 1) {
      // 如果只有一只鸟，删除整个Record
      devLog('Record中只有一只鸟，删除整个Record');
      await Record.findByIdAndDelete(recordId);
      
          // 清除相关缓存
          clearCache(`/api/records/${recordId}`);
          clearCache('/api/records\\?');
          clearCache('/api/locations');
          
          // 清除相关鸟类的缓存
          clearCache(`/api/birds/${birdId}`);
          clearCache(`/api/records/bird/${birdId}\\?`);
          
          return res.status(200).json({
            success: true,
            message: '观鸟记录删除成功（记录中只有一只鸟类）',
            deletedEntireRecord: true
          });
    } else {
      // 删除特定鸟类，保留其他鸟类
      devLog('从Record中删除鸟类，保留其他鸟类');
      record.birds.splice(birdIndex, 1);
      
      // 更新stats
      record.stats.totalBirds = record.birds.length;
      record.stats.totalImages = record.birds.reduce((total, bird) => 
        total + (bird.images ? bird.images.length : 0), 0
      );
      
      await record.save();
      
      // 清除相关缓存
      clearCache(`/api/records/${recordId}`);
      clearCache('/api/records\\?');
      clearCache('/api/locations');
      
      // 清除相关鸟类的缓存
      clearCache(`/api/birds/${birdId}`);
      clearCache(`/api/records/bird/${birdId}\\?`);
      
      return res.status(200).json({
        success: true,
        message: '鸟类已从观鸟记录中删除',
        deletedEntireRecord: false,
        remainingBirds: record.birds.length
      });
    }
  } catch (error) {
    devError('从Record中删除鸟类错误:', error);
    return sendControllerError(res, error, {
      defaultMessage: '删除鸟类失败',
      defaultCode: 'RECORD_OPERATION_FAILED',
    });
  }
};

// @desc    删除观鸟记录
// @route   DELETE /api/records/:id
// @access  Private
const deleteRecord = async (req, res) => {
  try {
    const recordId = req.params.id;
    const userId = req.user.id;

    devLog('删除Record请求:', {
      recordId: recordId,
      userId: userId
    });

    const record = await Record.findById(recordId);

    if (!record) {
      devLog('Record不存在:', recordId);
      return sendRecordClientError(res, 404, '观鸟记录不存在', 'RECORD_NOT_FOUND');
    }

    devLog('找到Record:', {
      id: record._id,
      observer: record.observer,
      observerString: record.observer.toString(),
      userId: userId
    });

    // 检查用户权限
    if (!canManageRecord(req.user, record)) {
      devLog('权限检查失败: 用户无权删除此Record');
      return sendRecordClientError(res, 403, '您没有权限删除此观鸟记录', 'RECORD_DELETE_FORBIDDEN');
    }

    await Record.findByIdAndDelete(recordId);
    devLog('Record删除成功');

    // 清除相关缓存
    clearCache(`/api/records/${recordId}`);
    clearCache('/api/records\\?');
    clearCache('/api/locations');
    clearLeaderboardCache();

    res.status(200).json({
      success: true,
      message: '观鸟记录删除成功'
    });
  } catch (error) {
    devError('删除Record错误:', error);
    return sendControllerError(res, error, {
      defaultMessage: '删除观鸟记录失败',
      defaultCode: 'RECORD_OPERATION_FAILED',
    });
  }
};

// @desc    获取用户的观鸟记录
// @route   GET /api/records/user/:userId
// @access  Private
const getUserRecords = async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 10, status } = req.query;
    const isSelfRequest = req.user && req.user._id && req.user._id.toString() === userId;
    const isAdmin = req.user && req.user.role === 'admin';

    if (!isSelfRequest && !isAdmin) {
      return sendRecordClientError(
        res,
        403,
        '您无权访问其他用户的观鸟记录',
        'USER_RECORD_ACCESS_FORBIDDEN'
      );
    }
    
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);

    // 构建查询条件
    const query = { observer: userId };
    if (status) {
      const allowedStatuses = ['draft', 'published'];
      if (!allowedStatuses.includes(status)) {
        return sendRecordClientError(res, 400, '无效的状态参数', 'INVALID_STATUS');
      }
      query.status = status;
    } else {
      // 默认排除草稿
      query.status = { $ne: 'draft' };
    }

    // 计算总数
    const totalItems = await Record.countDocuments(query);
    
    // 分页查询
    const records = await Record.find(query)
      .populate('observer', 'name email avatar')
      .populate('birds.birdId', 'name scientificName englishName description habitat distribution images order family genus species category iucnProtectionLevel chinaProtectionLevel')
      .sort({ date: -1, createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum);

    // 计算分页信息
    const totalPages = Math.ceil(totalItems / limitNum);

    res.status(200).json({
      success: true,
      count: totalItems,
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalItems,
        itemsPerPage: limitNum,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1
      },
      data: records
    });
  } catch (error) {
    return sendControllerError(res, error, {
      defaultMessage: '获取用户观鸟记录失败',
      defaultCode: 'RECORD_OPERATION_FAILED',
    });
  }
};

// @desc    获取特定鸟类的观鸟记录
// @route   GET /api/records/bird/:birdId
// @access  Public
const getRecordsByBird = async (req, res) => {
  try {
    const { birdId } = req.params;
    const { page = 1, limit = 100, status } = req.query;
    
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const parsedLimit = parseInt(limit, 10);
    const limitNum = Math.min(Math.max(Number.isFinite(parsedLimit) ? parsedLimit : 100, 1), 500);
    
    // 构建查询条件
    const query = {
      'birds.birdId': birdId
    };
    
    // 公开接口仅允许已发布记录
    if (status) {
      const statusList = String(status)
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);

      if (statusList.some(s => s === 'draft')) {
        return sendRecordClientError(res, 403, '公开接口不允许访问草稿记录', 'DRAFT_ACCESS_FORBIDDEN');
      }

      const allowedPublicStatuses = ['published'];
      const invalidStatus = statusList.some(s => !allowedPublicStatuses.includes(s));
      if (invalidStatus) {
        return sendRecordClientError(res, 400, '无效的状态参数', 'INVALID_STATUS');
      }

      query.status = statusList.length > 1 ? { $in: statusList } : statusList[0];
    } else {
      query.status = 'published';
    }
    
    // 查询记录
    const [records, total] = await Promise.all([
      Record.find(query)
        .populate('observer', 'name avatar')
        .populate('birds.birdId', 'name scientificName englishName description habitat distribution images order family genus species category iucnProtectionLevel chinaProtectionLevel')
        .sort({ date: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .lean(),
      Record.countDocuments(query),
    ]);

    const locationNames = [
      ...new Set(records.map((item) => String(item.location?.name || '').trim()).filter(Boolean)),
    ];
    const dictLocations = locationNames.length
      ? await Location.find({ name: { $in: locationNames } }).select('name address').lean()
      : [];
    const locationByName = new Map(dictLocations.map((item) => [item.name, item]));
    
    // 转换为sightings格式以保持前端兼容性
    const sightings = [];
    const birdIdStr = String(birdId);
    records.forEach((record) => {
      const location = record.location || {};
      const observer = record.observer || null;
      const speciesList = (record.birds || [])
        .map((entry) => {
          const birdDoc = entry?.birdId && typeof entry.birdId === 'object' ? entry.birdId : null;
          const name = String(birdDoc?.name || entry?.name || '').trim();
          if (!name) return null;
          return {
            name,
            chinaProtectionLevel: birdDoc?.chinaProtectionLevel || '',
            iucnProtectionLevel: birdDoc?.iucnProtectionLevel || '',
          };
        })
        .filter(Boolean);
      const speciesNames = speciesList.map((item) => item.name);
      (record.birds || []).forEach((bird) => {
        const entryBirdId = getComparableId(bird?.birdId);
        if (!entryBirdId || entryBirdId !== birdIdStr) return;

        const birdDoc = bird.birdId && typeof bird.birdId === 'object' ? bird.birdId : null;
        sightings.push({
          _id: `${record._id}_${entryBirdId}`,
          bird: {
            _id: entryBirdId,
            name: birdDoc?.name || '',
            scientificName: birdDoc?.scientificName || '',
            images: birdDoc?.images || [],
          },
          location: {
            name: location.name || '',
            _id: location._id,
            address: mergeLocationAddress(
              location,
              locationByName.get(String(location.name || '').trim())
            ),
            coordinates: location.coordinates,
          },
          date: record.date,
          observer: observer
            ? {
                name: observer.name,
                _id: observer._id,
                avatar: observer.avatar,
              }
            : null,
          notes: bird.notes || '',
          images: normalizeRecordImages(bird.images || []),
          recordId: record._id,
          speciesNames,
          speciesList,
          speciesCount: speciesList.length,
        });
      });
    });
    
    res.json({
      success: true,
      data: sightings,
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(total / limitNum) || 1,
        totalItems: total,
        itemsPerPage: limitNum,
        hasNextPage: pageNum * limitNum < total,
        hasPrevPage: pageNum > 1,
      }
    });
  } catch (error) {
    devError('获取鸟类观鸟记录失败:', error);
    return sendControllerError(res, error, {
      defaultMessage: '获取鸟类观鸟记录失败',
      defaultCode: 'RECORD_OPERATION_FAILED',
    });
  }
};

// @desc    从地点名录同步坐标到当前记录（按地点名称匹配）
// @route   PUT /api/records/:id/sync-location
// @access  Private
const syncRecordLocation = async (req, res) => {
  try {
    const recordId = req.params.id;
    const userId = req.user.id;

    const record = await Record.findById(recordId);
    if (!record) {
      return sendRecordClientError(res, 404, '观鸟记录不存在', 'RECORD_NOT_FOUND');
    }
    if (!canManageRecord(req.user, record)) {
      return sendRecordClientError(res, 403, '无权限修改此记录', 'RECORD_EDIT_FORBIDDEN');
    }

    const locationName = (record.location && record.location.name || '').trim();
    if (!locationName) {
      return sendRecordClientError(res, 400, '记录无地点名称，无法同步', 'MISSING_LOCATION_NAME');
    }

    const locationDoc = await findActiveLocationByFlexibleName(Location, locationName);
    if (!locationDoc) {
      return sendRecordClientError(
        res,
        404,
        `未找到名称为「${locationName}」的地点，请先在地点名录中创建并填写坐标`,
        'LOCATION_NOT_FOUND'
      );
    }

    const coords = locationDoc.coordinates?.coordinates || locationDoc.coordinates;
    const lng = Number(Array.isArray(coords) ? coords[0] : NaN);
    const lat = Number(Array.isArray(coords) ? coords[1] : NaN);
    if (!Number.isFinite(lng) || !Number.isFinite(lat) || (lng === 0 && lat === 0)) {
      return sendRecordClientError(
        res,
        400,
        `地点「${locationDoc.name}」尚未设置有效坐标，请先在地点名录中补全`,
        'MISSING_LOCATION_COORDINATES'
      );
    }

    record.location = {
      name: locationDoc.name,
      coordinates: { type: 'Point', coordinates: [lng, lat] },
      address: {
        province: locationDoc.address?.province ?? '',
        city: locationDoc.address?.city ?? '',
        district: locationDoc.address?.district ?? '',
        detail: locationDoc.address?.street ?? locationDoc.address?.detail ?? '',
      },
    };
    await record.save();

    clearCache(`/api/records/${recordId}`);
    clearCache('/api/records\\?');

    res.status(200).json({
      success: true,
      message: '已从地点名录同步坐标',
      data: record,
    });
  } catch (error) {
    devError('syncRecordLocation 错误:', error);
    return sendControllerError(res, error, {
      defaultMessage: '同步失败',
      defaultCode: 'RECORD_OPERATION_FAILED',
    });
  }
};

module.exports = {
  getRecords,
  getRecord,
  createRecord,
  editRecord,
  deleteBirdFromRecord,
  deleteRecord,
  getUserRecords,
  getRecordsByBird,
  syncRecordLocation,
  getRecordLocationOptions,
  getRecordMapPoints,
  getMonthlyObservationRecommendations,
};
