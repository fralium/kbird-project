const rateLimit = require('express-rate-limit');
const { isDevelopment } = require('../utils/devLogger');

// 通用API限流
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: isDevelopment ? 2000 : 100, // 开发环境更宽松
  message: {
    success: false,
    message: '请求过于频繁，请稍后再试',
    retryAfter: 15 * 60 // 重试时间（秒）
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// 严格限流（用于敏感操作）
const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: isDevelopment ? 1000 : 10, // 开发环境更宽松
  message: {
    success: false,
    message: '操作过于频繁，请稍后再试',
    retryAfter: 15 * 60
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// 登录限流
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 5, // 限制每个IP 15分钟内最多5次登录尝试
  message: {
    success: false,
    message: '登录尝试过于频繁，请15分钟后再试',
    retryAfter: 15 * 60
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// 文件上传限流
const uploadLimiter = rateLimit({
  windowMs: 60 * 1000, // 1分钟
  max: 10, // 限制每个IP 1分钟内最多10个文件上传
  message: {
    success: false,
    message: '文件上传过于频繁，请稍后再试',
    retryAfter: 60
  },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = {
  generalLimiter,
  strictLimiter,
  loginLimiter,
  uploadLimiter
};
