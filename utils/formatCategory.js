// 格式化鸟类分类信息的工具函数

/**
 * 格式化分类信息，添加分隔符提高可读性
 * @param {string} category - 原始分类字符串，如 "雀形目长尾山雀科长尾山雀属"
 * @param {string} separator - 分隔符，默认为 " > "
 * @returns {string} 格式化后的分类字符串，如 "雀形目 > 长尾山雀科 > 长尾山雀属"
 */
export const formatCategory = (category, separator = ' > ') => {
  if (!category) return '';
  
  // 如果已经包含分隔符，直接返回
  if (category.includes(separator)) {
    return category;
  }
  
  // 常见的分类层级关键词
  const levelKeywords = ['目', '科', '属', '种'];
  
  // 按关键词分割分类字符串
  let formatted = category;
  
  // 在"目"、"科"、"属"后面添加分隔符
  levelKeywords.forEach(keyword => {
    const regex = new RegExp(`(${keyword})`, 'g');
    formatted = formatted.replace(regex, `$1${separator}`);
  });
  
  // 移除末尾的分隔符
  formatted = formatted.replace(new RegExp(`${separator}$`), '');
  
  return formatted;
};

/**
 * 解析分类信息为对象
 * @param {string} category - 分类字符串
 * @returns {object} 包含各层级的对象
 */
export const parseCategory = (category) => {
  if (!category) return { order: '', family: '', genus: '', species: '' };
  
  // 检查是否是新格式（包含 " > " 分隔符）
  if (category.includes(' > ')) {
    const parts = category.split(' > ');
    return {
      order: parts[0] || '',
      family: parts[1] || '',
      genus: parts[2] || '',
      species: parts[3] || ''
    };
  }
  
  // 旧格式：使用正则表达式分割
  const parts = category.split(/[目科属种]/);
  const levels = category.match(/[目科属种]/g) || [];
  
  return {
    order: parts[0] + (levels[0] || ''),
    family: parts[1] + (levels[1] || ''),
    genus: parts[2] + (levels[2] || ''),
    species: parts[3] + (levels[3] || '')
  };
};

/**
 * 获取分类的简短显示（只显示科和属）
 * @param {string} category - 分类字符串
 * @returns {string} 简短分类，如 "长尾山雀科 > 长尾山雀属"
 */
export const getShortCategory = (category) => {
  if (!category) return '';
  
  const parsed = parseCategory(category);
  const parts = [];
  
  if (parsed.family) parts.push(parsed.family);
  if (parsed.genus) parts.push(parsed.genus);
  
  return parts.join(' > ');
};

/**
 * 获取分类的层级标签
 * @param {string} category - 分类字符串
 * @returns {array} 层级标签数组
 */
export const getCategoryLabels = (category) => {
  if (!category) return [];
  
  const parsed = parseCategory(category);
  const labels = [];
  
  if (parsed.order) labels.push({ level: '目', name: parsed.order, color: 'var(--color-danger)'});
  if (parsed.family) labels.push({ level: '科', name: parsed.family, color: 'var(--color-lake)'});
  if (parsed.genus) labels.push({ level: '属', name: parsed.genus, color: 'var(--color-success)'});
  if (parsed.species) labels.push({ level: '种', name: parsed.species, color: 'var(--color-warning)'});
  
  return labels;
};













