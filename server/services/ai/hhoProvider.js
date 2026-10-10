/**
 * HHO AI 鸟类识别服务提供商
 * 参考文档: https://ai.open.hhodata.com/#introduce
 * 
 * HHO与懂鸟联合推出的鸟类识别AI算法：
 * - 识别超过10000种鸟类
 * - Top1识别准确率85%，Top5识别准确率96%
 * - 还能识别超过18000种兽类、两栖类和爬行动物
 * - 返回鸟类名称及百科信息
 */

const axios = require('axios');
const FormData = require('form-data');

class HHOAIProvider {
  constructor() {
    // HHO API配置（从环境变量读取）
    this.apiKey = process.env.HHO_API_KEY || '';
    this.apiUrl = process.env.HHO_API_URL || 'https://api.open.hhodata.com/v1/bird/identify';
    this.enabled = !!this.apiKey; // 只有配置了API Key才启用
  }

  /**
   * 识别鸟类
   * @param {Buffer} imageBuffer - 图片Buffer
   * @param {Object} options - 可选参数
   * @returns {Promise<Object>} 识别结果
   */
  async identify(imageBuffer, options = {}) {
    if (!this.enabled) {
      throw new Error('HHO API未配置，请在环境变量中设置HHO_API_KEY');
    }

    try {
      // 创建FormData
      const formData = new FormData();
      formData.append('image', imageBuffer, {
        filename: options.filename || 'bird.jpg',
        contentType: options.contentType || 'image/jpeg',
      });

      // 调用HHO API
      const response = await axios.post(this.apiUrl, formData, {
        headers: {
          ...formData.getHeaders(),
          'Authorization': `Bearer ${this.apiKey}`,
        },
        timeout: 30000, // 30秒超时
      });

      // 解析HHO API响应
      return this.parseResponse(response.data);
    } catch (error) {
      console.error('HHO API调用失败:', error);
      if (error.response) {
        throw new Error(`HHO API错误: ${error.response.status} - ${error.response.data?.message || error.message}`);
      }
      throw new Error(`HHO API调用失败: ${error.message}`);
    }
  }

  /**
   * 解析HHO API响应
   * @param {Object} apiResponse - API原始响应
   * @returns {Object} 标准化识别结果
   */
  parseResponse(apiResponse) {
    // 根据HHO API实际响应格式解析
    // 这里需要根据实际API文档调整
    const result = {
      success: true,
      provider: 'hho',
      timestamp: new Date(),
      species: null,
      confidence: 0,
      candidates: [],
      encyclopedia: null,
      usage: {
        model: apiResponse?.model || apiResponse?.data?.model || null,
        promptTokens: null,
        completionTokens: null,
        totalTokens: null,
      },
    };

    // 假设HHO API返回格式（需要根据实际文档调整）
    if (apiResponse.data) {
      const data = apiResponse.data;
      
      // Top1结果
      if (data.result && data.result.length > 0) {
        const top1 = data.result[0];
        result.species = top1.name || top1.species;
        result.confidence = top1.confidence || top1.score || 0;
        
        // Top5候选结果
        result.candidates = data.result.slice(0, 5).map(item => ({
          name: item.name || item.species,
          scientificName: item.scientificName || item.scientific_name,
          confidence: item.confidence || item.score || 0,
        }));
      }

      // 百科信息
      if (data.encyclopedia || data.info) {
        result.encyclopedia = data.encyclopedia || data.info;
      }
    }

    return result;
  }

  /**
   * 检查API是否可用
   * @returns {boolean}
   */
  isAvailable() {
    return this.enabled;
  }

  /**
   * 获取API状态信息
   * @returns {Object}
   */
  getStatus() {
    return {
      provider: 'hho',
      enabled: this.enabled,
      configured: !!this.apiKey,
      apiUrl: this.apiUrl,
    };
  }
}

module.exports = HHOAIProvider;
