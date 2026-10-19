const { sendControllerError } = require('../middleware/controllerError');
const { getCacheMetrics } = require('../middleware/cache');
const { getApiErrorMetrics } = require('../middleware/apiMetrics');

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
  getCacheMetricsReport,
  getApiErrorMetricsReport,
};
