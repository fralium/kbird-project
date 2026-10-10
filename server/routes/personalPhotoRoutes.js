const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  getPersonalPhotos,
  getPhotoStats,
  getPhotoBirds,
} = require('../controllers/personalPhotoController');
const { validatePagination } = require('../middleware/validation');

// 所有路由都需要认证
router.use(protect);

// 获取照片库
router.get('/', validatePagination, getPersonalPhotos);

// 获取照片统计
router.get('/stats', getPhotoStats);

// 获取有照片的鸟类列表
router.get('/birds', getPhotoBirds);

module.exports = router;
