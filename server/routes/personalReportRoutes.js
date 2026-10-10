const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  generateAnnualReport,
  generateMonthlyReport,
  generateCustomReport,
} = require('../controllers/personalReportController');
const { validateYearMonthParams, validateDateRangeQuery } = require('../middleware/validation');

// 所有路由都需要认证
router.use(protect);

// 年度报告
router.get('/annual/:year', validateYearMonthParams, generateAnnualReport);

// 月度报告
router.get('/monthly/:year/:month', validateYearMonthParams, generateMonthlyReport);

// 自定义时间段报告
router.get('/custom', validateDateRangeQuery, generateCustomReport);

module.exports = router;
