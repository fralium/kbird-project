const express = require('express');
const router = express.Router();
const { 
  getUserReports,
  getCacheMetricsReport,
  getApiErrorMetricsReport,
} = require('../controllers/adminController');
const { protect, authorize } = require('../middleware/auth');

// 获取用户报告
router.get('/user-reports', protect, authorize('admin'), getUserReports);
router.get('/cache-metrics', protect, authorize('admin'), getCacheMetricsReport);
router.get('/error-metrics', protect, authorize('admin'), getApiErrorMetricsReport);

module.exports = router;
