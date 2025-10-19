const express = require('express');
const cors = require('cors');
require('dotenv').config();
const connectDB = require('./config/db');

// 导入优化中间件
const { cacheMiddleware, clearCache } = require('./middleware/cache');
const compressionMiddleware = require('./middleware/compression');
const { requestLogger, errorLogger } = require('./middleware/logger');

// 导入安全中间件
const { 
  loginLimiter, 
  registerLimiter, 
  apiLimiter, 
  uploadLimiter, 
  searchLimiter,
  authLimiter,
  strictLimiter, 
  adminLimiter,
  logRateLimitExceeded 
} = require('./middleware/rateLimiter');
const { globalErrorHandler, handleNotFound } = require('./middleware/errorHandler');

// 连接数据库
connectDB();

const app = express();

// 基础中间件
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000', /^http:\/\/.*:3000$/],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// 设置字符编码
app.use((req, res, next) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  next();
});

app.use(compressionMiddleware); // 响应压缩
app.use(requestLogger); // 请求日志
app.use(express.json({ limit: '10mb' })); // 增加JSON限制
app.use(express.urlencoded({ extended: false, limit: '10mb' }));

// 应用限流和错误日志
app.use('/api', apiLimiter);
app.use(logRateLimitExceeded);

// 静态文件 - 支持uploads目录下的所有子目录
app.use('/uploads', express.static('uploads'));

// 根路由
app.get('/', (req, res) => {
  res.json({
    message: 'KBird API Server',
    version: '1.0.0',
    endpoints: {
      birds: '/api/birds',
      users: '/api/users',
      records: '/api/records'
    }
  });
});

// API路由 - 应用缓存和特定限流
app.use('/api/birds', cacheMiddleware(300), require('./routes/birdRoutes')); // 5分钟缓存
app.use('/api/users', authLimiter, require('./routes/userRoutes')); // 认证限流
app.use('/api/records', cacheMiddleware(180), require('./routes/recordRoutes')); // 新的Record API
// 地点API缓存 - 开发环境使用短缓存，生产环境使用长缓存
const locationCacheTime = process.env.NODE_ENV === 'development' ? 60 : 600; // 开发环境1分钟，生产环境10分钟
app.use('/api/locations', cacheMiddleware(locationCacheTime), require('./routes/locationRoutes'));
app.use('/api/leaderboard', cacheMiddleware(300), require('./routes/leaderboardRoutes')); // 5分钟缓存
app.use('/api/admin', adminLimiter, require('./routes/adminRoutes')); // 管理员限流
app.use('/api/reports', strictLimiter, require('./routes/reportRoutes')); // 严格限流
app.use('/api/upload', uploadLimiter, require('./routes/uploadRoutes')); // 文件上传路由
app.use('/api', require('./routes/initRoutes')); // 初始化路由

// 特殊路由限流
app.use('/api/users/login', loginLimiter); // 登录限流
app.use('/api/users/register', registerLimiter); // 注册限流
app.use('/api/birds/search', searchLimiter); // 搜索限流
app.use('/api/birds/*/images', uploadLimiter); // 文件上传限流

// 错误处理中间件
app.use(errorLogger);

// 404处理
app.use('*', handleNotFound);

// 全局错误处理中间件
app.use(globalErrorHandler);

// 服务器端口
const PORT = process.env.PORT || 3002;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 KBird API服务器运行在端口 ${PORT}`);
  console.log(`📊 性能优化已启用:`);
  console.log(`   - 响应压缩: ✅`);
  console.log(`   - API缓存: ✅`);
  console.log(`   - 请求限流: ✅`);
  console.log(`   - 请求日志: ✅`);
  console.log(`   - 数据库索引: ✅`);
  console.log(`🛡️ 安全功能已启用:`);
  console.log(`   - 输入验证: ✅`);
  console.log(`   - 文件上传安全检查: ✅`);
  console.log(`   - 错误处理: ✅`);
  console.log(`   - 生产环境日志保护: ✅`);
});