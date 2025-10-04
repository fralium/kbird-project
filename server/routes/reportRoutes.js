const express = require('express');
const router = express.Router();
const { 
  createReport,
  getUserReports,
  getReportById,
  updateReportStatus,
  getAllReports
} = require('../controllers/reportController');
const { protect, authorize } = require('../middleware/auth');

// 创建用户报告
router.post('/', protect, createReport);

// 获取用户报告列表
router.get('/', protect, getUserReports);

// 获取单个报告详情
router.get('/:id', protect, getReportById);

// 更新报告状态（管理员）
router.put('/:id/status', protect, authorize('admin'), updateReportStatus);

// 获取所有报告（管理员）
router.get('/admin/all', protect, authorize('admin'), getAllReports);

module.exports = router;
