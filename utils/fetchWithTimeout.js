/**
 * 带超时的 fetch 工具函数
 * 防止网络请求无限挂起
 */

/**
 * 带超时的 fetch 请求
 * @param {string} url - 请求URL
 * @param {object} options - fetch选项
 * @param {number} timeout - 超时时间（毫秒），默认30秒
 * @returns {Promise<Response>}
 */
export const fetchWithTimeout = async (url, options = {}, timeout = 30000) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('请求超时，请检查网络连接');
    }
    throw error;
  }
};

/**
 * 带超时和重试的 fetch 请求
 * @param {string} url - 请求URL
 * @param {object} options - fetch选项
 * @param {number} timeout - 超时时间（毫秒），默认30秒
 * @param {number} maxRetries - 最大重试次数，默认2次
 * @returns {Promise<Response>}
 */
export const fetchWithTimeoutAndRetry = async (
  url,
  options = {},
  timeout = 30000,
  maxRetries = 2
) => {
  let lastError;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fetchWithTimeout(url, options, timeout);
    } catch (error) {
      lastError = error;
      
      // 如果是最后一次尝试，抛出错误
      if (attempt === maxRetries) {
        break;
      }
      
      // 等待一段时间后重试（指数退避）
      const delay = Math.min(1000 * Math.pow(2, attempt), 5000);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
};

export default fetchWithTimeout;
