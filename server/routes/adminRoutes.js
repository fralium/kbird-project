const express = require('express');
const router = express.Router();
const { 
  getCacheMetricsReport,
  getApiErrorMetricsReport,
} = require('../controllers/adminController');
const { protect, authorize } = require('../middleware/auth');

router.get('/cache-metrics', protect, authorize('admin'), getCacheMetricsReport);
router.get('/error-metrics', protect, authorize('admin'), getApiErrorMetricsReport);

module.exports = router;
