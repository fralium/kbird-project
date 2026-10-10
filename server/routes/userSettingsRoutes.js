const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  getSettings,
  updateSettings,
  resetSettings,
} = require('../controllers/userSettingsController');
const { validateUserSettingsPayload } = require('../middleware/validation');

// 所有路由都需要认证
router.use(protect);

// 获取设置
router.get('/', getSettings);

// 更新设置
router.put('/', validateUserSettingsPayload, updateSettings);

// 重置设置
router.post('/reset', resetSettings);

module.exports = router;
