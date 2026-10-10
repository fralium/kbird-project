const express = require('express');
const path = require('path');
const cors = require('cors');
require('dotenv').config();
const connectDB = require('./config/db');
const { validateRequiredEnv } = require('./config/validateEnv');
const { ensureDataDirs, getActiveUploadsRoot, getDataRoot } = require('./config/dataPaths');
const { isDevelopment } = require('./utils/devLogger');

const dataDirs = ensureDataDirs();
if (isDevelopment) {
  console.log(`[KBird] 个人数据根: ${dataDirs.dataRoot}`);
  console.log(`[KBird] uploads: ${dataDirs.uploadsRoot}`);
}

// 导入优化中间件
const { cacheMiddleware, clearCache } = require('./middleware/cache');
const compressionMiddleware = require('./middleware/compression');
const { requestLogger, errorLogger } = require('./middleware/logger');
const { apiResponseSanitizer } = require('./middleware/responseSanitizer');
const { requestContextMiddleware } = require('./middleware/requestContext');

// 导入安全中间件
const { 
  loginLimiter, 
  registerLimiter, 
  apiLimiter, 
  uploadLimiter, 
  draftLimiter,
  searchLimiter,
  authLimiter,
  strictLimiter, 
  adminLimiter,
  logRateLimitExceeded 
} = require('./middleware/rateLimiter');
const { globalErrorHandler, handleNotFound } = require('./middleware/errorHandler');

// 环境变量校验（缺少关键配置时直接失败）
validateRequiredEnv();

// 连接数据库后静默完成默认就绪（管理员 / 鸟种种子），无需强制 /init
connectDB()
  .then(() => {
    const { ensureDefaultSetupOnce } = require('./utils/bootstrapDefaults');
    return ensureDefaultSetupOnce();
  })
  .catch((err) => {
    console.error('[bootstrap] startup setup failed:', err?.message || err);
  });

const app = express();

// 反代部署时需要正确识别客户端 IP（限流依赖）
if (process.env.TRUST_PROXY === 'true' || process.env.TRUST_PROXY === '1') {
  app.set('trust proxy', 1);
} else if (process.env.TRUST_PROXY) {
  app.set('trust proxy', process.env.TRUST_PROXY);
}

// CORS：生产环境仅白名单（localhost + CORS_ORIGINS），开发保留局域网 :13080 宽松匹配
const isProduction = process.env.NODE_ENV === 'production';
const corsExtra = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const corsOrigins = [
  'http://localhost:13080',
  'http://127.0.0.1:13080',
  ...(isProduction ? [] : [/^http:\/\/.*:13080$/]),
  ...corsExtra,
];

app.use(cors({
  origin: corsOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'x-setup-token',
    'Cache-Control',
    'Pragma',
    'Expires',
  ]
}));

app.use(compressionMiddleware); // 响应压缩
app.use(requestContextMiddleware); // requestId + 请求上下文
app.use(requestLogger); // 请求日志
app.use(express.json({ limit: '50mb' })); // 个人档案含媒体合并恢复
app.use(express.urlencoded({ extended: false, limit: '50mb' }));
app.use(apiResponseSanitizer); // 统一错误响应收敛（生产环境隐藏内部细节）

// 应用限流和错误日志
app.use('/api', apiLimiter);
app.use(logRateLimitExceeded);

// 静态文件：仅公开 bird 等 active 上传；项目文件走鉴权下载接口
app.use(
  '/uploads/active',
  express.static(getActiveUploadsRoot(), {
    fallthrough: false,
  })
);

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

// 特殊路由限流（必须在对应路由注册前）
app.use('/api/users/login', loginLimiter); // 登录限流
app.use('/api/users/register', registerLimiter); // 注册限流
app.use('/api/birds/search', searchLimiter); // 搜索限流
app.use('/api/birds/*/images', uploadLimiter); // 文件上传限流
app.use('/api/birds/*/calls', uploadLimiter); // 鸣叫上传限流
app.use('/api/users/avatar', uploadLimiter);
app.use('/api/ai/identify', uploadLimiter);
app.use('/api/ai/identify/batch', uploadLimiter);
app.use('/api/ai/draft', draftLimiter);
app.use('/api/ai/conversations', draftLimiter);
app.use('/api/personal/projects', (req, res, next) => {
  // 仅限制项目文件上传，避免误伤项目列表/详情
  if (req.method === 'POST' && /\/upload\/?$/.test(req.path)) {
    return uploadLimiter(req, res, next);
  }
  return next();
});

// API路由 - 应用缓存和特定限流
app.use('/api/birds', cacheMiddleware(300), require('./routes/birdRoutes')); // 5分钟缓存
app.use('/api/users', authLimiter, require('./routes/userRoutes')); // 认证限流
app.use('/api/records', cacheMiddleware(180), require('./routes/recordRoutes')); // 新的Record API
// 地点API缓存 - 开发环境使用短缓存，生产环境使用长缓存
const locationCacheTime = isDevelopment ? 60 : 600; // 开发环境1分钟，生产环境10分钟
app.use('/api/locations', cacheMiddleware(locationCacheTime), require('./routes/locationRoutes'));
app.use('/api/region-lists', require('./routes/regionBirdListRoutes')); // 清单常更新，不走列表缓存
app.use('/api/leaderboard', cacheMiddleware(300), require('./routes/leaderboardRoutes')); // 5分钟缓存
app.use('/api/admin', adminLimiter, require('./routes/adminRoutes')); // 管理员限流
app.use('/api/reports', strictLimiter, require('./routes/reportRoutes')); // 严格限流
app.use('/api/upload', uploadLimiter, require('./routes/uploadRoutes')); // 文件上传路由
app.use('/api/personal/checklist', require('./routes/personalChecklistRoutes')); // 个人清单路由
app.use('/api/personal/stats', require('./routes/personalStatsRoutes')); // 个人统计路由
app.use('/api/personal/backup', require('./routes/personalBackupRoutes')); // 个人备份路由
app.use('/api/personal/photos', require('./routes/personalPhotoRoutes')); // 个人照片路由
app.use('/api/personal/import', require('./routes/personalImportRoutes')); // 个人导入路由
app.use('/api/personal/export', require('./routes/personalExportRoutes')); // 个人导出（CBRC / eBird）
app.use('/api/personal/settings', require('./routes/userSettingsRoutes')); // 个人设置路由
app.use('/api/personal/setup-env', require('./routes/setupEnvRoutes')); // 本机 .env 服务与密钥（admin+localhost）
app.use('/api/personal/goals', require('./routes/personalGoalsRoutes')); // 观鸟目标路由
app.use('/api/personal/trip-preview', require('./routes/personalTripPreviewRoutes')); // 名录对照（不写入记录）
app.use('/api/personal/reports', require('./routes/personalReportRoutes')); // 个人报告路由
app.use('/api/personal/projects', require('./routes/personalProjectRoutes')); // 个人项目路由
app.use('/api/personal/plots', require('./routes/personalPlotRoutes')); // 自留地路由
app.use('/api/personal/folder-photos', require('./routes/personalFolderPhotosRoutes')); // 本机分类照片入库
app.use('/api/search', searchLimiter); // 全局搜索限流
app.use('/api/search', require('./routes/searchRoutes')); // 全局搜索路由
app.use('/api/ai', require('./routes/aiRoutes')); // AI识别路由
app.use('/api/tianditu', require('./routes/tiandituRoutes')); // 天地图地理编码路由
app.use('/api', require('./routes/initRoutes')); // 初始化路由

// 错误处理中间件
app.use(errorLogger);

// 404处理
app.use('*', handleNotFound);

// 全局错误处理中间件
app.use(globalErrorHandler);

// 服务器端口
const PORT = process.env.PORT || 13082;

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