const Location = require('../models/locationModel');
const { clearCache } = require('../middleware/cache');

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
      sortBy = 'name',
      sortOrder = 'asc'
    } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // 构建查询条件
    let query = { status: 'active' };

    if (search) {
      query.$text = { $search: search };
    }

    if (type) {
      query.type = type;
    }

    if (city) {
      query['address.city'] = new RegExp(city, 'i');
    }

    // 构建排序条件
    let sort = {};
    if (sortBy === 'distance' && req.query.lat && req.query.lng) {
      // 按距离排序需要特殊处理
      query.coordinates = {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [parseFloat(req.query.lng), parseFloat(req.query.lat)]
          },
          $maxDistance: 50000 // 50公里范围内
        }
      };
    } else {
      sort[sortBy] = sortOrder === 'desc' ? -1 : 1;
    }

    const locations = await Location.find(query)
      .populate('createdBy', 'name avatar')
      .sort(sort)
      .skip(skip)
      .limit(limitNum)
      .select('-images.photographer');

    // 为每个地点计算实际的统计数据（使用Record数据）
    const Record = require('../models/recordModel');
    const locationsWithStats = await Promise.all(
      locations.map(async (location) => {
        // 使用Record数据统计该地点的观鸟记录数
        const recordsAtLocation = await Record.find({
          'location.name': location.name,
          status: { $in: ['approved', 'pending'] }
        });
        
        // 统计该地点观察到的鸟类种类数
        const uniqueBirdIds = new Set();
        recordsAtLocation.forEach(record => {
          record.birds.forEach(bird => {
            uniqueBirdIds.add(bird.birdId.toString());
          });
        });

        return {
          ...location.toObject(),
          stats: {
            totalRecords: recordsAtLocation.length,
            totalSightings: recordsAtLocation.length, // 保持兼容性
            uniqueSpecies: uniqueBirdIds.size,
            lastVisited: location.stats?.lastVisited
          }
        };
      })
    );

    const total = await Location.countDocuments(query);

    res.status(200).json({
      success: true,
      data: locationsWithStats,
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(total / limitNum),
        totalItems: total,
        itemsPerPage: limitNum,
        hasNextPage: pageNum < Math.ceil(total / limitNum),
        hasPrevPage: pageNum > 1
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取地点列表失败',
      error: error.message,
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
      return res.status(404).json({
        success: false,
        message: '地点不存在',
      });
    }

    // 使用Record数据计算实际的观察记录统计数据
    const Record = require('../models/recordModel');
    
    // 统计该地点的观鸟记录数
    const recordsAtLocation = await Record.find({
      'location.name': location.name,
      status: { $in: ['approved', 'pending'] }
    }).populate('birds.birdId', 'name scientificName');
    
    // 统计该地点观察到的鸟类种类数
    const uniqueBirdIds = new Set();
    const birdSpecies = [];
    recordsAtLocation.forEach(record => {
      record.birds.forEach(bird => {
        uniqueBirdIds.add(bird.birdId._id.toString());
        birdSpecies.push({
          _id: bird.birdId._id,
          name: bird.birdId.name,
          scientificName: bird.birdId.scientificName
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
    res.status(500).json({
      success: false,
      message: '获取地点详情失败',
      error: error.message,
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

    // 检查地点是否已存在
    const existingLocation = await Location.findOne({ name });
    if (existingLocation) {
      return res.status(400).json({
        success: false,
        message: '地点名称已存在',
      });
    }

    const locationData = {
      name,
      description,
      coordinates: {
        type: 'Point',
        coordinates: coordinates || [0, 0]
      },
      address: address || {},
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
    res.status(500).json({
      success: false,
      message: '创建地点失败',
      error: error.message,
    });
  }
};

// @desc    更新地点
// @route   PUT /api/locations/:id
// @access  Private
const updateLocation = async (req, res) => {
  try {
    const location = await Location.findById(req.params.id);

    if (!location) {
      return res.status(404).json({
        success: false,
        message: '地点不存在',
      });
    }

    // 检查权限（只有创建者或管理员可以修改）
    if (location.createdBy.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: '无权限修改此地点',
      });
    }

    const updatedLocation = await Location.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate('createdBy', 'name avatar');

    // 清除地点列表缓存，确保更新立即生效
    clearCache('/api/locations');

    res.status(200).json({
      success: true,
      message: '地点更新成功',
      data: updatedLocation,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '更新地点失败',
      error: error.message,
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
      return res.status(404).json({
        success: false,
        message: '地点不存在',
      });
    }

    // 检查权限
    if (location.createdBy.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: '无权限删除此地点',
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
    res.status(500).json({
      success: false,
      message: '删除地点失败',
      error: error.message,
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
      return res.status(400).json({
        success: false,
        message: '请提供经纬度坐标',
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
    res.status(500).json({
      success: false,
      message: '获取附近地点失败',
      error: error.message,
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
    res.status(500).json({
      success: false,
      message: '获取地点统计失败',
      error: error.message,
    });
  }
};

module.exports = {
  getLocations,
  getLocation,
  createLocation,
  updateLocation,
  deleteLocation,
  getNearbyLocations,
  getLocationStats
};
