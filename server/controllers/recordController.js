const Record = require('../models/recordModel');
const Bird = require('../models/birdModel');
const { clearCache } = require('../middleware/cache');

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
      date, 
      observer,
      status = 'approved' // 默认只显示已审核的记录
    } = req.query;
    
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);

    // 构建查询条件
    const query = {};
    
    // 处理状态筛选 - 支持多个状态值
    if (status) {
      if (status.includes(',')) {
        // 多个状态值，用逗号分隔
        const statusList = status.split(',').map(s => s.trim());
        query.status = { $in: statusList };
      } else {
        // 单个状态值
        query.status = status;
      }
    } else {
      // 默认只显示已审核的记录
      query.status = 'approved';
    }
    
    // 搜索条件
    if (search) {
      const searchRegex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      query.$or = [
        { 'location.name': searchRegex },
        { title: searchRegex },
        { description: searchRegex },
        { notes: searchRegex },
        { tags: { $in: [searchRegex] } }
      ];
    }
    
    // 地点筛选
    if (location) {
      query['location.name'] = new RegExp(location.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    }
    
    // 观察者筛选
    if (observer) {
      query.observer = observer;
    }
    
    // 日期筛选
    if (date) {
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
    
    // 分页查询
    const records = await Record.find(query)
      .populate('observer', 'name email avatar')
      .populate('birds.birdId', 'name scientificName description habitat distribution')
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
    res.status(500).json({
      success: false,
      message: '获取观鸟记录失败',
      error: error.message,
    });
  }
};

// @desc    获取单个观鸟记录
// @route   GET /api/records/:id
// @access  Public
const getRecord = async (req, res) => {
  try {
    const record = await Record.findById(req.params.id)
      .populate('observer', 'name email avatar')
      .populate('birds.birdId', 'name scientificName description habitat distribution');

    if (!record) {
      return res.status(404).json({
        success: false,
        message: '观鸟记录不存在'
      });
    }

    res.status(200).json({
      success: true,
      data: record
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取观鸟记录失败',
      error: error.message,
    });
  }
};

// @desc    创建观鸟记录
// @route   POST /api/records
// @access  Private
const createRecord = async (req, res) => {
  try {
    console.log('创建Record请求:', {
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
      images, 
      tags 
    } = req.body;

    // 验证必要字段
    if (!location || !location.name || !date || !birds || birds.length === 0) {
      return res.status(400).json({
        success: false,
        message: '缺少必要字段：地点、日期和鸟类信息'
      });
    }

    // 验证鸟类是否存在
    const birdIds = birds.map(bird => bird.birdId);
    const existingBirds = await Bird.find({ _id: { $in: birdIds } });
    
    if (existingBirds.length !== birdIds.length) {
      return res.status(400).json({
        success: false,
        message: '部分鸟类不存在于数据库中'
      });
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
            const imagesToAdd = newImages.map(img => ({
              url: img.url,
              caption: img.caption || '',
              photographer: userId,
              date: new Date(),
              location: location.name,
              source: 'observation_record' // 标记来源
            }));

            await Bird.findByIdAndUpdate(
              bird.birdId,
              { $push: { images: { $each: imagesToAdd } } }
            );
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
        images: bird.images || []
      })),
      notes: notes || '',
      weather: weather || '',
      temperature,
      humidity,
      wind,
      images: images || [],
      tags: tags || [],
      status: 'pending' // 新记录需要审核
    });

    // 填充关联数据
    const populatedRecord = await Record.findById(record._id)
      .populate('observer', 'name email avatar')
      .populate('birds.birdId', 'name scientificName description habitat distribution');

    // 清除相关缓存
    clearCache('/api/records\\?');
    clearCache('/api/locations');
    
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
    res.status(500).json({
      success: false,
      message: '创建观鸟记录失败',
      error: error.message,
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
      images, 
      tags 
    } = req.body;

    // 查找观鸟记录
    const record = await Record.findById(recordId);

    if (!record) {
      return res.status(404).json({
        success: false,
        message: '观鸟记录不存在'
      });
    }

    // 检查用户权限
    if (record.observer.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: '您没有权限编辑此观鸟记录'
      });
    }

    // 验证必要字段
    if (!location || !location.name || !date || !birds || birds.length === 0) {
      return res.status(400).json({
        success: false,
        message: '缺少必要字段：地点、日期和鸟类信息'
      });
    }

    // 验证鸟类是否存在
    const birdIds = birds.map(bird => bird.birdId);
    const existingBirds = await Bird.find({ _id: { $in: birdIds } });
    
    if (existingBirds.length !== birdIds.length) {
      return res.status(400).json({
        success: false,
        message: '部分鸟类不存在于数据库中'
      });
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
            const imagesToAdd = newImages.map(img => ({
              url: img.url,
              caption: img.caption || '',
              photographer: userId,
              date: new Date(),
              location: location.name,
              source: 'observation_record' // 标记来源
            }));

            await Bird.findByIdAndUpdate(
              bird.birdId,
              { $push: { images: { $each: imagesToAdd } } }
            );
          }
        }
      }
    });

    // 等待所有照片同步完成
    await Promise.all(birdImageSyncPromises);

    // 更新观鸟记录
    console.log('后端接收到的birds数据:', birds);
    const birdsData = birds.map(bird => ({
      birdId: bird.birdId,
      notes: bird.notes || '',
      count: bird.count || 1,
      images: bird.images || []
    }));
    console.log('处理后的birds数据:', birdsData);
    
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
        images: images || [],
        tags: tags || [],
        status: 'pending', // 编辑后重新进入待审核状态
        reviewedBy: null,
        reviewedAt: null,
        reviewNotes: null
      },
      { new: true }
    ).populate('observer', 'name email avatar')
     .populate('birds.birdId', 'name scientificName description habitat distribution');

    // 清除相关缓存
    clearCache(`/api/records/${recordId}`);
    clearCache('/api/records\\?');
    clearCache('/api/locations');
    
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
    res.status(500).json({
      success: false,
      message: '更新观鸟记录失败',
      error: error.message,
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

    console.log('从Record中删除鸟类请求:', {
      recordId: recordId,
      birdId: birdId,
      userId: userId
    });

    // 查找观鸟记录
    const record = await Record.findById(recordId);

    if (!record) {
      console.log('Record不存在:', recordId);
      return res.status(404).json({
        success: false,
        message: '观鸟记录不存在'
      });
    }

    // 检查用户权限
    if (record.observer.toString() !== userId) {
      console.log('权限检查失败: 用户无权删除此Record中的鸟类');
      return res.status(403).json({
        success: false,
        message: '您没有权限删除此观鸟记录中的鸟类'
      });
    }

    // 查找要删除的鸟类在Record中的索引
    const birdIndex = record.birds.findIndex(bird => bird.birdId.toString() === birdId);
    
    if (birdIndex === -1) {
      console.log('鸟类不在Record中:', birdId);
      return res.status(404).json({
        success: false,
        message: '该鸟类不在此观鸟记录中'
      });
    }

    // 检查删除后是否还有其他鸟类
    if (record.birds.length === 1) {
      // 如果只有一只鸟，删除整个Record
      console.log('Record中只有一只鸟，删除整个Record');
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
      console.log('从Record中删除鸟类，保留其他鸟类');
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
    console.error('从Record中删除鸟类错误:', error);
    res.status(500).json({
      success: false,
      message: '删除鸟类失败',
      error: error.message,
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

    console.log('删除Record请求:', {
      recordId: recordId,
      userId: userId
    });

    const record = await Record.findById(recordId);

    if (!record) {
      console.log('Record不存在:', recordId);
      return res.status(404).json({
        success: false,
        message: '观鸟记录不存在'
      });
    }

    console.log('找到Record:', {
      id: record._id,
      observer: record.observer,
      observerString: record.observer.toString(),
      userId: userId
    });

    // 检查用户权限
    if (record.observer.toString() !== userId) {
      console.log('权限检查失败: 用户无权删除此Record');
      return res.status(403).json({
        success: false,
        message: '您没有权限删除此观鸟记录'
      });
    }

    await Record.findByIdAndDelete(recordId);
    console.log('Record删除成功');

    // 清除相关缓存
    clearCache(`/api/records/${recordId}`);
    clearCache('/api/records\\?');
    clearCache('/api/locations');

    res.status(200).json({
      success: true,
      message: '观鸟记录删除成功'
    });
  } catch (error) {
    console.error('删除Record错误:', error);
    res.status(500).json({
      success: false,
      message: '删除观鸟记录失败',
      error: error.message,
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
    
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);

    // 构建查询条件
    const query = { observer: userId };
    if (status) {
      query.status = status;
    }

    // 计算总数
    const totalItems = await Record.countDocuments(query);
    
    // 分页查询
    const records = await Record.find(query)
      .populate('observer', 'name email avatar')
      .populate('birds.birdId', 'name scientificName description habitat distribution')
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
    res.status(500).json({
      success: false,
      message: '获取用户观鸟记录失败',
      error: error.message,
    });
  }
};

// @desc    获取特定鸟类的观鸟记录
// @route   GET /api/records/bird/:birdId
// @access  Public
const getRecordsByBird = async (req, res) => {
  try {
    const { birdId } = req.params;
    const { page = 1, limit = 10, status = 'approved' } = req.query;
    
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    
    // 构建查询条件
    const query = {
      'birds.birdId': birdId
    };
    
    // 处理状态筛选
    if (status) {
      if (status.includes(',')) {
        const statusList = status.split(',').map(s => s.trim());
        query.status = { $in: statusList };
      } else {
        query.status = status;
      }
    } else {
      query.status = 'approved';
    }
    
    // 查询记录
    const records = await Record.find(query)
      .populate('location', 'name address')
      .populate('observer', 'name avatar')
      .populate('birds.birdId', 'name scientificName description habitat distribution')
      .sort({ date: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum);
    
    // 转换为sightings格式以保持前端兼容性
    const sightings = [];
    records.forEach(record => {
      record.birds.forEach(bird => {
        if (bird.birdId._id.toString() === birdId) {
          sightings.push({
            _id: `${record._id}_${bird.birdId._id}`,
            bird: {
              _id: bird.birdId._id,
              name: bird.birdId.name,
              scientificName: bird.birdId.scientificName,
              images: bird.birdId.images || []
            },
            location: {
              name: record.location.name,
              _id: record.location._id,
              address: record.location.address
            },
            date: record.date,
            observer: {
              name: record.observer.name,
              _id: record.observer._id,
              avatar: record.observer.avatar
            },
            notes: bird.notes || '',
            images: bird.images || [],
            recordId: record._id
          });
        }
      });
    });
    
    // 获取总数
    const total = await Record.countDocuments(query);
    
    res.json({
      success: true,
      data: sightings,
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(total / limitNum),
        totalItems: total,
        itemsPerPage: limitNum
      }
    });
  } catch (error) {
    console.error('获取鸟类观鸟记录失败:', error);
    res.status(500).json({
      success: false,
      message: '获取鸟类观鸟记录失败',
      error: error.message
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
  getRecordsByBird
};
