const Record = require('../models/recordModel');
const PersonalChecklist = require('../models/personalChecklistModel');
const Bird = require('../models/birdModel');
const { sendControllerError } = require('../middleware/controllerError');
const { devError } = require('../utils/devLogger');
const { localYearRange, localMonthRange } = require('../utils/dateCoords');

const getBirdIdString = (birdId) => {
  if (!birdId) return null;
  if (birdId._id) return birdId._id.toString();
  if (typeof birdId === 'string') return birdId;
  if (typeof birdId.toString === 'function') return birdId.toString();
  return null;
};

// @desc    生成年度观鸟报告
// @route   GET /api/personal/reports/annual/:year
// @access  Private
const generateAnnualReport = async (req, res) => {
  try {
    const userId = req.user.id;
    const year = parseInt(req.params.year) || new Date().getFullYear();
    
    const { startDate: yearStart, endDate: yearEnd } = localYearRange(year);
    
    // 获取年度记录
    const records = await Record.find({
      observer: userId,
      status: { $ne: 'draft' },
      date: { $gte: yearStart, $lte: yearEnd },
    })
      .populate('birds.birdId', 'name scientificName category')
      .sort({ date: -1 });
    
    // 统计信息
    const totalRecords = records.length;
    const totalBirds = records.reduce((sum, r) => sum + (r.birds?.length || 0), 0);
    
    // 观察到的鸟类种类
    const observedSpecies = new Set();
    records.forEach(record => {
      record.birds?.forEach(bird => {
        const birdIdStr = getBirdIdString(bird?.birdId);
        if (!birdIdStr) return;
        observedSpecies.add(birdIdStr);
      });
    });
    
    // 新发现的鸟类（今年首次观察）
    const checklist = await PersonalChecklist.findOne({ userId })
      .populate('observedBirds.birdId', 'name scientificName');
    
    const newSpecies = [];
    if (checklist) {
      checklist.observedBirds.forEach(bird => {
        if (bird.firstSeenDate >= yearStart && bird.firstSeenDate <= yearEnd) {
          newSpecies.push({
            name: bird.birdId?.name,
            scientificName: bird.birdId?.scientificName,
            firstSeenDate: bird.firstSeenDate,
            firstSeenLocation: bird.firstSeenLocation,
          });
        }
      });
    }
    
    // 最常观察的鸟类
    const birdCounts = {};
    records.forEach(record => {
      record.birds?.forEach(bird => {
        if (bird.birdId) {
          const birdId = getBirdIdString(bird.birdId);
          if (!birdId) return;
          birdCounts[birdId] = (birdCounts[birdId] || 0) + (bird.count || 1);
        }
      });
    });
    
    const topBirds = Object.entries(birdCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([birdId, count]) => {
        const bird = records.find(r => 
          r.birds?.some(b => b.birdId?._id.toString() === birdId)
        )?.birds?.find(b => b.birdId?._id.toString() === birdId)?.birdId;
        return {
          name: bird?.name,
          scientificName: bird?.scientificName,
          count,
        };
      })
      .filter(b => b.name);
    
    // 最常去的地点
    const locationCounts = {};
    records.forEach(record => {
      const locationName = record.location?.name;
      if (locationName) {
        locationCounts[locationName] = (locationCounts[locationName] || 0) + 1;
      }
    });
    
    const topLocations = Object.entries(locationCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]) => ({ name, count }));
    
    // 月度统计
    const monthlyStats = Array.from({ length: 12 }, (_, i) => {
      const monthStart = new Date(year, i, 1);
      const monthEnd = new Date(year, i + 1, 0);
      const monthRecords = records.filter(r => 
        r.date >= monthStart && r.date <= monthEnd
      );
      return {
        month: i + 1,
        records: monthRecords.length,
        species: new Set(
          monthRecords.flatMap(r => 
            r.birds?.map(b => b.birdId?._id.toString()).filter(Boolean) || []
          )
        ).size,
      };
    });
    
    // 照片统计
    let totalPhotos = 0;
    records.forEach(record => {
      totalPhotos += record.images?.length || 0;
      record.birds?.forEach(bird => {
        totalPhotos += bird.images?.length || 0;
      });
    });
    
    res.json({
      success: true,
      data: {
        year,
        generatedAt: new Date(),
        summary: {
          totalRecords,
          totalBirds,
          totalSpecies: observedSpecies.size,
          newSpecies: newSpecies.length,
          totalPhotos,
        },
        newSpecies,
        topBirds,
        topLocations,
        monthlyStats,
        records: records.slice(0, 20).map(r => ({
          id: r._id,
          title: r.title,
          date: r.date,
          location: r.location?.name,
          birds: r.birds?.map(b => ({
            name: b.birdId?.name,
            count: b.count,
          })),
        })),
      },
    });
  } catch (error) {
    devError('生成年度报告失败:', error);
    return sendControllerError(res, error, {
      defaultMessage: '生成年度报告失败',
      defaultCode: 'PERSONAL_REPORT_OPERATION_FAILED',
    });
  }
};

// @desc    生成月度观鸟报告
// @route   GET /api/personal/reports/monthly/:year/:month
// @access  Private
const generateMonthlyReport = async (req, res) => {
  try {
    const userId = req.user.id;
    const year = parseInt(req.params.year) || new Date().getFullYear();
    const month = parseInt(req.params.month) || new Date().getMonth() + 1;
    
    const { startDate: monthStart, endDate: monthEnd } = localMonthRange(year, month);
    
    // 获取月度记录
    const records = await Record.find({
      observer: userId,
      status: { $ne: 'draft' },
      date: { $gte: monthStart, $lte: monthEnd },
    })
      .populate('birds.birdId', 'name scientificName')
      .sort({ date: -1 });
    
    // 统计信息
    const totalRecords = records.length;
    const observedSpecies = new Set();
    records.forEach(record => {
      record.birds?.forEach(bird => {
        const birdIdStr = getBirdIdString(bird?.birdId);
        if (!birdIdStr) return;
        observedSpecies.add(birdIdStr);
      });
    });
    
    res.json({
      success: true,
      data: {
        year,
        month,
        generatedAt: new Date(),
        summary: {
          totalRecords,
          totalSpecies: observedSpecies.size,
        },
        records: records.map(r => ({
          id: r._id,
          title: r.title,
          date: r.date,
          location: r.location?.name,
          birds: r.birds?.map(b => ({
            name: b.birdId?.name,
            count: b.count,
          })),
        })),
      },
    });
  } catch (error) {
    devError('生成月度报告失败:', error);
    return sendControllerError(res, error, {
      defaultMessage: '生成月度报告失败',
      defaultCode: 'PERSONAL_REPORT_OPERATION_FAILED',
    });
  }
};

// @desc    生成自定义时间段报告
// @route   GET /api/personal/reports/custom
// @access  Private
const generateCustomReport = async (req, res) => {
  try {
    const userId = req.user.id;
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      const invalidDateRangeError = new Error('请提供开始日期和结束日期');
      invalidDateRangeError.statusCode = 400;
      invalidDateRangeError.code = 'MISSING_DATE_RANGE';
      return sendControllerError(res, invalidDateRangeError, {
        defaultMessage: '请提供开始日期和结束日期',
        defaultCode: 'MISSING_DATE_RANGE',
        fallbackStatus: 400,
      });
    }
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    // 获取记录
    const records = await Record.find({
      observer: userId,
      status: { $ne: 'draft' },
      date: { $gte: start, $lte: end },
    })
      .populate('birds.birdId', 'name scientificName')
      .sort({ date: -1 });
    
    // 统计信息
    const totalRecords = records.length;
    const observedSpecies = new Set();
    records.forEach(record => {
      record.birds?.forEach(bird => {
        const birdIdStr = getBirdIdString(bird?.birdId);
        if (!birdIdStr) return;
        observedSpecies.add(birdIdStr);
      });
    });
    
    res.json({
      success: true,
      data: {
        startDate: start,
        endDate: end,
        generatedAt: new Date(),
        summary: {
          totalRecords,
          totalSpecies: observedSpecies.size,
        },
        records: records.map(r => ({
          id: r._id,
          title: r.title,
          date: r.date,
          location: r.location?.name,
          birds: r.birds?.map(b => ({
            name: b.birdId?.name,
            count: b.count,
          })),
        })),
      },
    });
  } catch (error) {
    devError('生成自定义报告失败:', error);
    return sendControllerError(res, error, {
      defaultMessage: '生成自定义报告失败',
      defaultCode: 'PERSONAL_REPORT_OPERATION_FAILED',
    });
  }
};

module.exports = {
  generateAnnualReport,
  generateMonthlyReport,
  generateCustomReport,
};
