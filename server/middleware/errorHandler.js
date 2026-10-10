const { isDevelopment } = require('../utils/devLogger');

// 自定义错误类
class AppError extends Error {
  constructor(message, statusCode, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = isOperational;
    
    Error.captureStackTrace(this, this.constructor);
  }
}

// 数据库错误处理
const handleDatabaseError = (error) => {
  let message = '数据库操作失败';
  let statusCode = 500;
  
  if (error.code === 11000) {
    // 重复键错误
    const field = Object.keys(error.keyValue)[0];
    message = `${field} 已存在，请使用其他值`;
    statusCode = 400;
  } else if (error.name === 'ValidationError') {
    // 验证错误
    const errors = Object.values(error.errors).map(err => err.message);
    message = `数据验证失败: ${errors.join(', ')}`;
    statusCode = 400;
  } else if (error.name === 'CastError') {
    // 类型转换错误
    message = `无效的 ${error.path}: ${error.value}`;
    statusCode = 400;
  }
  
  return new AppError(message, statusCode);
};

// JWT错误处理
const handleJWTError = () => {
  return new AppError('无效的token，请重新登录', 401);
};

const handleJWTExpiredError = () => {
  return new AppError('token已过期，请重新登录', 401);
};

// 文件操作错误处理
const handleFileError = (error) => {
  let message = '文件操作失败';
  let statusCode = 500;
  
  if (error.code === 'ENOENT') {
    message = '文件不存在';
    statusCode = 404;
  } else if (error.code === 'EACCES') {
    message = '文件访问权限不足';
    statusCode = 403;
  } else if (error.code === 'EMFILE' || error.code === 'ENFILE') {
    message = '文件描述符不足，请稍后重试';
    statusCode = 503;
  }
  
  return new AppError(message, statusCode);
};

// 网络错误处理
const handleNetworkError = (error) => {
  let message = '网络请求失败';
  let statusCode = 500;
  
  if (error.code === 'ECONNREFUSED') {
    message = '连接被拒绝';
    statusCode = 503;
  } else if (error.code === 'ETIMEDOUT') {
    message = '请求超时';
    statusCode = 504;
  } else if (error.code === 'ENOTFOUND') {
    message = '服务不可用';
    statusCode = 503;
  }
  
  return new AppError(message, statusCode);
};

// 发送错误响应给客户端
const sendErrorDev = (err, res) => {
  res.status(err.statusCode).json({
    success: false,
    error: err,
    message: err.message,
    stack: err.stack
  });
};

const sendErrorProd = (err, res) => {
  // 操作错误：发送消息给客户端
  if (err.isOperational) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message
    });
  } else {
    // 编程错误：不泄露错误详情
    console.error('ERROR 💥', err);
    
    res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
};

// 全局错误处理中间件
const globalErrorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';
  
  // 记录错误日志
  logError(err, req);
  
  if (isDevelopment) {
    sendErrorDev(err, res);
  } else {
    let error = { ...err };
    error.message = err.message;
    
    // 处理不同类型的错误
    if (error.name === 'CastError') error = handleDatabaseError(error);
    if (error.code === 11000) error = handleDatabaseError(error);
    if (error.name === 'ValidationError') error = handleDatabaseError(error);
    if (error.name === 'JsonWebTokenError') error = handleJWTError();
    if (error.name === 'TokenExpiredError') error = handleJWTExpiredError();
    if (error.code && error.code.startsWith('E')) error = handleFileError(error);
    
    sendErrorProd(error, res);
  }
};

// 错误日志记录
const logError = (err, req) => {
  const errorInfo = {
    timestamp: new Date().toISOString(),
    message: err.message,
    statusCode: err.statusCode,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: req.user?.id || 'anonymous'
  };
  
  // 在开发环境输出到控制台
  if (isDevelopment) {
    console.error('🚨 错误详情:', errorInfo);
  } else {
    // 在生产环境可以发送到日志服务
    console.error(JSON.stringify(errorInfo));
  }
};

// 404错误处理
const handleNotFound = (req, res, next) => {
  const err = new AppError(`无法找到 ${req.originalUrl}`, 404);
  next(err);
};

// 异步错误捕获包装器
const catchAsync = (fn) => {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
};

// 验证错误处理
const handleValidationError = (errors) => {
  const messages = errors.array().map(error => error.msg);
  return new AppError(`验证失败: ${messages.join(', ')}`, 400);
};

// 权限错误处理
const handlePermissionError = (message = '权限不足') => {
  return new AppError(message, 403);
};

// 资源不存在错误处理
const handleResourceNotFound = (resource = '资源') => {
  return new AppError(`${resource}不存在`, 404);
};

// 重复资源错误处理
const handleDuplicateResource = (resource = '资源') => {
  return new AppError(`${resource}已存在`, 409);
};

module.exports = {
  AppError,
  globalErrorHandler,
  handleNotFound,
  catchAsync,
  handleValidationError,
  handlePermissionError,
  handleResourceNotFound,
  handleDuplicateResource,
  handleDatabaseError,
  handleJWTError,
  handleJWTExpiredError,
  handleFileError,
  handleNetworkError,
  logError
};





