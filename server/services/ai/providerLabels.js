/**
 * 从兼容接口的 baseUrl / model 推断厂商展示名（豆包、DeepSeek 等）
 */

function resolveCompatibleVendor(baseUrl = '', model = '') {
  const u = String(baseUrl || '').toLowerCase();
  const m = String(model || '').toLowerCase();

  if (u.includes('deepseek') || m.includes('deepseek')) {
    return {
      vendorId: 'deepseek',
      vendorName: 'DeepSeek',
      vendorBrand: 'DeepSeek',
    };
  }

  if (
    u.includes('volces.com') ||
    u.includes('volcengine') ||
    (u.includes('ark') && u.includes('/api/v3')) ||
    m.includes('doubao') ||
    /^ep-/.test(m)
  ) {
    return {
      vendorId: 'doubao',
      vendorName: '豆包',
      vendorBrand: '火山方舟',
    };
  }

  if (u.includes('moonshot') || m.includes('moonshot') || m.includes('kimi')) {
    return {
      vendorId: 'kimi',
      vendorName: 'Kimi',
      vendorBrand: '月之暗面',
    };
  }

  if (u.includes('dashscope') || u.includes('aliyuncs') || m.includes('qwen')) {
    return {
      vendorId: 'qwen',
      vendorName: '通义千问',
      vendorBrand: '阿里云',
    };
  }

  if (u.includes('bigmodel.cn') || m.includes('glm')) {
    return {
      vendorId: 'zhipu',
      vendorName: '智谱 GLM',
      vendorBrand: '智谱',
    };
  }

  if (u.includes('openai.com') || m.startsWith('gpt-') || m.includes('o1')) {
    return {
      vendorId: 'openai',
      vendorName: 'OpenAI',
      vendorBrand: 'OpenAI',
    };
  }

  return {
    vendorId: 'compatible',
    vendorName: '兼容接口',
    vendorBrand: '自定义',
  };
}

module.exports = {
  resolveCompatibleVendor,
};
