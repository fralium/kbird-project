const express = require('express');
const router = express.Router();
const { 
  registerUser, 
  loginUser,
  createLocalSession,
  getUserProfile, 
  updateUserProfile,
  getUserContributions,
  getUserFavorites,
  getUserSightings,
  addToFavorites,
  removeFromFavorites,
  uploadAvatar
} = require('../controllers/userController');
const { protect } = require('../middleware/auth');
const multer = require('multer');
const {
  validateUserRegistration,
  validateUserLogin,
} = require('../middleware/validation');
const { isRegistrationEnabled } = require('../config/appMode');

// 配置multer用于头像上传
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 2 * 1024 * 1024, // 2MB限制
  },
  fileFilter: (req, file, cb) => {
    const allowed = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']);
    if (allowed.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('只允许上传 JPG/PNG/GIF/WebP 图片'), false);
    }
  }
});

// 用户注册
router.post(
  '/register',
  (req, res, next) => {
    if (!isRegistrationEnabled()) {
      return res.status(403).json({
        success: false,
        message: '当前为单机自用模式，已关闭注册',
        code: 'REGISTRATION_DISABLED',
      });
    }
    // 兼容旧版 username 字段
    if (req.body.username && !req.body.name) {
      req.body.name = req.body.username;
    }
    next();
  },
  validateUserRegistration,
  registerUser
);

// 本机自动登录（单机 + AUTO_LOGIN + 回环）
router.post('/local-session', createLocalSession);

// 用户登录 (兼容email和usernameOrEmail参数)
router.post(
  '/login',
  (req, res, next) => {
    // 将旧版email参数转换为usernameOrEmail
    if (req.body.email && !req.body.usernameOrEmail) {
      req.body.usernameOrEmail = req.body.email;
    }
    next();
  },
  validateUserLogin,
  loginUser
);

// 获取用户个人资料 (需要登录)
router.get('/profile', protect, getUserProfile);

// 更新用户个人资料 (需要登录)
router.put('/profile', protect, updateUserProfile);

// 获取用户贡献的鸟类记录 (需要登录)
router.get('/contributions', protect, getUserContributions);

// 获取用户收藏的鸟类 (需要登录)
router.get('/favorites', protect, getUserFavorites);

// 获取用户观察记录 (需要登录)
router.get('/sightings', protect, getUserSightings);

// 添加鸟类到收藏 (需要登录)
router.post('/favorites/:id', protect, addToFavorites);

// 从收藏中移除鸟类 (需要登录)
router.delete('/favorites/:id', protect, removeFromFavorites);

// 上传用户头像 (需要登录)
router.post('/avatar', protect, upload.single('avatar'), uploadAvatar);

// 错误处理中间件
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: '文件大小超过限制（最大2MB）'
      });
    }
    return res.status(400).json({
      success: false,
      message: '文件上传错误: ' + error.message
    });
  }
  next(error);
});

module.exports = router;