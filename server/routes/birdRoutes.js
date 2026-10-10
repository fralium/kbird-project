const express = require('express');
const multer = require('multer');
const router = express.Router();
const {
  getBirds,
  getBirdFilterOptions,
  getBirdById,
  createBird,
  updateBird,
  deleteBird,
  addBirdSighting,
  addBirdImage,
  setMainBirdImage,
  updateBirdImage,
  deleteBirdImage,
  addBirdCall,
  updateBirdCall,
  deleteBirdCall,
  updateBirdSighting,
  deleteBirdSighting,
  checkDuplicate,
  requestNewBird
} = require('../controllers/birdController');
const { protect, authorize } = require('../middleware/auth');
const {
  validateBird,
  validateSighting,
  validateObjectIdParam,
  validatePagination,
} = require('../middleware/validation');
const { ALLOWED_IMAGE_TYPES } = require('../middleware/fileUploadSecurity');
const { AUDIO_MIME_TO_EXT } = require('../utils/safeUploadPath');

// 配置multer用于文件上传（内存；MIME 白名单，禁止 SVG 等）
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024,
    fieldSize: 10 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_IMAGE_TYPES[file.mimetype]) {
      cb(null, true);
    } else {
      cb(new Error('只允许上传图片文件 (JPG, PNG, GIF, WebP)'), false);
    }
  }
});

const uploadAudio = multer({
  storage: storage,
  limits: {
    fileSize: 20 * 1024 * 1024,
    fieldSize: 10 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    if (AUDIO_MIME_TO_EXT[file.mimetype]) {
      cb(null, true);
    } else {
      cb(new Error('只允许上传音频文件 (MP3, M4A, WAV, OGG)'), false);
    }
  }
});

// 错误处理中间件
const handleUploadError = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: '文件过大，请缩小后重试',
        error: 'FILE_TOO_LARGE'
      });
    }
    return res.status(400).json({
      success: false,
      message: '文件上传错误: ' + error.message,
      error: error.code
    });
  }
  if (error) {
    return res.status(400).json({
      success: false,
      message: error.message || '只允许上传图片文件 (JPG, PNG, GIF, WebP)',
      error: 'INVALID_UPLOAD_TYPE',
    });
  }
  next();
};

// 获取所有鸟类或按条件搜索
router.get('/', validatePagination, getBirds);

// 已见鸟种筛选选项（必须在 /:id 之前）
router.get('/filter-options', getBirdFilterOptions);

// 搜索鸟类
router.get('/search', validatePagination, getBirds);

// 获取单个鸟类详情
router.get('/:id', validateObjectIdParam('id'), getBirdById);

// 创建新鸟类记录 (需要管理员)
router.post('/', protect, authorize('admin'), validateBird, createBird);

// 更新鸟类信息 (需要管理员；本机共享名录)
router.put('/:id', protect, authorize('admin'), validateObjectIdParam('id'), updateBird);

// 删除鸟类记录 (需要管理员权限)
router.delete('/:id', protect, authorize('admin'), validateObjectIdParam('id'), deleteBird);

// 添加鸟类目击记录 (需要登录)
router.post('/:id/sightings', protect, validateObjectIdParam('id'), validateSighting, addBirdSighting);

// 添加鸟类图片 (需要登录)
router.post('/:id/images', protect, validateObjectIdParam('id'), upload.single('image'), handleUploadError, addBirdImage);

// 设置鸟类主图 (需要登录)
router.put('/:id/images/:imageIndex/set-main', protect, validateObjectIdParam('id'), setMainBirdImage);

// 更新鸟类图片信息 (需要登录)
router.put('/:id/images/:imageIndex', protect, validateObjectIdParam('id'), updateBirdImage);

// 删除鸟类图片 (需要登录)
router.delete('/:id/images/:imageIndex', protect, validateObjectIdParam('id'), deleteBirdImage);

// 添加鸟类鸣叫 (需要登录)
router.post('/:id/calls', protect, validateObjectIdParam('id'), uploadAudio.single('audio'), handleUploadError, addBirdCall);

// 更新鸟类鸣叫信息 (需要登录)
router.put('/:id/calls/:callIndex', protect, validateObjectIdParam('id'), updateBirdCall);

// 删除鸟类鸣叫 (需要登录)
router.delete('/:id/calls/:callIndex', protect, validateObjectIdParam('id'), deleteBirdCall);


// 更新鸟类观察记录 (需要登录)
router.put('/:id/sightings/:sightingIndex', protect, validateObjectIdParam('id'), validateSighting, updateBirdSighting);

// 删除鸟类观察记录 (需要登录)
router.delete('/:id/sightings/:sightingIndex', protect, validateObjectIdParam('id'), deleteBirdSighting);

// 检查鸟类是否重复 (需要登录)
router.post('/check-duplicate', protect, checkDuplicate);

// 申请添加新鸟类 (需要登录)
router.post('/request-new', protect, requestNewBird);

module.exports = router;