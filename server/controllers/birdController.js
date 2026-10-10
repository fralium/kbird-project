const Bird = require('../models/birdModel');
const Record = require('../models/recordModel');
const User = require('../models/userModel');
const { pinyin } = require('pinyin-pro');
const { clearCache, clearLeaderboardCache } = require('../middleware/cache');
const { sendControllerError } = require('../middleware/controllerError');
const { devError, devLog } = require('../utils/devLogger');
const {
  IMAGE_MIME_TO_EXT,
  AUDIO_MIME_TO_EXT,
  getActiveUploadsRoot,
  isPathInside,
  resolveActiveUploadUrl,
  buildSafeImageFileName,
  buildSafeAudioFileName,
} = require('../utils/safeUploadPath');
const { getTempUploadsRoot } = require('../config/dataPaths');
const { normalizeBirdImageTags } = require('../utils/birdImageTags');
const { normalizeBirdCallTags } = require('../utils/birdCallTags');
const { todayLocalDateKey } = require('../utils/dateCoords');
const { buildBirdNameSearchOr, buildAliasPinyinFields } = require('../utils/birdSearch');

const parseFormTags = (rawTags, normalizeFn) => {
  if (typeof rawTags === 'string') {
    try {
      return normalizeFn(JSON.parse(rawTags));
    } catch {
      return normalizeFn(
        String(rawTags)
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean)
      );
    }
  }
  return normalizeFn(rawTags);
};

const escapeRegex = (value = '') => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** 拼音查询归一化：去声调分隔符/空格，便于匹配库内「diao xiao」这类字段 */
const compactPinyinQuery = (value = '') =>
  String(value)
    .toLowerCase()
    .replace(/[''`´]/g, '')
    .replace(/[^a-z0-9]/g, '');

/** 「diaoxiao」可匹配「diao xiao」：字母间允许空格 */
const buildFlexiblePinyinRegex = (compact) => {
  if (!compact) return null;
  return new RegExp(compact.split('').map((ch) => escapeRegex(ch)).join('\\s*'), 'i');
};

const isLatinPinyinQuery = (value = '') => /^[a-zA-Z\s'`´]+$/.test(String(value).trim());

const parseObservationYear = (year) => {
  const yearNum = year != null && String(year).trim() !== '' ? parseInt(String(year).trim(), 10) : NaN;
  if (!Number.isFinite(yearNum) || yearNum < 1900 || yearNum > 2100) return null;
  return yearNum;
};

const buildPublishedRecordDateMatch = (year) => {
  const match = { status: 'published' };
  const yearNum = parseObservationYear(year);
  if (yearNum != null) {
    match.date = {
      $gte: new Date(yearNum, 0, 1, 0, 0, 0, 0),
      $lt: new Date(yearNum + 1, 0, 1, 0, 0, 0, 0),
    };
  }
  return match;
};

const aggregatePublishedBirdStats = async (year) =>
  Record.aggregate([
    { $match: buildPublishedRecordDateMatch(year) },
    { $unwind: '$birds' },
    { $sort: { date: 1 } },
    {
      $group: {
        _id: '$birds.birdId',
        firstObserved: { $first: '$date' },
        firstSeenLocation: {
          $first: {
            $trim: { input: { $ifNull: ['$location.name', ''] } },
          },
        },
        lastObserved: { $last: '$date' },
        recordCount: { $sum: 1 },
      },
    },
  ]);

/** 当前筛选鸟种在已发布记录中的去重观测点（按地点名称） */
const countUniqueLocationsForBirds = async (birdIds, year) => {
  const ids = (Array.isArray(birdIds) ? birdIds : []).filter(Boolean);
  if (ids.length === 0) return 0;

  const match = {
    ...buildPublishedRecordDateMatch(year),
    'birds.birdId': { $in: ids },
  };

  const result = await Record.aggregate([
    { $match: match },
    {
      $group: {
        _id: {
          $trim: { input: { $ifNull: ['$location.name', ''] } },
        },
      },
    },
    { $match: { _id: { $ne: '' } } },
    { $count: 'count' },
  ]);

  return Number(result[0]?.count || 0);
};


const BIRD_WRITABLE_FIELDS = [
  'name',
  'scientificName',
  'englishName',
  'taxonomyCode',
  'namePinyin',
  'scientificNamePinyin',
  'namePinyinInitials',
  'scientificNamePinyinInitials',
  'description',
  'habitat',
  'distribution',
  'conservationStatus',
  'chinaProtectionLevel',
  'iucnProtectionLevel',
  'category',
  'order',
  'family',
  'genus',
  'species',
  'tags',
  'nameAliases',
  'size',
  'weight',
  'wingspan',
  'plumage',
  'bill',
  'legs',
  'behavior',
  'diet',
  'migration',
  'breedingSeason',
  'nestType',
  'clutchSize',
  'identificationTips',
  'similarSpecies',
  'references',
];

const CHINA_PROTECTION_ENUM = ['国家一级', '国家二级', '三有', '省级保护', '未列入'];
const IUCN_PROTECTION_ENUM = [
  '无危(LC)',
  '近危(NT)',
  '易危(VU)',
  '濒危(EN)',
  '极危(CR)',
  '野外灭绝(EW)',
  '灭绝(EX)',
  '数据缺乏(DD)',
  '未评估(NE)',
];

const normalizeChinaLevelServer = (raw) => {
  const text = String(raw || '').trim();
  if (!text) return '';
  if (CHINA_PROTECTION_ENUM.includes(text)) return text;
  const aliases = {
    一级: '国家一级',
    国一: '国家一级',
    二级: '国家二级',
    国二: '国家二级',
    三有保护: '三有',
    省级: '省级保护',
  };
  if (aliases[text]) return aliases[text];
  for (const level of [...CHINA_PROTECTION_ENUM].sort((a, b) => b.length - a.length)) {
    if (text.includes(level)) return level;
  }
  return '';
};

const normalizeIucnLevelServer = (raw) => {
  const text = String(raw || '').trim();
  if (!text) return '';
  if (IUCN_PROTECTION_ENUM.includes(text)) return text;
  const code = text.toUpperCase().match(/\b(LC|NT|VU|EN|CR|EW|EX|DD|NE)\b/);
  const byCode = {
    LC: '无危(LC)',
    NT: '近危(NT)',
    VU: '易危(VU)',
    EN: '濒危(EN)',
    CR: '极危(CR)',
    EW: '野外灭绝(EW)',
    EX: '灭绝(EX)',
    DD: '数据缺乏(DD)',
    NE: '未评估(NE)',
  };
  if (code && byCode[code[1]]) return byCode[code[1]];
  for (const level of [...IUCN_PROTECTION_ENUM].sort((a, b) => b.length - a.length)) {
    if (text.includes(level) || text.includes(level.replace(/\(.*?\)/, ''))) return level;
  }
  return '';
};

const normalizeNameAliases = (value) => {
  const list = Array.isArray(value)
    ? value
    : String(value || '')
        .split(/[,，、;；|/]/)
        .map((item) => item.trim())
        .filter(Boolean);
  const seen = new Set();
  const result = [];
  for (const item of list) {
    const name = String(item || '').trim();
    if (!name || seen.has(name)) continue;
    seen.add(name);
    result.push(name);
  }
  return result;
};

const pickBirdWritableFields = (body = {}, extras = {}) => {
  const data = {};
  for (const key of BIRD_WRITABLE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(body, key)) {
      data[key] = body[key];
    }
  }
  if (Object.prototype.hasOwnProperty.call(data, 'nameAliases')) {
    data.nameAliases = normalizeNameAliases(data.nameAliases);
  }

  // 保护级别：兼容 LLM 短码 / 空串，避免 enum 校验 400
  const statusText = String(data.conservationStatus || body.conservationStatus || '');
  if (
    Object.prototype.hasOwnProperty.call(data, 'chinaProtectionLevel') ||
    Object.prototype.hasOwnProperty.call(data, 'iucnProtectionLevel') ||
    Object.prototype.hasOwnProperty.call(data, 'conservationStatus')
  ) {
    const china =
      normalizeChinaLevelServer(data.chinaProtectionLevel) ||
      normalizeChinaLevelServer(statusText) ||
      '未列入';
    const iucn =
      normalizeIucnLevelServer(data.iucnProtectionLevel) ||
      normalizeIucnLevelServer(statusText) ||
      '未评估(NE)';
    data.chinaProtectionLevel = china;
    data.iucnProtectionLevel = iucn;
    if (!String(data.conservationStatus || '').trim()) {
      const parts = [];
      if (china && china !== '未列入') parts.push(`中国: ${china}`);
      if (iucn && iucn !== '未评估(NE)') parts.push(`IUCN: ${iucn}`);
      data.conservationStatus = parts.length ? parts.join(' | ') : '未评估';
    }
  }

  const nameForPinyin = data.name || extras.name || '';
  const aliasesForPinyin = Object.prototype.hasOwnProperty.call(data, 'nameAliases')
    ? data.nameAliases
    : extras.nameAliases;
  if (nameForPinyin || (aliasesForPinyin && aliasesForPinyin.length)) {
    Object.assign(data, buildAliasPinyinFields(nameForPinyin, aliasesForPinyin || []));
  }
  return data;
};

const sendBirdClientError = (res, status, message, code) => {
  const error = new Error(message);
  error.statusCode = status;
  error.code = code;
  return sendControllerError(res, error, {
    defaultMessage: message,
    defaultCode: code,
    fallbackStatus: status,
  });
};

// @desc    获取所有鸟类或按条件搜索
// @route   GET /api/birds
// @access  Public
const getBirds = async (req, res) => {
  try {
    const { 
      search, 
      category, 
      order,
      family,
      conservationStatus,
      iucnProtectionLevel,
      chinaProtectionLevel,
      hasRecordsOnly = 'false',
      year,
      sortBy = 'lastObserved',
      sortOrder = 'desc',
      limit = 10, 
      page = 1 
    } = req.query;
    
    // 构建查询条件
    const query = {};
    
    // 搜索功能 - 支持模糊搜索和拼音匹配
    if (search) {
      const rawSearch = String(search).trim();
      const searchRegex = new RegExp(escapeRegex(rawSearch), 'i');
      let searchConditions = [];

      try {
        if (isLatinPinyinQuery(rawSearch)) {
          // 拼音 / 首字母 / 学名片段（支持 diao、diao xiao、diao'xiao、diaoxiao）
          const compact = compactPinyinQuery(rawSearch);
          const flexiblePinyinRegex = buildFlexiblePinyinRegex(compact);
          const initialsRegex = compact ? new RegExp(escapeRegex(compact), 'i') : null;

          if (initialsRegex) {
            searchConditions.push(
              { namePinyinInitials: initialsRegex },
              { nameAliasPinyinInitials: initialsRegex },
              { scientificNamePinyinInitials: initialsRegex }
            );
          }
          if (flexiblePinyinRegex) {
            searchConditions.push(
              { namePinyin: flexiblePinyinRegex },
              { nameAliasPinyin: flexiblePinyinRegex },
              { scientificNamePinyin: flexiblePinyinRegex }
            );
          }
          // 学名：去掉分隔符后再比，避免拼音干扰过短查询
          if (compact.length > 2) {
            searchConditions.push(
              { scientificName: searchRegex },
              { scientificName: new RegExp(escapeRegex(compact), 'i') }
            );
          }
          searchConditions.unshift(...buildBirdNameSearchOr(rawSearch));
        } else {
          // 中文或其他：名称 + 转拼音再匹配
          const searchPinyin = pinyin(rawSearch, { toneType: 'none', type: 'string' });
          const searchPinyinCompact = compactPinyinQuery(searchPinyin);
          const searchPinyinRegex = new RegExp(escapeRegex(searchPinyin), 'i');
          const searchPinyinInitials = String(searchPinyin)
            .split(/\s+/)
            .map((word) => word.charAt(0))
            .join('');
          const searchPinyinInitialsRegex = new RegExp(escapeRegex(searchPinyinInitials), 'i');
          const flexiblePinyinRegex = buildFlexiblePinyinRegex(searchPinyinCompact);

          searchConditions = [
            ...buildBirdNameSearchOr(rawSearch),
            { namePinyin: searchPinyinRegex },
            { scientificNamePinyin: searchPinyinRegex },
            { namePinyinInitials: searchPinyinInitialsRegex },
            { nameAliasPinyinInitials: searchPinyinInitialsRegex },
            { scientificNamePinyinInitials: searchPinyinInitialsRegex },
          ];
          if (flexiblePinyinRegex) {
            searchConditions.push(
              { namePinyin: flexiblePinyinRegex },
              { nameAliasPinyin: flexiblePinyinRegex },
              { scientificNamePinyin: flexiblePinyinRegex }
            );
          }
        }
      } catch (error) {
        devLog('拼音转换失败，回退名称搜索:', error.message);
        searchConditions = buildBirdNameSearchOr(rawSearch);
      }

      if (searchConditions.length > 0) {
        query.$or = searchConditions;
      }
    }
    
    // 分类筛选（支持旧的category和新的order参数）
    if (category) {
      query.category = { $regex: escapeRegex(category), $options: 'i' };
    }
    
    // 目筛选（新的order字段）
    if (order) {
      query.order = order;
    }
    
    // 科筛选
    if (family) {
      query.family = family;
    }
    
    // 保护状态筛选
    if (conservationStatus) {
      query.conservationStatus = conservationStatus;
    }
    
    // IUCN保护等级筛选
    if (iucnProtectionLevel) {
      query.iucnProtectionLevel = iucnProtectionLevel;
    }
    
    // 中国保护等级筛选
    if (chinaProtectionLevel) {
      query.chinaProtectionLevel = chinaProtectionLevel;
    }

    const filterByPublishedRecords = hasRecordsOnly === 'true' || parseObservationYear(year) != null;
    let publishedRecordStats = [];
    let publishedRecordMap = new Map();

    if (filterByPublishedRecords) {
      publishedRecordStats = await aggregatePublishedBirdStats(year);
      const publishedBirdIds = publishedRecordStats.map((record) => record._id).filter(Boolean);
      if (publishedBirdIds.length === 0) {
        return res.status(200).json({
          success: true,
          data: [],
          total: 0,
          page: parseInt(page),
          pages: 0,
          summary: {
            speciesCount: 0,
            locationCount: 0,
            year: parseObservationYear(year),
          },
          pagination: {
            currentPage: parseInt(page),
            totalPages: 0,
            totalItems: 0,
            itemsPerPage: parseInt(limit)
          }
        });
      }

      query._id = { $in: publishedBirdIds };
      publishedRecordMap = new Map(
        publishedRecordStats.map((record) => [
          record._id.toString(),
          {
            firstObserved: record.firstObserved,
            firstSeenLocation: record.firstSeenLocation || '',
            lastObserved: record.lastObserved,
            recordCount: record.recordCount
          }
        ])
      );
    }
    
    // 分页
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // 使用聚合管道优化查询性能
    const pipeline = [
      { $match: query },
      {
        $lookup: {
          from: 'users',
          localField: 'createdBy',
          foreignField: '_id',
          as: 'createdBy',
          pipeline: [{ $project: { name: 1 } }]
        }
      },
      {
        $addFields: {
          createdBy: { $arrayElemAt: ['$createdBy', 0] }
        }
      }
    ];
    
    // 如果有搜索条件，优先显示精确匹配的结果
    if (search) {
      const escapedSearch = escapeRegex(String(search).trim());
      const searchExact = String(search).trim();
      pipeline.push({
        $addFields: {
          relevanceScore: {
            $switch: {
              branches: [
                {
                  case: {
                    $regexMatch: { input: '$name', regex: new RegExp(`^${escapedSearch}$`, 'i') },
                  },
                  then: 100,
                },
                {
                  case: { $in: [searchExact, { $ifNull: ['$nameAliases', []] }] },
                  then: 98,
                },
                {
                  case: {
                    $regexMatch: { input: '$name', regex: new RegExp(escapedSearch, 'i') },
                  },
                  then: 90,
                },
                {
                  case: {
                    $gt: [
                      {
                        $size: {
                          $filter: {
                            input: { $ifNull: ['$nameAliases', []] },
                            as: 'alias',
                            cond: {
                              $regexMatch: {
                                input: '$$alias',
                                regex: new RegExp(escapedSearch, 'i'),
                              },
                            },
                          },
                        },
                      },
                      0,
                    ],
                  },
                  then: 88,
                },
              ],
              default: 80,
            },
          },
        },
      });
      pipeline.push({ $sort: { relevanceScore: -1, createdAt: -1 } });
    } else {
      // 没有搜索条件时，先获取所有鸟类，然后按最近观察记录时间排序
      const birds = await Bird.aggregate(pipeline);
      
      // 获取每个鸟类的最近观察记录时间
      const birdIds = birds.map(bird => bird._id);
      const birdIdSet = new Set(birdIds.map((birdId) => birdId.toString()));
      const recentRecords = filterByPublishedRecords
        ? publishedRecordStats.filter((record) => birdIdSet.has(record._id.toString()))
        : await Record.aggregate([
            {
              $match: {
                'birds.birdId': { $in: birdIds },
                status: 'published'  // 与 Record 模型一致：只统计已发布记录，排除 draft
              }
            },
            {
              $unwind: '$birds'
            },
            {
              $match: {
                'birds.birdId': { $in: birdIds }
              }
            },
            { $sort: { date: 1 } },
            {
              $group: {
                _id: '$birds.birdId',
                firstObserved: { $first: '$date' },
                firstSeenLocation: {
                  $first: {
                    $trim: { input: { $ifNull: ['$location.name', ''] } },
                  },
                },
                lastObserved: { $last: '$date' },
                recordCount: { $sum: 1 }
              }
            }
          ]);
      
      // 创建最近观察时间的映射
      const lastObservedMap = new Map();
      recentRecords.forEach(record => {
        lastObservedMap.set(record._id.toString(), {
          firstObserved: record.firstObserved,
          firstSeenLocation: record.firstSeenLocation || '',
          lastObserved: record.lastObserved,
          recordCount: record.recordCount
        });
      });
      
      // 为每个鸟类添加首次/最近观察时间信息
      birds.forEach(bird => {
        const birdId = bird._id.toString();
        const recordInfo = lastObservedMap.get(birdId);
        if (recordInfo) {
          bird.firstObserved = recordInfo.firstObserved;
          bird.firstSeenLocation = recordInfo.firstSeenLocation || '';
          bird.lastObserved = recordInfo.lastObserved;
          bird.recordCount = recordInfo.recordCount;
        } else {
          bird.firstObserved = null;
          bird.firstSeenLocation = '';
          bird.lastObserved = null;
          bird.recordCount = 0;
        }
      });
      
      const normalizedSortOrder = sortOrder === 'asc' ? 1 : -1;
      const getProtectionRank = (bird) => {
        const chinaLevel = bird.chinaProtectionLevel;
        if (chinaLevel === '国家一级') return 6;
        if (chinaLevel === '国家二级') return 5;
        if (chinaLevel === '三有') return 4;

        const iucnLevel = String(bird.iucnProtectionLevel || '').toUpperCase();
        if (['CR', '极危'].includes(iucnLevel)) return 3;
        if (['EN', '濒危'].includes(iucnLevel)) return 2;
        if (['VU', '易危'].includes(iucnLevel)) return 1;
        return 0;
      };

      // 排序逻辑：支持保护等级、观测次数、最近观察日期、名称、综合推荐
      birds.sort((a, b) => {
        const getPriorityScore = (bird) => {
          let score = 0;
          const images = Array.isArray(bird?.images) ? bird.images : [];
          
          // 有照片加分（爱鸟网照片额外加分）
          if (images.length > 0) {
            score += 100;
            
            // 爱鸟网照片额外加分
            const hasBirdfansImage = images.some((img) => {
              const url = typeof img === 'string' ? img : img?.url;
              return typeof url === 'string' && url.includes('_birdfans_');
            });
            if (hasBirdfansImage) {
              score += 50;
            }
          }
          
          // 有观察记录加分
          if (bird.lastObserved) {
            score += 80;
            
            // 记录数量越多加分越多（最多加20分）
            const recordBonus = Math.min(bird.recordCount * 2, 20);
            score += recordBonus;
          }
          
          // 保护等级加分（国家一级最高，国家二级次之）
          if (bird.chinaProtectionLevel === '国家一级') {
            score += 30;
          } else if (bird.chinaProtectionLevel === '国家二级') {
            score += 20;
          } else if (bird.chinaProtectionLevel === '三有') {
            score += 10;
          }
          
          return score;
        };

        if (sortBy === 'protection') {
          const rankA = getProtectionRank(a);
          const rankB = getProtectionRank(b);
          if (rankA !== rankB) {
            return normalizedSortOrder * (rankA - rankB);
          }
        } else if (sortBy === 'recordCount') {
          const countA = Number(a.recordCount || 0);
          const countB = Number(b.recordCount || 0);
          if (countA !== countB) {
            return normalizedSortOrder * (countA - countB);
          }
        } else if (sortBy === 'lastObserved') {
          const dateA = a.lastObserved ? new Date(a.lastObserved).getTime() : 0;
          const dateB = b.lastObserved ? new Date(b.lastObserved).getTime() : 0;
          if (dateA !== dateB) {
            return normalizedSortOrder * (dateA - dateB);
          }
        } else if (sortBy === 'firstObserved') {
          const dateA = a.firstObserved ? new Date(a.firstObserved).getTime() : 0;
          const dateB = b.firstObserved ? new Date(b.firstObserved).getTime() : 0;
          if (dateA !== dateB) {
            return normalizedSortOrder * (dateA - dateB);
          }
        } else if (sortBy === 'updatedAt') {
          const updatedA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
          const updatedB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
          if (updatedA !== updatedB) {
            return normalizedSortOrder * (updatedA - updatedB);
          }
        } else if (sortBy === 'name') {
          const nameCmp = String(a.name || '').localeCompare(String(b.name || ''), 'zh-CN');
          if (nameCmp !== 0) {
            return normalizedSortOrder * nameCmp;
          }
        } else if (sortBy === 'priority') {
          const scoreA = getPriorityScore(a);
          const scoreB = getPriorityScore(b);
          if (scoreA !== scoreB) {
            return normalizedSortOrder * (scoreA - scoreB);
          }
        }

        // 默认并列时：最近观察 → 名称
        const dateA = a.lastObserved ? new Date(a.lastObserved).getTime() : 0;
        const dateB = b.lastObserved ? new Date(b.lastObserved).getTime() : 0;
        if (dateA !== dateB) {
          return dateB - dateA;
        }
        return String(a.name || '').localeCompare(String(b.name || ''), 'zh-CN');
      });
      
      // 应用分页
      const paginatedBirds = birds.slice(skip, skip + parseInt(limit));
      const totalBirds = birds.length;
      const locationCount = await countUniqueLocationsForBirds(
        birds.map((bird) => bird._id),
        year
      );
      
      res.status(200).json({
        success: true,
        data: paginatedBirds,
        total: totalBirds,
        page: parseInt(page),
        pages: Math.ceil(totalBirds / parseInt(limit)) || 0,
        summary: {
          speciesCount: totalBirds,
          locationCount,
          year: parseObservationYear(year),
        },
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalBirds / parseInt(limit)) || 0,
          totalItems: totalBirds,
          itemsPerPage: parseInt(limit)
        }
      });
      
      return;
    }
    
    pipeline.push({ $skip: skip });
    pipeline.push({ $limit: parseInt(limit) });

    const birds = await Bird.aggregate(pipeline);

    if (filterByPublishedRecords) {
      birds.forEach((bird) => {
        const recordInfo = publishedRecordMap.get(bird._id.toString());
        if (recordInfo) {
          bird.firstObserved = recordInfo.firstObserved;
          bird.firstSeenLocation = recordInfo.firstSeenLocation || '';
          bird.lastObserved = recordInfo.lastObserved;
          bird.recordCount = recordInfo.recordCount;
        }
      });
    }
    
    // 对每个鸟类的图片进行排序（按order字段）
    birds.forEach(bird => {
      if (bird.images && bird.images.length > 0) {
        bird.images.sort((a, b) => (a.order || 0) - (b.order || 0));
      }
    });
    
    // 获取总数 - 使用更高效的countDocuments
    const total = await Bird.countDocuments(query);
    const matchedIds = await Bird.find(query).select('_id').lean();
    const locationCount = await countUniqueLocationsForBirds(
      matchedIds.map((doc) => doc._id),
      year
    );
    
    res.status(200).json({
      success: true,
      count: birds.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      summary: {
        speciesCount: total,
        locationCount,
        year: parseObservationYear(year),
      },
      data: birds,
    });
  } catch (error) {
    return sendControllerError(res, error, {
      defaultMessage: '服务器错误',
      defaultCode: 'BIRD_OPERATION_FAILED',
    });
  }
};

// @desc    已见鸟种筛选选项（目/科/保护等级）
// @route   GET /api/birds/filter-options
// @access  Public
const getBirdFilterOptions = async (req, res) => {
  try {
    const {
      hasRecordsOnly = 'true',
      year,
    } = req.query;

    const query = {};
    if (hasRecordsOnly === 'true' || parseObservationYear(year) != null) {
      const stats = await aggregatePublishedBirdStats(year);
      const birdIds = stats.map((item) => item._id).filter(Boolean);
      if (birdIds.length === 0) {
        return res.status(200).json({
          success: true,
          data: {
            categories: [],
            families: [],
            allFamilies: [],
            categoryToFamilies: {},
            iucnLevels: [],
            chinaLevels: [],
          },
        });
      }
      query._id = { $in: birdIds };
    }

    const birds = await Bird.find(query)
      .select('order family iucnProtectionLevel chinaProtectionLevel')
      .lean();

    const categories = [...new Set(birds.map((bird) => bird.order).filter(Boolean))].sort((a, b) =>
      String(a).localeCompare(String(b), 'zh-CN')
    );
    const allFamilies = [...new Set(birds.map((bird) => bird.family).filter(Boolean))].sort((a, b) =>
      String(a).localeCompare(String(b), 'zh-CN')
    );
    const categoryToFamilies = {};
    birds.forEach((bird) => {
      if (!bird.order || !bird.family) return;
      if (!categoryToFamilies[bird.order]) categoryToFamilies[bird.order] = [];
      if (!categoryToFamilies[bird.order].includes(bird.family)) {
        categoryToFamilies[bird.order].push(bird.family);
      }
    });
    Object.keys(categoryToFamilies).forEach((category) => {
      categoryToFamilies[category].sort((a, b) => String(a).localeCompare(String(b), 'zh-CN'));
    });

    const iucnLevels = [...new Set(birds.map((bird) => bird.iucnProtectionLevel).filter(Boolean))].sort();
    const chinaLevels = [...new Set(birds.map((bird) => bird.chinaProtectionLevel).filter(Boolean))].sort();

    return res.status(200).json({
      success: true,
      data: {
        categories,
        families: allFamilies,
        allFamilies,
        categoryToFamilies,
        iucnLevels,
        chinaLevels,
      },
    });
  } catch (error) {
    return sendControllerError(res, error, {
      defaultMessage: '获取筛选选项失败',
      defaultCode: 'BIRD_FILTER_OPTIONS_FAILED',
    });
  }
};

// @desc    获取单个鸟类详情
// @route   GET /api/birds/:id
// @access  Public
const getBirdById = async (req, res) => {
  try {
    const bird = await Bird.findById(req.params.id)
      .populate('images.photographer', 'name avatar')
      .populate('sightings.observer', 'name avatar');
    
    if (!bird) {
      return sendBirdClientError(res, 404, '未找到该鸟类记录', 'BIRD_NOT_FOUND');
    }
    
    // 对图片进行排序（按order字段）
    if (bird.images && bird.images.length > 0) {
      bird.images.sort((a, b) => (a.order || 0) - (b.order || 0));
    }
    
    res.status(200).json({
      success: true,
      data: bird,
    });
  } catch (error) {
    return sendControllerError(res, error, {
      defaultMessage: '服务器错误',
      defaultCode: 'BIRD_OPERATION_FAILED',
    });
  }
};

// @desc    创建新鸟类记录
// @route   POST /api/birds
// @access  Private
const createBird = async (req, res) => {
  try {
    // 仅允许白名单字段，禁止通过 mass assignment 注入 images/sightings 等
    const birdData = {
      ...pickBirdWritableFields(req.body),
      createdBy: req.user._id,
      images: [],
      sightings: [],
    };
    
    const bird = await Bird.create(birdData);
    
    // 将新创建的鸟类添加到用户的贡献列表中
    await User.findByIdAndUpdate(
      req.user._id,
      { $push: { contributions: bird._id } }
    );

    clearLeaderboardCache();
    
    res.status(201).json({
      success: true,
      data: bird,
      message: '鸟类记录创建成功'
    });
  } catch (error) {
    return sendControllerError(res, error, {
      defaultMessage: '创建鸟类记录失败',
      defaultCode: 'BIRD_OPERATION_FAILED',
    });
  }
};

// @desc    更新鸟类信息
// @route   PUT /api/birds/:id
// @access  Private
const updateBird = async (req, res) => {
  try {
    devLog('更新鸟类记录请求:', {
      birdId: req.params.id,
      body: req.body,
      imagesCount: req.body.images ? req.body.images.length : '无images字段'
    });
    
    const bird = await Bird.findById(req.params.id);
    
    if (!bird) {
      return sendBirdClientError(res, 404, '未找到该鸟类记录', 'BIRD_NOT_FOUND');
    }
    
    devLog('更新前图片数量:', bird.images.length);
    
    const updatedBird = await Bird.findByIdAndUpdate(
      req.params.id,
      pickBirdWritableFields(req.body, { name: bird.name, nameAliases: bird.nameAliases }),
      { new: true, runValidators: true }
    );
    
    devLog('更新后图片数量:', updatedBird.images.length);
    devLog('更新后图片详情:', updatedBird.images.map((img, i) => ({
      index: i,
      url: img.url,
      order: img.order,
      _id: img._id
    })));
    
    // 清除相关缓存
    clearCache(`/api/birds/${req.params.id}`);
    clearCache('/api/birds\\?');
    clearCache('/api/records\\?');
    clearLeaderboardCache();
    
    res.status(200).json({
      success: true,
      data: updatedBird,
    });
  } catch (error) {
    devError('更新鸟类记录错误:', error);
    return sendControllerError(res, error, {
      defaultMessage: '更新鸟类记录失败',
      defaultCode: 'BIRD_OPERATION_FAILED',
    });
  }
};

// @desc    删除鸟类记录
// @route   DELETE /api/birds/:id
// @access  Private
const deleteBird = async (req, res) => {
  try {
    const bird = await Bird.findById(req.params.id);
    
    if (!bird) {
      return sendBirdClientError(res, 404, '未找到该鸟类记录', 'BIRD_NOT_FOUND');
    }
    
    await Bird.findByIdAndDelete(req.params.id);
    
    // 清除相关缓存
    clearCache(`/api/birds/${req.params.id}`);
    clearCache('/api/birds\\?');
    clearCache('/api/records\\?');
    clearLeaderboardCache();
    
    res.status(200).json({
      success: true,
      message: '鸟类记录已删除',
    });
  } catch (error) {
    return sendControllerError(res, error, {
      defaultMessage: '服务器错误',
      defaultCode: 'BIRD_OPERATION_FAILED',
    });
  }
};

// @desc    添加鸟类目击记录
// @route   POST /api/birds/:id/sightings
// @access  Private
const addBirdSighting = async (req, res) => {
  try {
    devLog('添加观察记录请求:', {
      birdId: req.params.id,
      body: req.body,
      user: req.user
    });
    
    const bird = await Bird.findById(req.params.id);
    
    if (!bird) {
      devLog('鸟类记录未找到:', req.params.id);
      return sendBirdClientError(res, 404, '未找到该鸟类记录', 'BIRD_NOT_FOUND');
    }
    
    // 构建观察记录数据（图片 URL 必须净化；不再伪造 pending 审核字段）
    const sightingData = {
      location: {
        type: 'Point',
        coordinates: [
          parseFloat(req.body.location.coordinates[0]) || 0,
          parseFloat(req.body.location.coordinates[1]) || 0
        ],
        name: req.body.location.name
      },
      date: new Date(req.body.date),
      observer: req.user._id,
      notes: req.body.notes,
      weather: req.body.weather || '',
      behavior: req.body.behavior || '',
      images: (Array.isArray(req.body.images) ? req.body.images : [])
        .map((img) => {
          const resolved = resolveActiveUploadUrl(img?.url);
          if (!resolved) return null;
          return { url: resolved.url, caption: img.caption || '' };
        })
        .filter(Boolean),
      submittedAt: new Date(),
    };
    
    // 注意：图片已经在添加观察记录前上传到图片栏，这里不需要重复添加
    // 观察记录中的图片只用于在观察记录中显示
    
    bird.sightings.push(sightingData);
    await bird.save();
    
    // 重新查询并populate用户信息
    const updatedBird = await Bird.findById(req.params.id)
      .populate('images.photographer', 'name avatar')
      .populate('sightings.observer', 'name avatar');

    clearLeaderboardCache();
    
    res.status(201).json({
      success: true,
      message: '观察记录已提交，等待管理员审核',
      data: updatedBird
    });
  } catch (error) {
    devError('添加观察记录失败:', error);
    return sendControllerError(res, error, {
      defaultMessage: '添加目击记录失败',
      defaultCode: 'BIRD_OPERATION_FAILED',
    });
  }
};

// @desc    添加鸟类图片
// @route   POST /api/birds/:id/images
// @access  Private
const addBirdImage = async (req, res) => {
  try {
    devLog('添加鸟类图片请求:', {
      birdId: req.params.id,
      user: req.user ? req.user._id : '无用户信息',
      hasFile: !!req.file,
      fileInfo: req.file ? {
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size
      } : '无文件',
      contentType: req.headers['content-type']
    });

    const bird = await Bird.findById(req.params.id);
    
    if (!bird) {
      return sendBirdClientError(res, 404, '未找到该鸟类记录', 'BIRD_NOT_FOUND');
    }
    
    // 处理文件上传
    let imageData = {
      url: '',
      caption: req.body.caption || '',
      location: req.body.location || '',
      date: req.body.date ? new Date(req.body.date) : new Date(),
      photographer: req.user._id,
      order: bird.images.length, // 设置order为当前图片数量
      tags: parseFormTags(req.body.tags, normalizeBirdImageTags),
    };
    
    // 如果有上传的文件
    if (req.file) {
      // 验证文件类型
      if (!IMAGE_MIME_TO_EXT[req.file.mimetype]) {
        return sendBirdClientError(
          res,
          400,
          '不支持的文件类型，请上传 JPG、PNG、GIF 或 WEBP 格式的图片',
          'UNSUPPORTED_IMAGE_FORMAT'
        );
      }
      
      // 验证文件大小 (10MB)
      const maxSize = 10 * 1024 * 1024;
      if (req.file.size > maxSize) {
        return sendBirdClientError(res, 400, '文件大小不能超过 10MB', 'FILE_TOO_LARGE');
      }
      
      // 扩展名仅来自 MIME，禁止使用 originalname 拼路径
      const fileName = buildSafeImageFileName(req.file.mimetype);
      if (!fileName) {
        return sendBirdClientError(res, 400, '不支持的文件类型', 'UNSUPPORTED_IMAGE_FORMAT');
      }
      const filePath = `/uploads/active/${fileName}`;
      
      const fs = require('fs');
      const path = require('path');
      const uploadDir = getActiveUploadsRoot();
      
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      
      const fullPath = path.join(uploadDir, fileName);
      if (!isPathInside(uploadDir, fullPath)) {
        return sendBirdClientError(res, 400, '非法文件路径', 'INVALID_IMAGE_PATH');
      }
      fs.writeFileSync(fullPath, req.file.buffer);
      
      imageData.url = filePath;
    } else if (req.body.url) {
      const resolved = resolveActiveUploadUrl(req.body.url);
      if (!resolved) {
        return sendBirdClientError(
          res,
          400,
          '图片URL必须来自受控上传目录',
          'INVALID_IMAGE_URL'
        );
      }
      imageData.url = resolved.url;
    } else {
      return sendBirdClientError(res, 400, '请提供图片文件或URL', 'MISSING_IMAGE_INPUT');
    }
    
    bird.images.push(imageData);
    await bird.save();
    
    // 清除相关缓存
    clearCache(`/api/birds/${req.params.id}`);
    clearCache('/api/birds\\?');
    
    res.status(201).json({
      success: true,
      data: bird,
      message: '图片添加成功'
    });
  } catch (error) {
    devError('添加图片失败 - 详细错误:', {
      message: error.message,
      stack: error.stack,
      birdId: req.params.id,
      userId: req.user ? req.user._id : '无用户信息',
      hasFile: !!req.file
    });
    
    return sendControllerError(res, error, {
      defaultMessage: '添加图片失败',
      defaultCode: 'BIRD_IMAGE_ADD_FAILED',
    });
  }
};

// @desc    检查鸟类是否重复
// @route   POST /api/birds/check-duplicate
// @access  Private
const checkDuplicate = async (req, res) => {
  try {
    const { name, scientificName, names } = req.body;
    
    // 支持单个名称和批量名称检查
    if (!name && !scientificName && !names) {
      return sendBirdClientError(res, 400, '请提供鸟类名称或学名', 'MISSING_SEARCH_KEYWORDS');
    }

    // 处理批量名称检查
    if (names && Array.isArray(names)) {
      const allDuplicates = {};
      
      for (const birdName of names) {
        if (birdName && birdName.trim()) {
          const query = {
            $or: [
              { name: { $regex: escapeRegex(birdName.trim()), $options: 'i' } },
              { nameAliases: { $regex: escapeRegex(birdName.trim()), $options: 'i' } },
            ],
          };
          const similarBirds = await Bird.find(query)
            .select('name scientificName nameAliases description habitat distribution category order family genus species')
            .populate('createdBy', 'name')
            .limit(5);

          if (similarBirds.length > 0) {
            allDuplicates[birdName] = similarBirds.map(bird => ({
              _id: bird._id,
              name: bird.name,
              scientificName: bird.scientificName,
              description: bird.description,
              habitat: bird.habitat,
              distribution: bird.distribution,
              category: bird.category,
              createdBy: bird.createdBy
            }));
          }
        }
      }

      return res.status(200).json({
        success: true,
        data: {
          duplicates: allDuplicates,
          totalChecked: names.length,
          foundDuplicates: Object.keys(allDuplicates).length
        }
      });
    }

    // 单个名称检查（保持向后兼容）
    const query = {};
    if (name) {
      const nameRegex = { $regex: escapeRegex(name.trim()), $options: 'i' };
      query.$or = [{ name: nameRegex }, { nameAliases: nameRegex }];
    }
    if (scientificName) {
      query.scientificName = { $regex: escapeRegex(scientificName.trim()), $options: 'i' };
    }

    // 查找相似的鸟类
    const similarBirds = await Bird.find(query)
      .select('name scientificName nameAliases description habitat distribution category order family genus species')
      .populate('createdBy', 'name')
      .limit(10);

    // 计算相似度
    const results = similarBirds.map(bird => {
      let similarity = 0;
      let matchReasons = [];

      // 名称相似度检查
      if (name && bird.name) {
        const nameSimilarity = calculateSimilarity(name.toLowerCase(), bird.name.toLowerCase());
        if (nameSimilarity > 0.7) {
          similarity += nameSimilarity * 0.6;
          matchReasons.push(`名称相似度: ${Math.round(nameSimilarity * 100)}%`);
        }
        const aliasHit = (bird.nameAliases || []).some((alias) => {
          const text = String(alias || '');
          return text === name.trim() || text.includes(name.trim()) || name.trim().includes(text);
        });
        if (aliasHit) {
          similarity = Math.max(similarity, 0.9);
          matchReasons.push('中文别名匹配');
        }
      }

      // 学名相似度检查
      if (scientificName && bird.scientificName) {
        const scientificSimilarity = calculateSimilarity(scientificName.toLowerCase(), bird.scientificName.toLowerCase());
        if (scientificSimilarity > 0.8) {
          similarity += scientificSimilarity * 0.4;
          matchReasons.push(`学名相似度: ${Math.round(scientificSimilarity * 100)}%`);
        }
      }

      return {
        ...bird.toObject(),
        similarity: Math.round(similarity * 100),
        matchReasons
      };
    }).filter(bird => bird.similarity > 50).sort((a, b) => b.similarity - a.similarity);

    res.status(200).json({
      success: true,
      data: {
        hasDuplicates: results.length > 0,
        duplicates: results,
        totalFound: results.length
      }
    });
  } catch (error) {
    return sendControllerError(res, error, {
      defaultMessage: '查重检查失败',
      defaultCode: 'BIRD_OPERATION_FAILED',
    });
  }
};

// 计算字符串相似度的函数
const calculateSimilarity = (str1, str2) => {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) {
    return 1.0;
  }
  
  const distance = levenshteinDistance(longer, shorter);
  return (longer.length - distance) / longer.length;
};

// 计算编辑距离
const levenshteinDistance = (str1, str2) => {
  const matrix = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
};

// @desc    设置鸟类主图（按 order 排序后第一张）
// @route   PUT /api/birds/:id/images/:imageIndex/set-main
// @access  Private
const setMainBirdImage = async (req, res) => {
  try {
    const bird = await Bird.findById(req.params.id);

    if (!bird) {
      return sendBirdClientError(res, 404, '未找到该鸟类记录', 'BIRD_NOT_FOUND');
    }

    if (!Array.isArray(bird.images) || bird.images.length === 0) {
      return sendBirdClientError(res, 400, '该鸟类暂无图片', 'NO_IMAGES');
    }

    // 与列表展示一致：先按 order 排序，再按当前展示索引取值
    bird.images.sort((a, b) => (a.order || 0) - (b.order || 0));

    const imageIndex = Number.parseInt(req.params.imageIndex, 10);
    if (!Number.isInteger(imageIndex) || imageIndex < 0 || imageIndex >= bird.images.length) {
      return sendBirdClientError(res, 400, '无效的图片索引', 'INVALID_IMAGE_INDEX');
    }

    if (imageIndex === 0) {
      return res.status(200).json({
        success: true,
        data: bird,
        message: '该图片已是主图',
      });
    }

    const [selected] = bird.images.splice(imageIndex, 1);
    bird.images.unshift(selected);
    bird.images.forEach((img, i) => {
      img.order = i;
    });
    bird.markModified('images');
    await bird.save();

    clearCache(`/api/birds/${req.params.id}`);
    clearCache('/api/birds\\?');
    clearCache('/api/birds');

    res.status(200).json({
      success: true,
      data: bird,
      message: '主图设置成功',
    });
  } catch (error) {
    return sendControllerError(res, error, {
      defaultMessage: '设置主图失败',
      defaultCode: 'BIRD_OPERATION_FAILED',
    });
  }
};

// @desc    更新鸟类图片信息
// @route   PUT /api/birds/:id/images/:imageIndex
// @access  Private
const updateBirdImage = async (req, res) => {
  try {
    const bird = await Bird.findById(req.params.id);
    
    if (!bird) {
      return sendBirdClientError(res, 404, '未找到该鸟类记录', 'BIRD_NOT_FOUND');
    }

    // 与前端展示一致：先按 order 排序再按索引定位
    bird.images.sort((a, b) => (a.order || 0) - (b.order || 0));
    
    const imageIndex = Number.parseInt(req.params.imageIndex, 10);
    if (!Number.isInteger(imageIndex) || imageIndex < 0 || imageIndex >= bird.images.length) {
      return sendBirdClientError(res, 400, '无效的图片索引', 'INVALID_IMAGE_INDEX');
    }

    const targetImage = bird.images[imageIndex];
    // 已登录用户均可维护鸟种图库（与上传权限一致）
    if (!req.user) {
      return sendBirdClientError(res, 401, '请先登录', 'UNAUTHORIZED');
    }
    
    // 更新图片信息
    let nextUrl = targetImage.url;
    const isAdmin = req.user.role === 'admin';
    if (isAdmin && req.body.url) {
      const resolved = resolveActiveUploadUrl(req.body.url);
      if (!resolved) {
        return sendBirdClientError(res, 400, '图片URL必须来自受控上传目录', 'INVALID_IMAGE_URL');
      }
      nextUrl = resolved.url;
    }

    bird.images[imageIndex] = {
      ...targetImage.toObject?.() || targetImage,
      caption: req.body.caption !== undefined ? req.body.caption : targetImage.caption,
      location: req.body.location !== undefined ? req.body.location : targetImage.location,
      date: req.body.date ? new Date(req.body.date) : targetImage.date,
      url: nextUrl,
      tags:
        req.body.tags !== undefined
          ? normalizeBirdImageTags(req.body.tags)
          : Array.isArray(targetImage.tags)
            ? targetImage.tags
            : [],
    };
    bird.markModified('images');
    
    await bird.save();
    
    res.status(200).json({
      success: true,
      data: bird,
      message: '图片信息更新成功'
    });
  } catch (error) {
    return sendControllerError(res, error, {
      defaultMessage: '更新图片信息失败',
      defaultCode: 'BIRD_OPERATION_FAILED',
    });
  }
};

// @desc    删除鸟类图片
// @route   DELETE /api/birds/:id/images/:imageIndex
// @access  Private
const deleteBirdImage = async (req, res) => {
  try {
    devLog('删除图片请求:', {
      birdId: req.params.id,
      imageIndex: req.params.imageIndex,
      userId: req.user ? req.user.id : '未认证'
    });

    const bird = await Bird.findById(req.params.id);
    
    if (!bird) {
      devLog('鸟类记录不存在:', req.params.id);
      return sendBirdClientError(res, 404, '未找到该鸟类记录', 'BIRD_NOT_FOUND');
    }

    // 与前端展示一致：先按 order 排序再按索引定位
    bird.images.sort((a, b) => (a.order || 0) - (b.order || 0));
    
    const imageIndex = Number.parseInt(req.params.imageIndex, 10);
    if (!Number.isInteger(imageIndex) || imageIndex < 0 || imageIndex >= bird.images.length) {
      devLog('无效的图片索引:', imageIndex, '图片总数:', bird.images.length);
      return sendBirdClientError(res, 400, '无效的图片索引', 'INVALID_IMAGE_INDEX');
    }
    
    const imageToDelete = bird.images[imageIndex];
    if (!req.user) {
      return sendBirdClientError(res, 401, '请先登录', 'UNAUTHORIZED');
    }
    
    // 移动图片文件到temp目录（而不是直接删除）
    const fs = require('fs');
    const path = require('path');
    
    try {
      // 创建temp目录结构：uploads/temp/YYYY-MM-DD/
      const today = todayLocalDateKey(); // 本地日历日
      const tempDir = path.join(getTempUploadsRoot(), today);
      
      // 确保temp目录存在
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      // 构建源文件路径和目标文件路径（仅允许 uploads/active 内文件）
      const resolvedSource = resolveActiveUploadUrl(imageToDelete.url);
      if (!resolvedSource) {
        devLog(`非法或越界图片路径，跳过文件移动: ${imageToDelete.url}`);
      } else {
        const sourcePath = resolvedSource.absPath;
        const fileName = resolvedSource.fileName;
        const targetPath = path.join(tempDir, fileName);

        if (fs.existsSync(sourcePath)) {
          fs.renameSync(sourcePath, targetPath);
          devLog(`图片文件已移动到temp目录: ${targetPath}`);
        } else {
          devLog(`源文件不存在，跳过文件移动: ${sourcePath}`);
        }
      }
    } catch (fileError) {
      devError('移动图片文件时出错:', fileError.message);
      // 即使文件移动失败，也继续删除数据库记录
    }
    
    // 从数据库中删除图片记录
    const deletedUrl = imageToDelete.url;
    bird.images.splice(imageIndex, 1);
    bird.images.forEach((img, i) => {
      img.order = i;
    });
    bird.markModified('images');
    await bird.save();

    // 若图片来自观鸟记录同步，同步从对应观鸟记录中移除该图片，避免观察记录里出现无法加载的图
    if (imageToDelete.source === 'observation_record' && deletedUrl) {
      try {
        const normalizeUrl = (u) => (u && String(u).replace(/^\/+/, '')) || '';
        const targetUrl = normalizeUrl(deletedUrl);
        const records = await Record.find({ 'birds.birdId': req.params.id });
        for (const record of records) {
          let modified = false;
          for (let i = 0; i < record.birds.length; i++) {
            if (record.birds[i].birdId.toString() !== req.params.id) continue;
            const before = (record.birds[i].images || []).length;
            record.birds[i].images = (record.birds[i].images || []).filter(
              (img) => normalizeUrl(img.url) !== targetUrl
            );
            if (record.birds[i].images.length !== before) modified = true;
          }
          if (modified) {
            await record.save();
            clearCache(`/api/records/${record._id}`);
          }
        }
        clearCache('/api/records\\?');
        clearCache(`/api/records/bird/${req.params.id}\\?`);
      } catch (syncErr) {
        devError('同步删除观鸟记录中的图片失败:', syncErr.message);
      }
    }
    
    devLog('图片删除成功');
    
    // 清除相关缓存
    clearCache(`/api/birds/${req.params.id}`);
    clearCache('/api/birds\\?');
    
    res.status(200).json({
      success: true,
      data: bird,
      message: '图片删除成功'
    });
  } catch (error) {
    devError('删除图片错误:', error);
    return sendControllerError(res, error, {
      defaultMessage: '删除图片失败',
      defaultCode: 'BIRD_OPERATION_FAILED',
    });
  }
};

// @desc    更新鸟类观察记录
// @route   PUT /api/birds/:id/sightings/:sightingIndex
// @access  Private
const updateBirdSighting = async (req, res) => {
  try {
    const bird = await Bird.findById(req.params.id);
    
    if (!bird) {
      return sendBirdClientError(res, 404, '未找到该鸟类记录', 'BIRD_NOT_FOUND');
    }
    
    const sightingIndex = Number.parseInt(req.params.sightingIndex, 10);
    if (
      !Number.isInteger(sightingIndex) ||
      sightingIndex < 0 ||
      sightingIndex >= bird.sightings.length
    ) {
      return sendBirdClientError(res, 400, '无效的观察记录索引', 'INVALID_SIGHTING_INDEX');
    }

    const targetSighting = bird.sightings[sightingIndex];
    const userId = req.user.id;
    const isAdmin = req.user.role === 'admin';

    // 仅管理员或观察记录创建者可更新
    if (!isAdmin) {
      if (!targetSighting.observer || targetSighting.observer.toString() !== userId) {
        return sendBirdClientError(res, 403, '您没有权限更新此观察记录', 'SIGHTING_UPDATE_FORBIDDEN');
      }
    }

    const nextCoordinates = req.body.location?.coordinates || targetSighting.location.coordinates;
    const nextLocationName = req.body.location?.name || targetSighting.location.name;
    
    // 更新观察记录
    bird.sightings[sightingIndex] = {
      ...targetSighting,
      location: {
        type: 'Point',
        coordinates: nextCoordinates,
        name: nextLocationName
      },
      date: req.body.date ? new Date(req.body.date) : targetSighting.date,
      notes: req.body.notes || targetSighting.notes,
    };
    
    await bird.save();

    clearLeaderboardCache();
    
    res.status(200).json({
      success: true,
      data: bird,
      message: '观察记录更新成功'
    });
  } catch (error) {
    return sendControllerError(res, error, {
      defaultMessage: '更新观察记录失败',
      defaultCode: 'BIRD_OPERATION_FAILED',
    });
  }
};

// @desc    删除鸟类观察记录
// @route   DELETE /api/birds/:id/sightings/:sightingIndex
// @access  Private
const deleteBirdSighting = async (req, res) => {
  try {
    devLog('删除观察记录请求:', {
      birdId: req.params.id,
      sightingIndex: req.params.sightingIndex,
      userId: req.user ? req.user.id : '未认证'
    });

    const bird = await Bird.findById(req.params.id);
    
    if (!bird) {
      devLog('鸟类记录不存在:', req.params.id);
      return sendBirdClientError(res, 404, '未找到该鸟类记录', 'BIRD_NOT_FOUND');
    }
    
    const sightingIndex = Number.parseInt(req.params.sightingIndex, 10);
    if (
      !Number.isInteger(sightingIndex) ||
      sightingIndex < 0 ||
      sightingIndex >= bird.sightings.length
    ) {
      devLog('无效的观察记录索引:', sightingIndex, '记录总数:', bird.sightings.length);
      return sendBirdClientError(res, 400, '无效的观察记录索引', 'INVALID_SIGHTING_INDEX');
    }
    
    // 检查用户权限 - 只有观察记录的创建者或管理员可以删除
    const sightingToDelete = bird.sightings[sightingIndex];
    const userId = req.user.id;
    const isAdmin = req.user.role === 'admin';
    
    devLog('观察记录信息:', {
      observer: sightingToDelete.observer,
      userId: userId,
      observerString: sightingToDelete.observer ? sightingToDelete.observer.toString() : 'null'
    });
    
    if (
      !isAdmin &&
      (!sightingToDelete.observer || sightingToDelete.observer.toString() !== userId)
    ) {
      devLog('权限检查失败: 用户无权删除此观察记录');
      return sendBirdClientError(res, 403, '您没有权限删除此观察记录', 'SIGHTING_DELETE_FORBIDDEN');
    }
    
    // 删除观察记录
    bird.sightings.splice(sightingIndex, 1);
    await bird.save();

    clearLeaderboardCache();
    
    devLog('观察记录删除成功');
    res.status(200).json({
      success: true,
      data: bird,
      message: '观察记录删除成功'
    });
  } catch (error) {
    devError('删除观察记录错误:', error);
    return sendControllerError(res, error, {
      defaultMessage: '删除观察记录失败',
      defaultCode: 'BIRD_OPERATION_FAILED',
    });
  }
};

// @desc    申请添加新鸟类
// @route   POST /api/birds/request-new
// @access  Private
const requestNewBird = async (req, res) => {
  try {
    const {
      name,
      scientificName,
      description,
      habitat,
      distribution,
      category,
      conservationStatus,
      chinaProtectionLevel,
    } = req.body;

    const trimmedName = String(name || '').trim();
    if (!trimmedName) {
      return sendBirdClientError(res, 400, '鸟类名称不能为空', 'MISSING_BIRD_NAME');
    }

    const existingBird = await Bird.findOne({ name: trimmedName });
    if (existingBird) {
      return sendBirdClientError(res, 400, '该鸟类已存在于数据库中', 'BIRD_ALREADY_EXISTS');
    }

    const sci = String(scientificName || '').trim() || 'Pending sp.';
    let newBird;
    try {
      newBird = await Bird.create({
        name: trimmedName,
        scientificName: sci,
        description: String(description || '').trim() || '用户申请添加的新鸟类，资料待补全。',
        habitat: String(habitat || '').trim() || '待补充',
        distribution: String(distribution || '').trim() || '待补充',
        category: String(category || '').trim() || '未分类',
        conservationStatus: String(conservationStatus || '').trim() || '未评估',
        chinaProtectionLevel: chinaProtectionLevel || '未列入',
        iucnProtectionLevel: '未评估(NE)',
        createdBy: req.user._id,
        requestedBy: req.user._id,
        requestStatus: 'pending',
        isTemporary: true,
        images: [],
        sightings: [],
      });
    } catch (createError) {
      if (createError?.code === 11000) {
        return sendBirdClientError(res, 400, '该鸟类已存在于数据库中', 'BIRD_ALREADY_EXISTS');
      }
      throw createError;
    }

    await User.findByIdAndUpdate(req.user._id, { $push: { contributions: newBird._id } });
    clearCache('/api/birds\\?');
    clearLeaderboardCache();

    res.status(201).json({
      success: true,
      message: '新鸟类申请已提交，可先用于记录；资料待管理员补全',
      data: {
        birdId: newBird._id,
        name: newBird.name,
        status: 'pending',
        bird: newBird,
      },
    });
  } catch (error) {
    devError('申请新鸟类失败:', error);
    return sendControllerError(res, error, {
      defaultMessage: '服务器错误',
      defaultCode: 'BIRD_OPERATION_FAILED',
    });
  }
};


// @desc    添加鸟类鸣叫录音
// @route   POST /api/birds/:id/calls
// @access  Private
const addBirdCall = async (req, res) => {
  try {
    const bird = await Bird.findById(req.params.id);
    if (!bird) {
      return sendBirdClientError(res, 404, '未找到该鸟类记录', 'BIRD_NOT_FOUND');
    }

    if (!Array.isArray(bird.calls)) {
      bird.calls = [];
    }

    const callData = {
      url: '',
      caption: req.body.caption || '',
      location: req.body.location || '',
      date: req.body.date ? new Date(req.body.date) : new Date(),
      recorder: req.user._id,
      order: bird.calls.length,
      tags: parseFormTags(req.body.tags, normalizeBirdCallTags),
      mimeType: '',
      durationSec:
        req.body.durationSec != null && String(req.body.durationSec).trim() !== ''
          ? Number(req.body.durationSec)
          : undefined,
    };

    if (req.file) {
      if (!AUDIO_MIME_TO_EXT[req.file.mimetype]) {
        return sendBirdClientError(
          res,
          400,
          '不支持的文件类型，请上传 MP3、M4A、WAV 或 OGG 格式的音频',
          'UNSUPPORTED_AUDIO_FORMAT'
        );
      }

      const maxSize = 20 * 1024 * 1024;
      if (req.file.size > maxSize) {
        return sendBirdClientError(res, 400, '文件大小不能超过 20MB', 'FILE_TOO_LARGE');
      }

      const fileName = buildSafeAudioFileName(req.file.mimetype);
      if (!fileName) {
        return sendBirdClientError(res, 400, '不支持的文件类型', 'UNSUPPORTED_AUDIO_FORMAT');
      }

      const fs = require('fs');
      const path = require('path');
      const uploadDir = getActiveUploadsRoot();
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      const fullPath = path.join(uploadDir, fileName);
      if (!isPathInside(uploadDir, fullPath)) {
        return sendBirdClientError(res, 400, '非法文件路径', 'INVALID_AUDIO_PATH');
      }
      fs.writeFileSync(fullPath, req.file.buffer);

      callData.url = `/uploads/active/${fileName}`;
      callData.mimeType = req.file.mimetype;
    } else if (req.body.url) {
      const resolved = resolveActiveUploadUrl(req.body.url);
      if (!resolved) {
        return sendBirdClientError(res, 400, '音频URL必须来自受控上传目录', 'INVALID_AUDIO_URL');
      }
      callData.url = resolved.url;
      callData.mimeType = req.body.mimeType || '';
    } else {
      return sendBirdClientError(res, 400, '请提供音频文件或URL', 'MISSING_AUDIO_INPUT');
    }

    bird.calls.push(callData);
    bird.markModified('calls');
    await bird.save();

    clearCache(`/api/birds/${req.params.id}`);
    clearCache('/api/birds\\?');

    res.status(201).json({
      success: true,
      data: bird,
      message: '鸣叫添加成功',
    });
  } catch (error) {
    return sendControllerError(res, error, {
      defaultMessage: '添加鸣叫失败',
      defaultCode: 'BIRD_CALL_ADD_FAILED',
    });
  }
};

// @desc    更新鸟类鸣叫信息
// @route   PUT /api/birds/:id/calls/:callIndex
// @access  Private
const updateBirdCall = async (req, res) => {
  try {
    const bird = await Bird.findById(req.params.id);
    if (!bird) {
      return sendBirdClientError(res, 404, '未找到该鸟类记录', 'BIRD_NOT_FOUND');
    }

    if (!Array.isArray(bird.calls)) {
      bird.calls = [];
    }
    bird.calls.sort((a, b) => (a.order || 0) - (b.order || 0));

    const callIndex = Number.parseInt(req.params.callIndex, 10);
    if (!Number.isInteger(callIndex) || callIndex < 0 || callIndex >= bird.calls.length) {
      return sendBirdClientError(res, 400, '无效的鸣叫索引', 'INVALID_CALL_INDEX');
    }

    if (!req.user) {
      return sendBirdClientError(res, 401, '请先登录', 'UNAUTHORIZED');
    }

    const targetCall = bird.calls[callIndex];
    let nextUrl = targetCall.url;
    if (req.user.role === 'admin' && req.body.url) {
      const resolved = resolveActiveUploadUrl(req.body.url);
      if (!resolved) {
        return sendBirdClientError(res, 400, '音频URL必须来自受控上传目录', 'INVALID_AUDIO_URL');
      }
      nextUrl = resolved.url;
    }

    bird.calls[callIndex] = {
      ...(targetCall.toObject?.() || targetCall),
      caption: req.body.caption !== undefined ? req.body.caption : targetCall.caption,
      location: req.body.location !== undefined ? req.body.location : targetCall.location,
      date: req.body.date ? new Date(req.body.date) : targetCall.date,
      url: nextUrl,
      tags:
        req.body.tags !== undefined
          ? normalizeBirdCallTags(req.body.tags)
          : Array.isArray(targetCall.tags)
            ? targetCall.tags
            : [],
      durationSec:
        req.body.durationSec !== undefined
          ? Number(req.body.durationSec) || undefined
          : targetCall.durationSec,
    };
    bird.markModified('calls');
    await bird.save();

    clearCache(`/api/birds/${req.params.id}`);
    clearCache('/api/birds\\?');

    res.status(200).json({
      success: true,
      data: bird,
      message: '鸣叫更新成功',
    });
  } catch (error) {
    return sendControllerError(res, error, {
      defaultMessage: '更新鸣叫失败',
      defaultCode: 'BIRD_CALL_UPDATE_FAILED',
    });
  }
};

// @desc    删除鸟类鸣叫
// @route   DELETE /api/birds/:id/calls/:callIndex
// @access  Private
const deleteBirdCall = async (req, res) => {
  try {
    const bird = await Bird.findById(req.params.id);
    if (!bird) {
      return sendBirdClientError(res, 404, '未找到该鸟类记录', 'BIRD_NOT_FOUND');
    }

    if (!Array.isArray(bird.calls)) {
      bird.calls = [];
    }
    bird.calls.sort((a, b) => (a.order || 0) - (b.order || 0));

    const callIndex = Number.parseInt(req.params.callIndex, 10);
    if (!Number.isInteger(callIndex) || callIndex < 0 || callIndex >= bird.calls.length) {
      return sendBirdClientError(res, 400, '无效的鸣叫索引', 'INVALID_CALL_INDEX');
    }

    if (!req.user) {
      return sendBirdClientError(res, 401, '请先登录', 'UNAUTHORIZED');
    }

    const callToDelete = bird.calls[callIndex];
    const fs = require('fs');
    const path = require('path');

    try {
      const today = todayLocalDateKey();
      const tempDir = path.join(getTempUploadsRoot(), today);
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const resolvedSource = resolveActiveUploadUrl(callToDelete.url);
      if (resolvedSource) {
        const sourcePath = resolvedSource.absPath;
        const targetPath = path.join(tempDir, resolvedSource.fileName);
        if (fs.existsSync(sourcePath)) {
          fs.renameSync(sourcePath, targetPath);
        }
      }
    } catch (fileError) {
      devError('移动鸣叫文件时出错:', fileError.message);
    }

    bird.calls.splice(callIndex, 1);
    bird.calls.forEach((item, i) => {
      item.order = i;
    });
    bird.markModified('calls');
    await bird.save();

    clearCache(`/api/birds/${req.params.id}`);
    clearCache('/api/birds\\?');

    res.status(200).json({
      success: true,
      data: bird,
      message: '鸣叫删除成功',
    });
  } catch (error) {
    return sendControllerError(res, error, {
      defaultMessage: '删除鸣叫失败',
      defaultCode: 'BIRD_CALL_DELETE_FAILED',
    });
  }
};

module.exports = {
  getBirds,
  getBirdFilterOptions,
  getBirdById,
  createBird,
  updateBird,
  deleteBird,
  addBirdSighting,
  addBirdImage,
  setMainBirdImage,
  updateBirdImage,
  deleteBirdImage,
  addBirdCall,
  updateBirdCall,
  deleteBirdCall,
  updateBirdSighting,
  deleteBirdSighting,
  checkDuplicate,
  requestNewBird
};