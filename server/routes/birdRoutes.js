const express = require('express');
const multer = require('multer');
const router = express.Router();
const { 
  getBirds, 
  getBirdById, 
  createBird, 
  updateBird, 
  deleteBird,
  addBirdSighting,
  addBirdImage,
  updateBirdImage,
  deleteBirdImage,
  updateBirdSighting,
  deleteBirdSighting,
  checkDuplicate,
  requestNewBird
} = require('../controllers/birdController');
const { protect, authorize } = require('../middleware/auth');

// 配置multer用于文件上传
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 增加到10MB限制
    fieldSize: 10 * 1024 * 1024, // 字段大小限制
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('只允许上传图片文件'), false);
    }
  }
});

// 错误处理中间件
const handleUploadError = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: '文件过大，请选择小于10MB的图片文件',
        error: 'FILE_TOO_LARGE'
      });
    }
    return res.status(400).json({
      success: false,
      message: '文件上传错误: ' + error.message,
      error: error.code
    });
  }
  next(error);
};

// 获取所有鸟类或按条件搜索
router.get('/', getBirds);

// 搜索鸟类
router.get('/search', getBirds);

// 获取单个鸟类详情
router.get('/:id', getBirdById);

// 创建新鸟类记录 (需要登录)
router.post('/', protect, createBird);

// 更新鸟类信息 (需要登录)
router.put('/:id', protect, updateBird);

// 删除鸟类记录 (需要管理员权限)
router.delete('/:id', protect, authorize('admin'), deleteBird);

// 添加鸟类目击记录 (需要登录)
router.post('/:id/sightings', protect, addBirdSighting);

// 添加鸟类图片 (需要登录)
router.post('/:id/images', protect, upload.single('image'), handleUploadError, addBirdImage);

// 更新鸟类图片信息 (需要登录)
router.put('/:id/images/:imageIndex', protect, updateBirdImage);

// 删除鸟类图片 (需要登录)
router.delete('/:id/images/:imageIndex', protect, deleteBirdImage);

// 更新鸟类观察记录 (需要登录)
router.put('/:id/sightings/:sightingIndex', protect, updateBirdSighting);

// 删除鸟类观察记录 (需要登录)
router.delete('/:id/sightings/:sightingIndex', protect, deleteBirdSighting);

// 检查鸟类是否重复 (需要登录)
router.post('/check-duplicate', protect, checkDuplicate);

// 申请添加新鸟类 (需要登录)
router.post('/request-new', protect, requestNewBird);

module.exports = router;