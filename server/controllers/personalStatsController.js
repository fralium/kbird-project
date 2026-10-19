const Record = require('../models/recordModel');
const Bird = require('../models/birdModel');
const PersonalChecklist = require('../models/personalChecklistModel');
const Location = require('../models/locationModel');
const { sendControllerError } = require('../middleware/controllerError');
const { devError } = require('../utils/devLogger');
const { localYearRange, localMonthRange } = require('../utils/dateCoords');

const getRecordDate = (record) => {
  if (!record?.date) return null;
  const d = new Date(record.date);
  return Number.isNaN(d.getTime()) ? null : d;
};

const getBirdIdString = (birdId) => {
  if (!birdId) return null;
  if (birdId._id) return birdId._id.toString();
  if (typeof birdId === 'string') return birdId;
  if (typeof birdId.toString === 'function') return birdId.toString();
  return null;
};

/** 从鸟种文档解析目/科（优先 order/family，回退 category「目 > 科」） */
const resolveOrderFamily = (birdDoc) => {
  if (!birdDoc) return { order: '未分类', family: '未分类' };
  const parts = String(birdDoc.category || '')
    .split(/\s*>\s*/)
    .map((part) => part.trim())
    .filter(Boolean);
  const order = String(birdDoc.order || parts[0] || '未分类').trim() || '未分类';
  const family = String(birdDoc.family || parts[1] || '未分类').trim() || '未分类';
  return { order, family };
};

// @desc    获取个人统计数据
// @route   GET /api/personal/stats
// @access  Private
const getPersonalStats = async (req, res) => {
  try {
    const userId = req.user.id;
    const { year, month } = req.query;
    
    // 获取用户的所有已发布记录（排除草稿）
    const recordQuery = {
      observer: userId,
      status: { $ne: 'draft' },
    };
    
    if (year) {
      const { startDate, endDate } = localYearRange(year);
      recordQuery.date = { $gte: startDate, $lte: endDate };
    }
    
    if (month) {
      const [yearStr, monthStr] = month.split('-');
      const { startDate, endDate } = localMonthRange(yearStr, monthStr);
      recordQuery.date = { $gte: startDate, $lte: endDate };
    }
    
    const records = await Record.find(recordQuery)
      .select('date location.name birds.birdId birds.count')
      .populate('birds.birdId', 'name scientificName category order family')
      .sort({ date: -1 })
      .limit(5000)
      .lean();
    
    // 基础统计
    const totalRecords = records.length;
    const uniqueSpecies = new Set();
    const activeDays = new Set();
    const activeMonths = new Set();
    const totalBirds = records.reduce((sum, record) => {
      if (record?.date) {
        activeDays.add(localDateKey(record.date));
        const d = new Date(record.date);
        activeMonths.add(`${d.getFullYear()}-${pad2(d.getMonth() + 1)}`);
      }
      record.birds.forEach(bird => {
        const birdIdStr = getBirdIdString(bird?.birdId);
        if (!birdIdStr) return;
        uniqueSpecies.add(birdIdStr);
        sum += bird.count || 1;
      });
      return sum;
    }, 0);
    
    // 按月份统计观察趋势
    const monthlyTrend = {};
    records.forEach(record => {
      const date = new Date(record.date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!monthlyTrend[monthKey]) {
        monthlyTrend[monthKey] = {
          records: 0,
          species: new Set(),
          birds: 0,
        };
      }
      monthlyTrend[monthKey].records += 1;
      record.birds.forEach(bird => {
        const birdIdStr = getBirdIdString(bird?.birdId);
        if (!birdIdStr) return;
        monthlyTrend[monthKey].species.add(birdIdStr);
        monthlyTrend[monthKey].birds += bird.count || 1;
      });
    });
    
    // 转换为数组格式
    const monthlyTrendArray = Object.entries(monthlyTrend)
      .map(([month, data]) => ({
        month,
        records: data.records,
        species: data.species.size,
        birds: data.birds,
      }))
      .sort((a, b) => a.month.localeCompare(b.month));
    
    // 按年份统计
    const yearlyTrend = {};
    records.forEach(record => {
      const year = new Date(record.date).getFullYear();
      if (!yearlyTrend[year]) {
        yearlyTrend[year] = {
          records: 0,
          species: new Set(),
          birds: 0,
        };
      }
      yearlyTrend[year].records += 1;
      record.birds.forEach(bird => {
        const birdIdStr = getBirdIdString(bird?.birdId);
        if (!birdIdStr) return;
        yearlyTrend[year].species.add(birdIdStr);
        yearlyTrend[year].birds += bird.count || 1;
      });
    });
    
    const yearlyTrendArray = Object.entries(yearlyTrend)
      .map(([year, data]) => ({
        year: parseInt(year),
        records: data.records,
        species: data.species.size,
        birds: data.birds,
      }))
      .sort((a, b) => a.year - b.year);
    
    // 按地点统计（含该地点观察到的鸟种名称列表，供前端点击展开）
    const locationStats = {};
    records.forEach(record => {
      const locationName = record.location?.name || '未知地点';
      if (!locationStats[locationName]) {
        locationStats[locationName] = {
          records: 0,
          species: new Set(),
          speciesNames: new Set(),
          birds: 0,
          coordinates: record.location?.coordinates?.coordinates || null,
          lastVisit: null,
          months: new Set(),
        };
      }
      locationStats[locationName].records += 1;
      const recordDate = new Date(record.date);
      if (!Number.isNaN(recordDate.getTime())) {
        locationStats[locationName].months.add(recordDate.getMonth() + 1);
        if (
          !locationStats[locationName].lastVisit ||
          recordDate > locationStats[locationName].lastVisit
        ) {
          locationStats[locationName].lastVisit = recordDate;
        }
      }
      record.birds.forEach(bird => {
        const birdIdStr = getBirdIdString(bird?.birdId);
        if (!birdIdStr) return;
        locationStats[locationName].species.add(birdIdStr);
        if (bird.birdId?.name) locationStats[locationName].speciesNames.add(bird.birdId.name);
        locationStats[locationName].birds += bird.count || 1;
      });
    });
    
    let locationStatsArray = Object.entries(locationStats)
      .map(([name, data]) => ({
        name,
        records: data.records,
        species: data.species.size,
        birds: data.birds,
        coordinates: data.coordinates,
        speciesList: Array.from(data.speciesNames).sort(),
        lastVisit: data.lastVisit,
        months: Array.from(data.months).sort((a, b) => a - b),
      }))
      .sort((a, b) => b.records - a.records);

    // 补地点词典封面/类型，供「观察地点明细」生境封面优先用实拍
    try {
      const locationNames = locationStatsArray.map((item) => item.name).filter(Boolean);
      if (locationNames.length > 0) {
        const locationDocs = await Location.find({
          name: { $in: locationNames },
          status: { $ne: 'archived' },
        })
          .select('name type images environment')
          .lean();
        const byName = new Map(
          locationDocs.map((doc) => [String(doc.name || '').trim(), doc])
        );
        locationStatsArray = locationStatsArray.map((item) => {
          const doc = byName.get(String(item.name || '').trim());
          if (!doc) return item;
          return {
            ...item,
            locationId: doc._id ? String(doc._id) : null,
            type: doc.type || '',
            images: Array.isArray(doc.images) ? doc.images : [],
            environment: doc.environment || null,
          };
        });
      }
    } catch (enrichError) {
      devError('个人统计地点封面 enrichment 失败:', enrichError);
    }
    
    // 按目/科统计（展开目后按科分组鸟种）
    const categoryStats = {};
    records.forEach((record) => {
      record.birds.forEach((bird) => {
        if (!bird.birdId) return;
        const birdIdStr = getBirdIdString(bird.birdId);
        if (!birdIdStr) return;
        if (!bird.birdId.category && !bird.birdId.order && !bird.birdId.family) return;

        const { order: category, family } = resolveOrderFamily(bird.birdId);
        if (!categoryStats[category]) {
          categoryStats[category] = {
            species: new Set(),
            speciesNames: new Set(),
            records: 0,
            families: {},
          };
        }
        const orderNode = categoryStats[category];
        orderNode.species.add(birdIdStr);
        if (bird.birdId.name) orderNode.speciesNames.add(bird.birdId.name);
        orderNode.records += 1;

        if (!orderNode.families[family]) {
          orderNode.families[family] = {
            species: new Set(),
            speciesNames: new Set(),
            records: 0,
          };
        }
        const familyNode = orderNode.families[family];
        familyNode.species.add(birdIdStr);
        if (bird.birdId.name) familyNode.speciesNames.add(bird.birdId.name);
        familyNode.records += 1;
      });
    });

    const categoryStatsArray = Object.entries(categoryStats)
      .map(([category, data]) => ({
        category,
        species: data.species.size,
        records: data.records,
        familyCount: Object.keys(data.families).length,
        speciesList: Array.from(data.speciesNames).sort(),
        families: Object.entries(data.families)
          .map(([family, fdata]) => ({
            family,
            species: fdata.species.size,
            records: fdata.records,
            speciesList: Array.from(fdata.speciesNames).sort(),
          }))
          .sort((a, b) => b.species - a.species || a.family.localeCompare(b.family, 'zh-CN')),
      }))
      .sort((a, b) => b.species - a.species);
    
    // 按季节统计
    const seasonStats = {
      spring: { records: 0, species: new Set(), birds: 0 }, // 3-5月
      summer: { records: 0, species: new Set(), birds: 0 }, // 6-8月
      autumn: { records: 0, species: new Set(), birds: 0 }, // 9-11月
      winter: { records: 0, species: new Set(), birds: 0 }, // 12-2月
    };
    
    records.forEach(record => {
      const month = new Date(record.date).getMonth() + 1;
      let season;
      if (month >= 3 && month <= 5) season = 'spring';
      else if (month >= 6 && month <= 8) season = 'summer';
      else if (month >= 9 && month <= 11) season = 'autumn';
      else season = 'winter';
      
      seasonStats[season].records += 1;
      record.birds.forEach(bird => {
        const birdIdStr = getBirdIdString(bird?.birdId);
        if (!birdIdStr) return;
        seasonStats[season].species.add(birdIdStr);
        seasonStats[season].birds += bird.count || 1;
      });
    });
    
    const seasonStatsArray = Object.entries(seasonStats).map(([season, data]) => ({
      season,
      records: data.records,
      species: data.species.size,
      birds: data.birds,
    }));
    
    // 照片统计
    const totalPhotos = records.reduce((sum, record) => {
      let photoCount = record.images ? record.images.length : 0;
      record.birds.forEach(bird => {
        photoCount += bird.images ? bird.images.length : 0;
      });
      return sum + photoCount;
    }, 0);
    
    // 最常观察的鸟类
    const birdFrequency = {};
    records.forEach(record => {
      record.birds.forEach(bird => {
        const birdId = getBirdIdString(bird?.birdId);
        if (!birdId) return;
        if (!birdFrequency[birdId]) {
          birdFrequency[birdId] = {
            birdId,
            name: bird.birdId?.name || '未知',
            scientificName: bird.birdId?.scientificName || '',
            count: 0,
          };
        }
        birdFrequency[birdId].count += bird.count || 1;
      });
    });
    
    const topBirds = Object.values(birdFrequency)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
    
    // 每年按地点的鸟种明细（点击年份时展示「地点：鸟种」）
    const yearlyDetail = {};
    records.forEach(record => {
      const y = new Date(record.date).getFullYear();
      if (!yearlyDetail[y]) yearlyDetail[y] = {};
      const locName = record.location?.name || '未知地点';
      if (!yearlyDetail[y][locName]) yearlyDetail[y][locName] = new Set();
      record.birds.forEach(bird => {
        if (bird.birdId?.name) yearlyDetail[y][locName].add(bird.birdId.name);
      });
    });
    const yearlyDetailForResponse = {};
    Object.keys(yearlyDetail).forEach(y => {
      yearlyDetailForResponse[y] = Object.entries(yearlyDetail[y])
        .map(([location, set]) => ({
          location,
          species: Array.from(set).sort(),
        }))
        .sort((a, b) => b.species.length - a.species.length);
    });
    
    res.json({
      success: true,
      data: {
        summary: {
          totalRecords,
          totalSpecies: uniqueSpecies.size,
          totalBirds,
          totalPhotos,
          activeDays: activeDays.size,
          activeMonths: activeMonths.size,
        },
        summaryScope: {
          filterYear: year && String(year).trim() !== '' ? String(year).trim() : null,
          filterMonth: month && String(month).trim() !== '' ? String(month).trim() : null,
        },
        trends: {
          monthly: monthlyTrendArray,
          yearly: yearlyTrendArray,
          seasonal: seasonStatsArray,
        },
        locations: locationStatsArray,
        categories: categoryStatsArray,
        topBirds,
        yearlyDetail: yearlyDetailForResponse,
      },
    });
  } catch (error) {
    devError('获取统计数据失败:', error);
    return sendControllerError(res, error, {
      defaultMessage: '获取统计数据失败',
      defaultCode: 'PERSONAL_STATS_OPERATION_FAILED',
    });
  }
};

// @desc    个人统计仪表盘（图表用聚合，可选按年筛选）
// @route   GET /api/personal/stats/dashboard
// @access  Private
const getPersonalStatsDashboard = async (req, res) => {
  try {
    const userId = req.user.id;
    const { year } = req.query;
    const recordQuery = {
      observer: userId,
      status: { $ne: 'draft' },
    };

    if (year) {
      const y = parseInt(year, 10);
      if (!Number.isNaN(y)) {
        const { startDate, endDate } = localYearRange(y);
        recordQuery.date = { $gte: startDate, $lte: endDate };
      }
    }

    const records = await Record.find(recordQuery)
      .populate(
        'birds.birdId',
        'name scientificName chinaProtectionLevel iucnProtectionLevel category'
      )
      .sort({ date: -1 })
      .limit(5000)
      .lean();

    const allPublishedRecords = await Record.find({
      observer: userId,
      status: { $ne: 'draft' },
    })
      .select('date birds.birdId')
      .limit(5000)
      .lean();

    const totalRecords = records.length;
    let totalBirds = 0;
    const allSpecies = new Set();
    const activeDays = new Set();
    const activeMonths = new Set();
    let totalPhotos = 0;

    records.forEach((r) => {
      if (r.date) {
        activeDays.add(localDateKey(r.date));
        const d = new Date(r.date);
        activeMonths.add(
          `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`
        );
      }
      totalPhotos += (r.images && r.images.length) || 0;
      r.birds.forEach((b) => {
        totalPhotos += (b.images && b.images.length) || 0;
        const birdIdStr = getBirdIdString(b?.birdId);
        if (birdIdStr) {
          allSpecies.add(birdIdStr);
          totalBirds += b.count || 1;
        }
      });
    });

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const currentMonthStart = new Date(currentYear, currentMonth, 1);
    const currentYearStart = new Date(currentYear, 0, 1);

    const lifeSpecies = new Set();
    const yearSpecies = new Set();
    const monthSpecies = new Set();
    const speciesBeforeYear = new Set();
    const speciesBeforeMonth = new Set();

    allPublishedRecords.forEach((record) => {
      const observedAt = getRecordDate(record);
      (record.birds || []).forEach((item) => {
        const birdIdStr = item?.birdId?.toString?.();
        if (!birdIdStr) return;

        lifeSpecies.add(birdIdStr);

        if (observedAt && observedAt.getFullYear() === currentYear) {
          yearSpecies.add(birdIdStr);
          if (observedAt.getMonth() === currentMonth) {
            monthSpecies.add(birdIdStr);
          }
        }

        if (observedAt && observedAt < currentYearStart) {
          speciesBeforeYear.add(birdIdStr);
        }
        if (observedAt && observedAt < currentMonthStart) {
          speciesBeforeMonth.add(birdIdStr);
        }
      });
    });

    const newSpeciesInYear = Array.from(yearSpecies).filter(
      (birdId) => !speciesBeforeYear.has(birdId)
    ).length;
    const newSpeciesInMonth = Array.from(monthSpecies).filter(
      (birdId) => !speciesBeforeMonth.has(birdId)
    ).length;

    const byYear = {};
    records.forEach((r) => {
      if (!r.date) return;
      const y = new Date(r.date).getFullYear();
      if (!byYear[y]) byYear[y] = { species: new Set(), records: 0 };
      byYear[y].records += 1;
      r.birds.forEach((b) => {
        const birdIdStr = getBirdIdString(b?.birdId);
        if (!birdIdStr) return;
        byYear[y].species.add(birdIdStr);
      });
    });
    const yearlySpecies = Object.entries(byYear)
      .map(([y, v]) => ({
        year: parseInt(y, 10),
        species: v.species.size,
        records: v.records,
      }))
      .sort((a, b) => a.year - b.year);

    const monthSpeciesSets = Array.from({ length: 12 }, () => new Set());
    const monthRecordCounts = Array(12).fill(0);
    records.forEach((r) => {
      if (!r.date) return;
      const m = new Date(r.date).getMonth();
      monthRecordCounts[m] += 1;
      r.birds.forEach((b) => {
        const birdIdStr = getBirdIdString(b?.birdId);
        if (!birdIdStr) return;
        monthSpeciesSets[m].add(birdIdStr);
      });
    });
    const monthlySpecies = monthSpeciesSets.map((s) => s.size);

    // 各月「新种」：生命清单首次记录落在该月（有年份筛选时仅计该年）
    const firstSeenAt = new Map();
    allPublishedRecords.forEach((record) => {
      const observedAt = getRecordDate(record);
      if (!observedAt || Number.isNaN(observedAt.getTime())) return;
      (record.birds || []).forEach((item) => {
        const birdIdStr = getBirdIdString(item?.birdId);
        if (!birdIdStr) return;
        const prev = firstSeenAt.get(birdIdStr);
        if (!prev || observedAt < prev) {
          firstSeenAt.set(birdIdStr, observedAt);
        }
      });
    });
    const filterYearNum = year ? Number.parseInt(String(year), 10) : NaN;
    const monthlyNewSpecies = Array(12).fill(0);
    const newSpeciesByYear = {};
    firstSeenAt.forEach((date) => {
      const seenYear = date.getFullYear();
      newSpeciesByYear[seenYear] = (newSpeciesByYear[seenYear] || 0) + 1;
      if (Number.isFinite(filterYearNum) && seenYear !== filterYearNum) return;
      monthlyNewSpecies[date.getMonth()] += 1;
    });
    yearlySpecies.forEach((row) => {
      row.newSpecies = newSpeciesByYear[row.year] || 0;
    });

    const provSpecies = {};
    records.forEach((r) => {
      const addr = r.location && r.location.address;
      const p = addr && (addr.province || addr.Province);
      const trimmed = p ? String(p).trim() : '';
      if (!trimmed) return;
      if (!provSpecies[trimmed]) provSpecies[trimmed] = new Set();
      r.birds.forEach((b) => {
        const birdIdStr = getBirdIdString(b?.birdId);
        if (!birdIdStr) return;
        provSpecies[trimmed].add(birdIdStr);
      });
    });
    const provinces = Object.entries(provSpecies)
      .map(([name, set]) => ({ name, species: set.size }))
      .sort((a, b) => b.species - a.species)
      .slice(0, 34);

    const speciesBirdMap = new Map();
    records.forEach((r) => {
      r.birds.forEach((b) => {
        const idStr = getBirdIdString(b?.birdId);
        if (!idStr) return;
        if (!speciesBirdMap.has(idStr)) {
          speciesBirdMap.set(idStr, b.birdId);
        }
      });
    });

    const prot = {};
    const iucn = {};
    speciesBirdMap.forEach((bird) => {
      const pl = bird.chinaProtectionLevel || '未列入';
      prot[pl] = (prot[pl] || 0) + 1;
      const il = bird.iucnProtectionLevel || '未评估(NE)';
      iucn[il] = (iucn[il] || 0) + 1;
    });

    const locMap = {};
    records.forEach((r) => {
      const name = r.location?.name || '未知地点';
      if (!locMap[name]) {
        locMap[name] = { species: new Set(), records: 0, lastVisit: null, months: new Set() };
      }
      locMap[name].records += 1;
      const recordDate = new Date(r.date);
      if (!Number.isNaN(recordDate.getTime())) {
        locMap[name].months.add(recordDate.getMonth() + 1);
        if (!locMap[name].lastVisit || recordDate > locMap[name].lastVisit) {
          locMap[name].lastVisit = recordDate;
        }
      }
      r.birds.forEach((b) => {
        const birdIdStr = getBirdIdString(b?.birdId);
        if (!birdIdStr) return;
        locMap[name].species.add(birdIdStr);
      });
    });
    const topLocations = Object.entries(locMap)
      .map(([name, v]) => ({
        name,
        species: v.species.size,
        records: v.records,
        lastVisit: v.lastVisit,
        months: Array.from(v.months).sort((a, b) => a - b),
      }))
      .sort((a, b) => b.species - a.species)
      .slice(0, 10);

    const birdFreq = {};
    records.forEach((r) => {
      const seenInRecord = new Set();
      (r.birds || []).forEach((b) => {
        const idStr = getBirdIdString(b?.birdId);
        if (!idStr || seenInRecord.has(idStr)) return;
        seenInRecord.add(idStr);
        if (!birdFreq[idStr]) {
          birdFreq[idStr] = {
            birdId: idStr,
            name: b.birdId?.name || '未知',
            count: 0,
          };
        }
        // 按出现次数（记录条数），不按只次数量
        birdFreq[idStr].count += 1;
      });
    });
    const topSpecies = Object.values(birdFreq)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
    // 词云：按出现次数（记录条数），最多 100 种
    const wordCloud = Object.values(birdFreq)
      .sort((a, b) => b.count - a.count)
      .slice(0, 100);

    const protectedClass1 = [];
    const protectedClass2 = [];
    speciesBirdMap.forEach((bird, idStr) => {
      const level = String(bird?.chinaProtectionLevel || '').trim();
      const row = {
        birdId: idStr,
        name: bird?.name || birdFreq[idStr]?.name || '未知',
        count: birdFreq[idStr]?.count || 0,
      };
      if (level === '国家一级') protectedClass1.push(row);
      else if (level === '国家二级') protectedClass2.push(row);
    });
    const sortProtected = (a, b) =>
      b.count - a.count || String(a.name).localeCompare(String(b.name), 'zh-CN');
    protectedClass1.sort(sortProtected);
    protectedClass2.sort(sortProtected);

    res.json({
      success: true,
      data: {
        filterYear: year && String(year).trim() !== '' ? String(year) : null,
        listStats: {
          lifeListCount: lifeSpecies.size,
          yearListCount: yearSpecies.size,
          monthListCount: monthSpecies.size,
          newSpeciesInYear,
          newSpeciesInMonth,
          currentYear,
          currentMonth: currentMonth + 1,
        },
        summary: {
          totalRecords,
          totalSpecies: allSpecies.size,
          totalBirds,
          totalPhotos,
          activeDays: activeDays.size,
          activeMonths: activeMonths.size,
        },
        yearlySpecies,
        monthlySpecies,
        monthlyNewSpecies,
        monthlyRecords: monthRecordCounts,
        provinces,
        protectionBreakdown: Object.entries(prot)
          .map(([level, count]) => ({ level, count }))
          .sort((a, b) => b.count - a.count),
        iucnBreakdown: Object.entries(iucn)
          .map(([level, count]) => ({ level, count }))
          .sort((a, b) => b.count - a.count),
        topLocations,
        topSpecies,
        protectedClass1,
        protectedClass2,
        wordCloud,
      },
    });
  } catch (error) {
    devError('获取仪表盘数据失败:', error);
    return sendControllerError(res, error, {
      defaultMessage: '获取仪表盘数据失败',
      defaultCode: 'PERSONAL_STATS_OPERATION_FAILED',
    });
  }
};

// @desc    获取个人分析报告
// @route   GET /api/personal/analytics
// @access  Private
const getPersonalAnalytics = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // 获取清单统计
    const checklist = await PersonalChecklist.findOne({ userId });
    
    // 获取所有已发布记录（排除草稿）
    const records = await Record.find({
      observer: userId,
      status: { $ne: 'draft' },
    })
      .populate('birds.birdId', 'name scientificName category')
      .sort({ date: -1 })
      .limit(5000)
      .lean();
    
    // 计算观察频率
    const observationFrequency = {};
    records.forEach(record => {
      const date = new Date(record.date);
      const weekKey = `${date.getFullYear()}-W${getWeekNumber(date)}`;
      if (!observationFrequency[weekKey]) {
        observationFrequency[weekKey] = 0;
      }
      observationFrequency[weekKey] += 1;
    });
    
    // 地点偏好分析
    const locationPreference = {};
    records.forEach(record => {
      const locationName = record.location?.name || '未知地点';
      if (!locationPreference[locationName]) {
        locationPreference[locationName] = {
          visits: 0,
          species: new Set(),
          lastVisit: null,
        };
      }
      locationPreference[locationName].visits += 1;
      record.birds.forEach(bird => {
        const birdIdStr = getBirdIdString(bird?.birdId);
        if (!birdIdStr) return;
        locationPreference[locationName].species.add(birdIdStr);
      });
      const recordDate = new Date(record.date);
      if (!locationPreference[locationName].lastVisit || 
          recordDate > locationPreference[locationName].lastVisit) {
        locationPreference[locationName].lastVisit = recordDate;
      }
    });
    
    const locationPreferenceArray = Object.entries(locationPreference)
      .map(([name, data]) => ({
        name,
        visits: data.visits,
        species: data.species.size,
        lastVisit: data.lastVisit,
      }))
      .sort((a, b) => b.visits - a.visits);
    
    // 鸟类发现时间线
    const discoveryTimeline = [];
    if (checklist && checklist.observedBirds) {
      checklist.observedBirds.forEach(bird => {
        discoveryTimeline.push({
          birdId: bird.birdId,
          name: bird.birdId?.name,
          scientificName: bird.birdId?.scientificName,
          firstSeenDate: bird.firstSeenDate,
          firstSeenLocation: bird.firstSeenLocation?.name,
          totalObservations: bird.totalObservations,
        });
      });
    }
    
    discoveryTimeline.sort((a, b) => 
      new Date(a.firstSeenDate) - new Date(b.firstSeenDate)
    );
    
    // 计算观鸟里程（基于地点坐标）
    let totalDistance = 0;
    const locations = [...new Set(records.map(r => r.location?.name || '未知地点'))];
    const locationCoords = {};
    records.forEach(record => {
      if (record.location?.coordinates?.coordinates) {
        locationCoords[record.location?.name || '未知地点'] = record.location.coordinates.coordinates;
      }
    });
    
    // 简化计算：计算所有地点之间的平均距离
    // 实际应用中可以使用更复杂的算法
    
    res.json({
      success: true,
      data: {
        observationFrequency: Object.entries(observationFrequency)
          .map(([week, count]) => ({ week, count }))
          .sort((a, b) => a.week.localeCompare(b.week)),
        locationPreference: locationPreferenceArray,
        discoveryTimeline: discoveryTimeline.slice(0, 50), // 最近50个发现
        totalDistance: totalDistance, // 简化计算
      },
    });
  } catch (error) {
    devError('获取分析数据失败:', error);
    return sendControllerError(res, error, {
      defaultMessage: '获取分析数据失败',
      defaultCode: 'PERSONAL_STATS_OPERATION_FAILED',
    });
  }
};

// 辅助函数：获取周数
function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

function localDateKey(d) {
  const x = new Date(d);
  return `${x.getFullYear()}-${pad2(x.getMonth() + 1)}-${pad2(x.getDate())}`;
}

function parseCoordPair(raw) {
  if (!Array.isArray(raw) || raw.length < 2) return null;
  const lng = Number(raw[0]);
  const lat = Number(raw[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat === 0 && lng === 0) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

// @desc    个人足迹点（记录坐标 + 我创建的地点）
// @route   GET /api/personal/stats/footprint
// @access  Private
const getPersonalFootprint = async (req, res) => {
  try {
    const userId = req.user.id;
    const year = String(req.query.year || '').trim();

    const recordQuery = {
      observer: userId,
      status: { $ne: 'draft' },
    };
    if (year && /^\d{4}$/.test(year)) {
      const y = Number(year);
      // 与个人统计其它接口一致：按本地自然年边界
      recordQuery.date = {
        $gte: new Date(y, 0, 1, 0, 0, 0, 0),
        $lte: new Date(y, 11, 31, 23, 59, 59, 999),
      };
    }

    const [records, createdLocations] = await Promise.all([
      Record.find(recordQuery)
        .select('date location.name location.coordinates location.address birds.birdId')
        .populate('birds.birdId', 'name')
        .sort({ date: 1 })
        .limit(5000)
        .lean(),
      Location.find({ createdBy: userId, status: { $ne: 'archived' } })
        .select('name coordinates address type createdAt')
        .limit(2000)
        .lean(),
    ]);

    const pointsMap = new Map();
    const visits = [];
    const tripMap = new Map();
    const provinceAgg = new Map();

    const toMonthKey = (dateValue) => {
      const d = new Date(dateValue);
      if (Number.isNaN(d.getTime())) return null;
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      return `${y}-${m}`;
    };

    const toDayKey = (dateValue) => {
      const d = new Date(dateValue);
      if (Number.isNaN(d.getTime())) return null;
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };

    const pickProvince = (address) => {
      const raw = address?.province || address?.Province || '';
      return String(raw || '').trim();
    };

    const upsertPoint = (key, patch) => {
      const prev = pointsMap.get(key) || {
        key,
        name: patch.name || '未命名地点',
        lat: patch.lat,
        lng: patch.lng,
        visitCount: 0,
        species: new Set(),
        speciesNames: new Set(),
        firstDate: null,
        lastDate: null,
        months: new Set(),
        sources: new Set(),
        locationId: null,
        province: '',
      };
      if (patch.name) prev.name = patch.name;
      if (patch.lat != null) prev.lat = patch.lat;
      if (patch.lng != null) prev.lng = patch.lng;
      if (patch.locationId) prev.locationId = patch.locationId;
      if (patch.source) prev.sources.add(patch.source);
      if (patch.visitInc) prev.visitCount += patch.visitInc;
      if (patch.province && !prev.province) prev.province = patch.province;
      (patch.speciesIds || []).forEach((id) => prev.species.add(id));
      (patch.speciesNames || []).forEach((n) => {
        if (n) prev.speciesNames.add(n);
      });
      if (patch.date) {
        const t = new Date(patch.date).getTime();
        if (!Number.isNaN(t)) {
          if (!prev.firstDate || t < new Date(prev.firstDate).getTime()) {
            prev.firstDate = patch.date;
          }
          if (!prev.lastDate || t > new Date(prev.lastDate).getTime()) {
            prev.lastDate = patch.date;
          }
          const monthKey = toMonthKey(patch.date);
          if (monthKey) prev.months.add(monthKey);
        }
      }
      pointsMap.set(key, prev);
    };

    const bumpProvince = (province, pointKey, speciesIds) => {
      if (!province) return;
      const prev = provinceAgg.get(province) || {
        name: province,
        pointKeys: new Set(),
        species: new Set(),
      };
      if (pointKey) prev.pointKeys.add(pointKey);
      (speciesIds || []).forEach((id) => prev.species.add(id));
      provinceAgg.set(province, prev);
    };

    records.forEach((record) => {
      const coords = parseCoordPair(record.location?.coordinates?.coordinates);
      if (!coords) return;
      const name = String(record.location?.name || '').trim() || '未命名地点';
      const key = `${coords.lat.toFixed(5)},${coords.lng.toFixed(5)}|${name.toLowerCase()}`;
      const province = pickProvince(record.location?.address);
      const speciesIds = [];
      const speciesNames = [];
      (record.birds || []).forEach((b) => {
        const id = getBirdIdString(b?.birdId);
        if (id) speciesIds.push(id);
        const birdName = typeof b?.birdId === 'object' ? String(b.birdId?.name || '').trim() : '';
        if (birdName) speciesNames.push(birdName);
      });

      upsertPoint(key, {
        name,
        lat: coords.lat,
        lng: coords.lng,
        source: 'record',
        visitInc: 1,
        speciesIds,
        speciesNames,
        date: record.date,
        province,
      });
      bumpProvince(province, key, speciesIds);

      const dayKey = toDayKey(record.date);
      visits.push({
        date: record.date,
        dayKey,
        pointKey: key,
        name,
        lat: coords.lat,
        lng: coords.lng,
        speciesCount: speciesIds.length,
        speciesNames: speciesNames.slice(0, 12),
        province,
      });

      if (dayKey) {
        const trip = tripMap.get(dayKey) || {
          dayKey,
          date: record.date,
          stops: [],
          _seenKeys: new Set(),
          _species: new Set(),
        };
        if (!trip._seenKeys.has(key)) {
          trip._seenKeys.add(key);
          trip.stops.push({
            pointKey: key,
            name,
            lat: coords.lat,
            lng: coords.lng,
          });
        }
        speciesIds.forEach((id) => trip._species.add(id));
        tripMap.set(dayKey, trip);
      }
    });

    createdLocations.forEach((loc) => {
      const coords = parseCoordPair(loc.coordinates?.coordinates);
      if (!coords) return;
      const name = String(loc.name || '').trim() || '未命名地点';
      const key = `${coords.lat.toFixed(5)},${coords.lng.toFixed(5)}|${name.toLowerCase()}`;
      const province = pickProvince(loc.address);
      upsertPoint(key, {
        name,
        lat: coords.lat,
        lng: coords.lng,
        source: 'created_location',
        locationId: String(loc._id),
        date: loc.createdAt,
        province,
      });
      bumpProvince(province, key, []);
    });

    const points = [...pointsMap.values()]
      .map((p) => ({
        key: p.key,
        name: p.name,
        lat: p.lat,
        lng: p.lng,
        visitCount: p.visitCount,
        speciesCount: p.species.size,
        speciesNames: [...p.speciesNames].slice(0, 16),
        firstDate: p.firstDate,
        lastDate: p.lastDate,
        months: [...p.months].sort(),
        sources: [...p.sources],
        locationId: p.locationId,
        province: p.province || '',
      }))
      .sort((a, b) => b.visitCount - a.visitCount || String(a.name).localeCompare(String(b.name), 'zh-CN'));

    const monthSet = new Set();
    points.forEach((p) => {
      (p.months || []).forEach((m) => monthSet.add(m));
    });
    const timeline = [...monthSet].sort();

    const trips = [...tripMap.values()]
      .map((t) => ({
        dayKey: t.dayKey,
        date: t.date,
        stopCount: t.stops.length,
        speciesCount: t._species.size,
        stops: t.stops,
      }))
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    const provinces = [...provinceAgg.values()]
      .map((p) => ({
        name: p.name,
        points: p.pointKeys.size,
        species: p.species.size,
      }))
      .sort((a, b) => b.species - a.species || b.points - a.points);

    return res.json({
      success: true,
      data: {
        points,
        timeline,
        visits,
        trips,
        provinces,
        totals: {
          points: points.length,
          visits: visits.length,
          trips: trips.length,
          fromRecords: points.filter((p) => p.sources.includes('record')).length,
          fromCreatedLocations: points.filter((p) => p.sources.includes('created_location')).length,
        },
      },
    });
  } catch (error) {
    devError('获取个人足迹失败:', error);
    return sendControllerError(res, error, {
      defaultMessage: '获取个人足迹失败',
      defaultCode: 'PERSONAL_STATS_OPERATION_FAILED',
    });
  }
};

// @desc    个人鸟种初见（当前用户）
// @route   GET /api/personal/stats/bird-firsts
// @access  Private
const getPersonalBirdFirsts = async (req, res) => {
  try {
    const userId = req.user.id;
    const year = String(req.query.year || '').trim();

    const records = await Record.find({
      observer: userId,
      status: { $ne: 'draft' },
    })
      .sort({ date: 1 })
      .limit(5000)
      .lean();

    const birdFirstMap = new Map();
    records.forEach((record) => {
      (Array.isArray(record.birds) ? record.birds : []).forEach((birdRecord) => {
        const birdId = getBirdIdString(birdRecord?.birdId);
        if (!birdId) return;
        const existing = birdFirstMap.get(birdId);
        if (!existing || new Date(record.date) < new Date(existing.date)) {
          birdFirstMap.set(birdId, {
            birdId,
            date: record.date,
            location: record.location?.name || '未知地点',
            recordId: record._id,
          });
        }
      });
    });

    const birdIds = [...birdFirstMap.keys()];
    const birds = birdIds.length
      ? await Bird.find({ _id: { $in: birdIds } }).select('name scientificName images').lean()
      : [];
    const birdById = new Map(birds.map((b) => [String(b._id), b]));

    let results = [];
    birdFirstMap.forEach((item, birdId) => {
      const bird = birdById.get(birdId);
      if (!bird) return;
      results.push({
        _id: `${bird._id}_${item.recordId}`,
        bird: {
          _id: bird._id,
          name: bird.name,
          scientificName: bird.scientificName,
          images: bird.images || [],
        },
        location: item.location,
        createdAt: item.date,
      });
    });

    results.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

    if (year && /^\d{4}$/.test(year)) {
      const y = Number(year);
      results = results.filter((row) => {
        const d = new Date(row.createdAt);
        return !Number.isNaN(d.getTime()) && d.getFullYear() === y;
      });
    }

    return res.json({
      success: true,
      data: results,
      count: results.length,
    });
  } catch (error) {
    devError('获取个人鸟种初见失败:', error);
    return sendControllerError(res, error, {
      defaultMessage: '获取个人鸟种初见失败',
      defaultCode: 'PERSONAL_STATS_OPERATION_FAILED',
    });
  }
};

// @desc    个人地点初见（当前用户）
// @route   GET /api/personal/stats/location-firsts
// @access  Private
const getPersonalLocationFirsts = async (req, res) => {
  try {
    const userId = req.user.id;
    const year = String(req.query.year || '').trim();

    const records = await Record.find({
      observer: userId,
      status: { $ne: 'draft' },
    })
      .sort({ date: 1 })
      .limit(5000)
      .lean();

    const locationMap = new Map();
    records.forEach((record) => {
      const locationName = String(record.location?.name || '').trim();
      if (!locationName) return;

      if (!locationMap.has(locationName)) {
        locationMap.set(locationName, {
          location: locationName,
          firstRecordDate: record.date,
          _birdIds: new Set(),
        });
      }
      const existing = locationMap.get(locationName);
      (Array.isArray(record.birds) ? record.birds : []).forEach((birdRecord) => {
        const birdId = getBirdIdString(birdRecord?.birdId);
        if (birdId) existing._birdIds.add(birdId);
      });
      if (new Date(record.date) < new Date(existing.firstRecordDate)) {
        existing.firstRecordDate = record.date;
      }
    });

    let ranked = [...locationMap.values()]
      .map((item) => ({
        location: item.location,
        firstRecordDate: item.firstRecordDate,
        birdCount: item._birdIds.size,
      }))
      .sort((a, b) => new Date(a.firstRecordDate) - new Date(b.firstRecordDate));

    if (year && /^\d{4}$/.test(year)) {
      const y = Number(year);
      ranked = ranked.filter((row) => {
        const d = new Date(row.firstRecordDate);
        return !Number.isNaN(d.getTime()) && d.getFullYear() === y;
      });
    }

    const names = ranked.map((item) => item.location);
    const locationDocs = names.length
      ? await Location.find({ name: { $in: names }, status: { $ne: 'archived' } })
          .select('name type images environment')
          .lean()
      : [];
    const locationByName = new Map(
      locationDocs.map((doc) => [String(doc.name || '').trim(), doc])
    );

    const results = ranked.map((item, index) => {
      const doc = locationByName.get(item.location);
      return {
        _id: doc?._id ? String(doc._id) : `location_${index}`,
        location: item.location,
        firstRecordDate: item.firstRecordDate,
        birdCount: item.birdCount,
        locationId: doc?._id ? String(doc._id) : null,
        locationType: doc?.type || '',
        images: Array.isArray(doc?.images) ? doc.images : [],
        environment: doc?.environment || null,
      };
    });

    return res.json({
      success: true,
      data: results,
      count: results.length,
    });
  } catch (error) {
    devError('获取个人地点初见失败:', error);
    return sendControllerError(res, error, {
      defaultMessage: '获取个人地点初见失败',
      defaultCode: 'PERSONAL_STATS_OPERATION_FAILED',
    });
  }
};

module.exports = {
  getPersonalStats,
  getPersonalStatsDashboard,
  getPersonalAnalytics,
  getPersonalFootprint,
  getPersonalBirdFirsts,
  getPersonalLocationFirsts,
};
