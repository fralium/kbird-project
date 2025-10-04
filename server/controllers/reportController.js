const Report = require('../models/reportModel');
const User = require('../models/userModel');
const Bird = require('../models/birdModel');

// @desc    创建用户报告
// @route   POST /api/reports
// @access  Private
const createReport = async (req, res) => {
  try {
    const { title, type, content, relatedBird, relatedSighting, relatedUser, priority = 'medium' } = req.body;

    // 验证必填字段
    if (!title || !type || !content) {
      return res.status(400).json({
        success: false,
        message: '标题、类型和内容不能为空'
      });
    }

    // 创建报告
    const report = new Report({
      title,
      type,
      content,
      priority,
      reporter: req.user._id,
      relatedBird,
      relatedSighting,
      relatedUser
    });

    await report.save();

    // 填充报告者信息
    await report.populate('reporter', 'name email');

    res.status(201).json({
      success: true,
      message: '报告提交成功',
      data: report
    });

  } catch (error) {
    console.error('创建报告失败:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误',
      error: error.message
    });
  }
};

// @desc    获取用户报告列表
// @route   GET /api/reports
// @access  Private
const getUserReports = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, type } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // 构建查询条件
    let query = { reporter: req.user._id };
    
    if (status) {
      query.status = status;
    }
    
    if (type) {
      query.type = type;
    }

    const reports = await Report.find(query)
      .populate('reporter', 'name email')
      .populate('relatedBird', 'name scientificName')
      .populate('relatedUser', 'name email')
      .populate('handledBy', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    const total = await Report.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        reports,
        pagination: {
          current: pageNum,
          pages: Math.ceil(total / limitNum),
          total
        }
      }
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

// @desc    获取单个报告详情
// @route   GET /api/reports/:id
// @access  Private
const getReportById = async (req, res) => {
  try {
    const report = await Report.findById(req.params.id)
      .populate('reporter', 'name email')
      .populate('relatedBird', 'name scientificName')
      .populate('relatedUser', 'name email')
      .populate('handledBy', 'name email');

    if (!report) {
      return res.status(404).json({
        success: false,
        message: '报告不存在'
      });
    }

    // 检查权限：只有报告者或管理员可以查看
    if (report.reporter._id.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: '无权访问此报告'
      });
    }

    res.status(200).json({
      success: true,
      data: report
    });

  } catch (error) {
    console.error('获取报告详情失败:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误',
      error: error.message
    });
  }
};

// @desc    更新报告状态（管理员）
// @route   PUT /api/reports/:id/status
// @access  Private (Admin only)
const updateReportStatus = async (req, res) => {
  try {
    const { status, adminResponse } = req.body;

    if (!status || !['pending', 'in_progress', 'resolved', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: '无效的状态值'
      });
    }

    const report = await Report.findById(req.params.id);
    if (!report) {
      return res.status(404).json({
        success: false,
        message: '报告不存在'
      });
    }

    report.status = status;
    if (adminResponse) {
      report.adminResponse = adminResponse;
    }
    report.handledBy = req.user._id;
    report.handledAt = new Date();

    await report.save();

    res.status(200).json({
      success: true,
      message: '报告状态更新成功',
      data: report
    });

  } catch (error) {
    console.error('更新报告状态失败:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误',
      error: error.message
    });
  }
};

// @desc    获取所有报告（管理员）
// @route   GET /api/reports/admin
// @access  Private (Admin only)
const getAllReports = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, type, priority } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // 构建查询条件
    let query = {};
    
    if (status) {
      query.status = status;
    }
    
    if (type) {
      query.type = type;
    }
    
    if (priority) {
      query.priority = priority;
    }

    const reports = await Report.find(query)
      .populate('reporter', 'name email')
      .populate('relatedBird', 'name scientificName')
      .populate('relatedUser', 'name email')
      .populate('handledBy', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    const total = await Report.countDocuments(query);

    // 获取统计信息
    const stats = await Report.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: {
        reports,
        pagination: {
          current: pageNum,
          pages: Math.ceil(total / limitNum),
          total
        },
        stats
      }
    });

  } catch (error) {
    console.error('获取所有报告失败:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误',
      error: error.message
    });
  }
};

module.exports = {
  createReport,
  getUserReports,
  getReportById,
  updateReportStatus,
  getAllReports
};
