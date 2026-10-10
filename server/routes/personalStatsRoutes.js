const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  getPersonalStats,
  getPersonalStatsDashboard,
  getPersonalAnalytics,
  getPersonalFootprint,
  getPersonalBirdFirsts,
  getPersonalLocationFirsts,
} = require('../controllers/personalStatsController');
const { validatePersonalStatsQuery } = require('../middleware/validation');

// 所有路由都需要认证
router.use(protect);

// 获取统计数据
router.get('/', validatePersonalStatsQuery, getPersonalStats);

// 仪表盘聚合（图表）
router.get('/dashboard', validatePersonalStatsQuery, getPersonalStatsDashboard);

// 个人足迹图数据
router.get('/footprint', validatePersonalStatsQuery, getPersonalFootprint);

// 个人初见
router.get('/bird-firsts', validatePersonalStatsQuery, getPersonalBirdFirsts);
router.get('/location-firsts', validatePersonalStatsQuery, getPersonalLocationFirsts);

// 获取分析报告
router.get('/analytics', validatePersonalStatsQuery, getPersonalAnalytics);

module.exports = router;
