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
const {
  validatePagination,
  validateObjectIdParam,
  validateReportPayload,
  validateReportStatusPayload,
} = require('../middleware/validation');

// 创建用户报告
router.post('/', protect, validateReportPayload, createReport);

// 获取用户报告列表
router.get('/', protect, validatePagination, getUserReports);

// 获取所有报告（管理员）
router.get('/admin/all', protect, authorize('admin'), validatePagination, getAllReports);

// 获取单个报告详情
router.get('/:id', protect, validateObjectIdParam('id'), getReportById);

// 更新报告状态（管理员）
router.put('/:id/status', protect, authorize('admin'), validateObjectIdParam('id'), validateReportStatusPayload, updateReportStatus);

module.exports = router;
