const { isDevelopment } = require('../utils/devLogger');

const defaultErrorCodeByStatus = (statusCode) => {
  if (statusCode >= 500) return 'INTERNAL_ERROR';
  if (statusCode === 404) return 'NOT_FOUND';
  if (statusCode === 403) return 'FORBIDDEN';
  if (statusCode === 401) return 'UNAUTHORIZED';
  if (statusCode === 400) return 'BAD_REQUEST';
  if (statusCode === 429) return 'RATE_LIMITED';
  return 'REQUEST_FAILED';
};

const sanitizeErrorPayload = (payload, statusCode) => {
  if (!payload || typeof payload !== 'object') return payload;

  const isErrorPayload = statusCode >= 400 || payload.success === false;
  if (!isErrorPayload) return payload;

  const nextPayload = { ...payload, success: false };
  const normalizedStatus = Number(statusCode) || 500;

  if (!nextPayload.code) {
    nextPayload.code = defaultErrorCodeByStatus(normalizedStatus);
  }

  if (!nextPayload.message) {
    nextPayload.message =
      normalizedStatus >= 500 ? '服务器内部错误' : '请求处理失败';
  }

  if (isDevelopment && nextPayload.error && !nextPayload.debugError) {
    nextPayload.debugError = String(nextPayload.error);
  }

  // 对外统一错误结构，避免把内部实现细节直接回传给前端
  delete nextPayload.error;
  delete nextPayload.stack;
  delete nextPayload.debug;
  if (normalizedStatus >= 500) {
    delete nextPayload.errors;
  }

  return nextPayload;
};

const apiResponseSanitizer = (req, res, next) => {
  const originalJson = res.json.bind(res);
  res.json = (payload) => {
    const sanitized = sanitizeErrorPayload(payload, res.statusCode);
    return originalJson(sanitized);
  };
  next();
};

module.exports = {
  apiResponseSanitizer,
};

