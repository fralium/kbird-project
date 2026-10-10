const defaultCodeByStatus = (status) => {
  if (status >= 500) return 'INTERNAL_ERROR';
  if (status === 404) return 'NOT_FOUND';
  if (status === 403) return 'FORBIDDEN';
  if (status === 401) return 'UNAUTHORIZED';
  if (status === 409) return 'DUPLICATE_RESOURCE';
  if (status === 400) return 'BAD_REQUEST';
  return 'REQUEST_FAILED';
};

const classifyKnownError = (error) => {
  if (!error) return null;

  if (error.name === 'CastError') {
    return {
      status: 400,
      code: 'INVALID_ID',
      message: '请求参数格式无效',
    };
  }

  if (error.name === 'ValidationError') {
    const details = Object.values(error.errors || {})
      .map((item) => item?.message)
      .filter(Boolean);
    return {
      status: 400,
      code: 'VALIDATION_ERROR',
      message: details.length ? details.join('；') : '数据验证失败',
    };
  }

  if (error.code === 11000) {
    return {
      status: 409,
      code: 'DUPLICATE_RESOURCE',
      message: '资源已存在',
    };
  }

  if (error.name === 'JsonWebTokenError') {
    return {
      status: 401,
      code: 'UNAUTHORIZED',
      message: '登录状态无效，请重新登录',
    };
  }

  if (error.name === 'TokenExpiredError') {
    return {
      status: 401,
      code: 'TOKEN_EXPIRED',
      message: '登录状态已过期，请重新登录',
    };
  }

  if (error.name === 'MulterError') {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return {
        status: 400,
        code: 'FILE_TOO_LARGE',
        message: '上传文件过大，请选择更小的文件',
      };
    }
    return {
      status: 400,
      code: 'UPLOAD_VALIDATION_FAILED',
      message: '上传文件校验失败',
    };
  }

  if (error.code === 'UNSUPPORTED_IMAGE_FORMAT') {
    return {
      status: 400,
      code: 'UNSUPPORTED_IMAGE_FORMAT',
      message: '不支持的图片格式，支持: PNG、JPG、JPEG、BMP',
    };
  }

  return null;
};

const sendControllerError = (
  res,
  error,
  {
    defaultMessage = '服务器错误',
    defaultCode,
    fallbackStatus = 500,
  } = {}
) => {
  const known = classifyKnownError(error);
  const status =
    known?.status ||
    (Number.isInteger(error?.statusCode) && error.statusCode >= 400 && error.statusCode <= 599
      ? error.statusCode
      : fallbackStatus);

  const isServerError = status >= 500;
  const explicitCode =
    typeof error?.code === 'string' && error.code.trim() ? error.code.trim() : null;
  // 502/503/504 或业务已打好的 AI_* 错误码：把可读说明透给前端，避免只剩笼统「发送失败」
  const allowErrorMessage =
    Boolean(error?.publicMessage) ||
    status === 429 ||
    status === 502 ||
    status === 503 ||
    status === 504 ||
    (explicitCode && explicitCode.startsWith('AI_'));
  const message =
    known?.message ||
    (allowErrorMessage && error?.message) ||
    (!isServerError && error?.message) ||
    defaultMessage ||
    '请求处理失败';

  const code =
    known?.code ||
    explicitCode ||
    defaultCode ||
    defaultCodeByStatus(status);

  return res.status(status).json({
    success: false,
    message,
    code,
  });
};

module.exports = {
  sendControllerError,
};

