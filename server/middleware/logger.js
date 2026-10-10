const winston = require('winston');
const path = require('path');
const fs = require('fs');
const { recordApiMetric } = require('./apiMetrics');

const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const fileRotateOpts = {
  maxsize: 10 * 1024 * 1024, // 10MB
  maxFiles: 5,
  tailable: true,
};

// 创建日志记录器
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'kbird-api' },
  transports: [
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      ...fileRotateOpts,
    }),
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      ...fileRotateOpts,
    }),
  ],
});

// 如果不是生产环境，也输出到控制台
if (process.env.NODE_ENV !== 'production') {
  logger.add(
    new winston.transports.Console({
      format: winston.format.simple(),
    })
  );
}

// API请求日志中间件
const requestLogger = (req, res, next) => {
  const start = Date.now();
  let metricsRecorded = false;

  // 记录请求开始
  logger.info('API请求开始', {
    requestId: req.requestId,
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString(),
  });

  // 拦截响应
  const originalSend = res.send;
  res.send = function (data) {
    const duration = Date.now() - start;

    // 记录响应
    logger.info('API请求完成', {
      requestId: req.requestId,
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      responseSize: data ? data.length : 0,
      timestamp: new Date().toISOString(),
    });

    return originalSend.call(this, data);
  };

  res.on('finish', () => {
    if (metricsRecorded) return;
    metricsRecorded = true;
    const duration = Date.now() - start;
    recordApiMetric(req, res.statusCode, duration);
  });

  next();
};

// 错误日志中间件
const errorLogger = (err, req, res, next) => {
  logger.error('API错误', {
    requestId: req.requestId,
    error: err.message,
    stack: err.stack,
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    timestamp: new Date().toISOString(),
  });

  next(err);
};

module.exports = {
  logger,
  requestLogger,
  errorLogger,
};
