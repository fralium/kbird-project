const AI_ERROR_MESSAGES = {
  NETWORK_ERROR: '网络连接失败，请确认服务已启动后重试',
  UNAUTHORIZED: '登录状态无效，请重新登录后再试',
  TOKEN_EXPIRED: '登录状态已过期，请重新登录',
  MISSING_IMAGE_FILE: '请先上传一张鸟类图片',
  MISSING_IMAGE_FILES: '请至少上传一张图片',
  FILE_TOO_LARGE: '图片大小超过限制，请控制在 2MB 以内',
  UNSUPPORTED_IMAGE_FORMAT: '图片格式不支持，请使用 PNG/JPG/JPEG/BMP',
  AI_PROVIDER_NOT_CONFIGURED: 'AI 服务未配置，请联系管理员设置密钥',
  AI_IDENTIFY_PROXY_FAILED: 'AI 识别服务暂时不可用，请稍后重试',
  AI_IDENTIFY_BATCH_PROXY_FAILED: '批量识别服务暂时不可用，请稍后重试',
  AI_STATUS_PROXY_FAILED: 'AI 状态检查失败，请稍后重试',
  AI_OPERATION_FAILED: 'AI 服务处理失败，请稍后重试',
};

export function getReadableAiError(code, fallbackMessage) {
  if (code && AI_ERROR_MESSAGES[code]) {
    return AI_ERROR_MESSAGES[code];
  }
  return fallbackMessage || '识别失败，请稍后重试';
}
