const { sendControllerError } = require('../middleware/controllerError');
const { getCacheMetrics } = require('../middleware/cache');
const { getApiErrorMetrics } = require('../middleware/apiMetrics');
const { devError } = require('../utils/devLogger');

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
    devError('获取用户报告失败:', error);
    return sendControllerError(res, error, {
      defaultMessage: '服务器错误',
      defaultCode: 'ADMIN_OPERATION_FAILED',
    });
  }
};

// @desc    获取缓存运行指标
// @route   GET /api/admin/cache-metrics
// @access  Private (Admin only)
const getCacheMetricsReport = async (req, res) => {
  try {
    return res.status(200).json({
      success: true,
      data: getCacheMetrics(),
    });
  } catch (error) {
    return sendControllerError(res, error, {
      defaultMessage: '获取缓存指标失败',
      defaultCode: 'ADMIN_OPERATION_FAILED',
    });
  }
};

// @desc    获取关键接口错误率指标
// @route   GET /api/admin/error-metrics
// @access  Private (Admin only)
const getApiErrorMetricsReport = async (req, res) => {
  try {
    const windowMinutes = Number.parseInt(req.query.windowMinutes, 10);
    return res.status(200).json({
      success: true,
      data: getApiErrorMetrics(windowMinutes),
    });
  } catch (error) {
    return sendControllerError(res, error, {
      defaultMessage: '获取错误率指标失败',
      defaultCode: 'ADMIN_OPERATION_FAILED',
    });
  }
};

module.exports = {
  getUserReports,
  getCacheMetricsReport,
  getApiErrorMetricsReport,
};
