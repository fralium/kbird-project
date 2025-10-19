const Bird = require('../models/birdModel');
const User = require('../models/userModel');

// @desc    获取待审核的新鸟类申请
// @route   GET /api/admin/pending-birds
// @access  Private (Admin only)
const getPendingBirds = async (req, res) => {
  try {
    // 获取状态为pending的新鸟类申请
    const pendingBirds = await Bird.find({ 
      status: 'pending',
      isTemporary: true 
    })
    .populate('requestedBy', 'name email')
    .sort({ requestedAt: -1 });

    res.status(200).json({
      success: true,
      data: pendingBirds
    });

  } catch (error) {
    console.error('获取待审核鸟类失败:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误',
      error: error.message
    });
  }
};

// @desc    获取待审核的临时观察记录
// @route   GET /api/admin/pending-sightings
// @access  Private (Admin only)
const getPendingSightings = async (req, res) => {
  try {
    // 查询所有有待审核观察记录的鸟类
    const birdsWithPendingSightings = await Bird.find({
      'sightings.status': 'pending'
    })
    .populate('sightings.observer', 'name email')
    .select('name scientificName sightings');

    // 提取待审核的观察记录
    const pendingSightings = [];
    birdsWithPendingSightings.forEach(bird => {
      bird.sightings.forEach((sighting) => {
        if (sighting.status === 'pending') {
          pendingSightings.push({
            _id: sighting._id,
            bird: {
              _id: bird._id,
              name: bird.name,
              scientificName: bird.scientificName
            },
            location: sighting.location,
            date: sighting.date,
            observer: sighting.observer,
            notes: sighting.notes,
            weather: sighting.weather,
            behavior: sighting.behavior,
            images: sighting.images,
            status: sighting.status,
            submittedAt: sighting.submittedAt,
            isTemporary: sighting.isTemporary
          });
        }
      });
    });

    // 按提交时间排序
    pendingSightings.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));

    res.status(200).json({
      success: true,
      data: pendingSightings
    });

  } catch (error) {
    console.error('获取待审核观察记录失败:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误',
      error: error.message
    });
  }
};

// @desc    获取用户报告
// @route   GET /api/admin/user-reports
// @access  Private (Admin only)
const getUserReports = async (req, res) => {
  try {
    const Report = require('../models/reportModel');
    
    // 获取所有用户报告
    const reports = await Report.find({})
      .populate('reporter', 'name email')
      .populate('relatedBird', 'name scientificName')
      .populate('relatedUser', 'name email')
      .populate('handledBy', 'name email')
      .sort({ createdAt: -1 })
      .limit(50); // 限制返回数量

    res.status(200).json({
      success: true,
      data: reports
    });

  } catch (error) {
    console.error('获取用户报告失败:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误',
      error: error.message
    });
  }
};

// @desc    审核新鸟类申请
// @route   POST /api/admin/review-bird/:id
// @access  Private (Admin only)
const reviewBird = async (req, res) => {
  try {
    const { id } = req.params;
    const { action, feedback } = req.body;

    if (!action || !['approve', 'reject'].includes(action)) {
      return res.status(400).json({
        success: false,
        message: '无效的操作类型'
      });
    }

    const bird = await Bird.findById(id);
    if (!bird) {
      return res.status(404).json({
        success: false,
        message: '鸟类申请不存在'
      });
    }

    if (action === 'approve') {
      // 批准申请，将临时鸟类转为正式鸟类
      bird.status = 'approved';
      bird.isTemporary = false;
      bird.approvedBy = req.user._id;
      bird.approvedAt = new Date();
      bird.feedback = feedback || '';
      
      await bird.save();

      res.status(200).json({
        success: true,
        message: '鸟类申请已批准',
        data: bird
      });
    } else {
      // 拒绝申请
      bird.status = 'rejected';
      bird.rejectedBy = req.user._id;
      bird.rejectedAt = new Date();
      bird.feedback = feedback || '';
      
      await bird.save();

      res.status(200).json({
        success: true,
        message: '鸟类申请已拒绝',
        data: bird
      });
    }

  } catch (error) {
    console.error('审核鸟类申请失败:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误',
      error: error.message
    });
  }
};

// @desc    审核临时观察记录
// @route   POST /api/admin/review-sighting/:id
// @access  Private (Admin only)
const reviewSighting = async (req, res) => {
  try {
    const { id } = req.params;
    const { action, feedback } = req.body;

    if (!action || !['approve', 'reject'].includes(action)) {
      return res.status(400).json({
        success: false,
        message: '无效的操作类型'
      });
    }

    // 查找包含该观察记录的鸟类
    const bird = await Bird.findOne({
      'sightings._id': id
    });

    if (!bird) {
      return res.status(404).json({
        success: false,
        message: '观察记录不存在'
      });
    }

    const sighting = bird.sightings.id(id);
    if (!sighting) {
      return res.status(404).json({
        success: false,
        message: '观察记录不存在'
      });
    }

    if (action === 'approve') {
      // 批准观察记录
      sighting.status = 'approved';
      sighting.isTemporary = false;
      sighting.reviewedBy = req.user._id;
      sighting.reviewedAt = new Date();
      sighting.reviewNotes = feedback || '';
      
      await bird.save();

      res.status(200).json({
        success: true,
        message: '观察记录已批准',
        data: sighting
      });
    } else {
      // 拒绝观察记录
      sighting.status = 'rejected';
      sighting.reviewedBy = req.user._id;
      sighting.reviewedAt = new Date();
      sighting.reviewNotes = feedback || '';
      
      await bird.save();

      res.status(200).json({
        success: true,
        message: '观察记录已拒绝',
        data: sighting
      });
    }

  } catch (error) {
    console.error('审核观察记录失败:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误',
      error: error.message
    });
  }
};

module.exports = {
  getPendingBirds,
  getPendingSightings,
  getUserReports,
  reviewBird,
  reviewSighting
};
