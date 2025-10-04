const rateLimit = require('express-rate-limit');

// 检查是否为开发环境
const isDevelopment = process.env.NODE_ENV === 'development';

// 通用API限流配置
const createRateLimit = (windowMs, max, message, skipSuccessfulRequests = false) => {
  return rateLimit({
    windowMs,
    max,
    message: {
      success: false,
      message: message,
      retryAfter: Math.ceil(windowMs / 1000)
    },
    skipSuccessfulRequests,
    standardHeaders: true, // 返回速率限制信息在 `RateLimit-*` headers
    legacyHeaders: false, // 禁用 `X-RateLimit-*` headers
    handler: (req, res) => {
      res.status(429).json({
        success: false,
        message: message,
        retryAfter: Math.ceil(windowMs / 1000),
        limit: max,
        windowMs: windowMs
      });
    }
  });
};

// 登录限流 - 防止暴力破解
const loginLimiter = createRateLimit(
  15 * 60 * 1000, // 15分钟
  isDevelopment ? 100 : 5, // 开发环境宽松，生产环境严格
  '登录尝试次数过多，请15分钟后再试',
  false
);

// 注册限流 - 防止垃圾注册
const registerLimiter = createRateLimit(
  60 * 60 * 1000, // 1小时
  3, // 最多3次注册
  '注册尝试次数过多，请1小时后再试',
  false
);

// 通用API限流 - 防止API滥用
const apiLimiter = createRateLimit(
  15 * 60 * 1000, // 15分钟
  isDevelopment ? 50000 : 100, // 开发环境更宽松，生产环境严格
  'API请求过于频繁，请稍后再试',
  true // 成功请求不计入限制
);

// 上传文件限流 - 防止大量文件上传
const uploadLimiter = createRateLimit(
  60 * 60 * 1000, // 1小时
  isDevelopment ? 100 : 20, // 开发环境宽松，生产环境严格
  '文件上传过于频繁，请1小时后再试',
  false
);

// 搜索限流 - 防止搜索API滥用
const searchLimiter = createRateLimit(
  1 * 60 * 1000, // 1分钟
  isDevelopment ? 100 : 30, // 开发环境宽松，生产环境严格
  '搜索请求过于频繁，请稍后再试',
  true // 成功请求不计入限制
);

// 严格限流 - 用于敏感操作
const strictLimiter = createRateLimit(
  5 * 60 * 1000, // 5分钟
  10, // 最多10次
  '操作过于频繁，请5分钟后再试',
  false
);

// IP白名单功能
const createIPWhitelist = (whitelist) => {
  return (req, res, next) => {
    const clientIP = req.ip || req.connection.remoteAddress;
    
    if (whitelist.includes(clientIP)) {
      // 白名单IP不受限制
      return next();
    }
    
    // 非白名单IP继续限流检查
    return next();
  };
};

// 动态限流 - 根据用户角色调整限制
const createDynamicLimiter = (baseLimit, roleMultiplier = {}) => {
  return (req, res, next) => {
    const user = req.user;
    let multiplier = 1;
    
    if (user && roleMultiplier[user.role]) {
      multiplier = roleMultiplier[user.role];
    }
    
    const adjustedLimit = Math.floor(baseLimit * multiplier);
    
    // 临时调整限流配置
    const dynamicLimiter = createRateLimit(
      15 * 60 * 1000, // 15分钟
      adjustedLimit,
      '请求过于频繁，请稍后再试',
      true
    );
    
    dynamicLimiter(req, res, next);
  };
};

// 管理员限流 - 更宽松的限制
const adminLimiter = createRateLimit(
  15 * 60 * 1000, // 15分钟
  isDevelopment ? 2000 : 500, // 管理员有更高的限制
  'API请求过于频繁，请稍后再试',
  true
);

// 错误日志记录中间件
const logRateLimitExceeded = (req, res, next) => {
  const originalSend = res.send;
  
  res.send = function(data) {
    if (res.statusCode === 429) {
      console.warn(`限流触发 - IP: ${req.ip}, 路径: ${req.path}, 用户: ${req.user?.id || '匿名'}`);
    }
    return originalSend.call(this, data);
  };
  
  next();
};

module.exports = {
  loginLimiter,
  registerLimiter,
  apiLimiter,
  uploadLimiter,
  searchLimiter,
  strictLimiter,
  adminLimiter,
  createIPWhitelist,
  createDynamicLimiter,
  logRateLimitExceeded
};

