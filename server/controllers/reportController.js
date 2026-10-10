const Report = require('../models/reportModel');
const User = require('../models/userModel');
const Bird = require('../models/birdModel');
const { sendControllerError } = require('../middleware/controllerError');
const { devError } = require('../utils/devLogger');

// @desc    创建用户报告
// @route   POST /api/reports
// @access  Private
const createReport = async (req, res) => {
  try {
    const { title, type, content, relatedBird, relatedSighting, relatedUser, priority = 'medium' } = req.body;

    // 验证必填字段
    if (!title || !type || !content) {
      const validationError = new Error('标题、类型和内容不能为空');
      validationError.statusCode = 400;
      validationError.code = 'MISSING_REQUIRED_FIELDS';
      return sendControllerError(res, validationError, {
        defaultMessage: '标题、类型和内容不能为空',
        defaultCode: 'MISSING_REQUIRED_FIELDS',
        fallbackStatus: 400,
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
    devError('创建报告失败:', error);
    return sendControllerError(res, error, {
      defaultMessage: '服务器错误',
      defaultCode: 'REPORT_OPERATION_FAILED',
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
    devError('获取用户报告失败:', error);
    return sendControllerError(res, error, {
      defaultMessage: '服务器错误',
      defaultCode: 'REPORT_OPERATION_FAILED',
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
      const notFoundError = new Error('报告不存在');
      notFoundError.statusCode = 404;
      notFoundError.code = 'REPORT_NOT_FOUND';
      return sendControllerError(res, notFoundError, {
        defaultMessage: '报告不存在',
        defaultCode: 'REPORT_NOT_FOUND',
        fallbackStatus: 404,
      });
    }

    // 检查权限：只有报告者或管理员可以查看
    if (report.reporter._id.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      const forbiddenError = new Error('无权访问此报告');
      forbiddenError.statusCode = 403;
      forbiddenError.code = 'REPORT_ACCESS_FORBIDDEN';
      return sendControllerError(res, forbiddenError, {
        defaultMessage: '无权访问此报告',
        defaultCode: 'REPORT_ACCESS_FORBIDDEN',
        fallbackStatus: 403,
      });
    }

    res.status(200).json({
      success: true,
      data: report
    });

  } catch (error) {
    devError('获取报告详情失败:', error);
    return sendControllerError(res, error, {
      defaultMessage: '服务器错误',
      defaultCode: 'REPORT_OPERATION_FAILED',
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
      const invalidStatusError = new Error('无效的状态值');
      invalidStatusError.statusCode = 400;
      invalidStatusError.code = 'INVALID_REPORT_STATUS';
      return sendControllerError(res, invalidStatusError, {
        defaultMessage: '无效的状态值',
        defaultCode: 'INVALID_REPORT_STATUS',
        fallbackStatus: 400,
      });
    }

    const report = await Report.findById(req.params.id);
    if (!report) {
      const notFoundError = new Error('报告不存在');
      notFoundError.statusCode = 404;
      notFoundError.code = 'REPORT_NOT_FOUND';
      return sendControllerError(res, notFoundError, {
        defaultMessage: '报告不存在',
        defaultCode: 'REPORT_NOT_FOUND',
        fallbackStatus: 404,
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
    devError('更新报告状态失败:', error);
    return sendControllerError(res, error, {
      defaultMessage: '服务器错误',
      defaultCode: 'REPORT_OPERATION_FAILED',
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
    devError('获取所有报告失败:', error);
    return sendControllerError(res, error, {
      defaultMessage: '服务器错误',
      defaultCode: 'REPORT_OPERATION_FAILED',
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
