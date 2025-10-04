const express = require('express');
const router = express.Router();
const { 
  getPendingBirds,
  getPendingSightings,
  getUserReports,
  reviewBird,
  reviewSighting
} = require('../controllers/adminController');
const { protect, authorize } = require('../middleware/auth');

// 获取待审核的新鸟类申请
router.get('/pending-birds', protect, authorize('admin'), getPendingBirds);

// 获取待审核的临时观察记录
router.get('/pending-sightings', protect, authorize('admin'), getPendingSightings);

// 获取用户报告
router.get('/user-reports', protect, authorize('admin'), getUserReports);

// 审核新鸟类申请
router.post('/review-bird/:id', protect, authorize('admin'), reviewBird);

// 审核临时观察记录
router.post('/review-sighting/:id', protect, authorize('admin'), reviewSighting);

module.exports = router;
