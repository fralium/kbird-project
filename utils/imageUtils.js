/**
 * 图片路径处理工具函数
 * 确保所有图片路径都使用统一的格式
 */

/**
 * 标准化图片路径
 * @param {string} url - 原始图片URL
 * @returns {string} - 标准化后的URL
 */
export function normalizeImageUrl(url) {
  if (!url) return '';
  
  // 如果已经是完整的uploads路径，直接返回
  if (url.startsWith('/uploads/')) {
    return url;
  }
  
  // 如果是相对路径，添加uploads/active前缀
  if (url.startsWith('uploads/') || url.startsWith('./uploads/')) {
    return `/${url}`;
  }
  
  // 如果是文件名，添加完整路径
  return `/uploads/active/${url}`;
}

/**
 * 获取图片的完整URL
 * @param {string} url - 图片URL
 * @param {string} baseUrl - 基础URL（可选）
 * @returns {string} - 完整的图片URL
 */
export function getFullImageUrl(url, baseUrl = '') {
  const normalizedUrl = normalizeImageUrl(url);
  
  if (typeof window !== 'undefined') {
    // 客户端环境
    return normalizedUrl.startsWith('http') ? normalizedUrl : `${window.location.origin}${normalizedUrl}`;
  }
  
  // 服务端环境
  return baseUrl ? `${baseUrl}${normalizedUrl}` : normalizedUrl;
}

/**
 * 检查图片URL是否有效
 * @param {string} url - 图片URL
 * @returns {boolean} - 是否有效
 */
export function isValidImageUrl(url) {
  if (!url) return false;
  
  // 检查是否是无效标记
  if (url.startsWith('INVALID_')) return false;
  
  // 检查是否是有效的图片路径
  const validPatterns = [
    /^\/uploads\/active\/.+\.(jpg|jpeg|png|gif|webp)$/i,
    /^\/uploads\/.+\.(jpg|jpeg|png|gif|webp)$/i
  ];
  
  return validPatterns.some(pattern => pattern.test(url));
}

/**
 * 从图片URL中提取文件名
 * @param {string} url - 图片URL
 * @returns {string} - 文件名
 */
export function getImageFileName(url) {
  if (!url) return '';
  return url.split('/').pop() || '';
}

/**
 * 生成图片的唯一标识
 * @param {string} url - 图片URL
 * @param {number} index - 图片索引
 * @returns {string} - 唯一标识
 */
export function getImageKey(url, index) {
  const fileName = getImageFileName(url);
  return fileName || `image-${index}`;
}






