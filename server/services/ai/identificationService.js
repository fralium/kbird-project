/**
 * AI识别服务
 * 统一管理不同的AI识别提供商
 */

const HHOAIProvider = require('./hhoProvider');
const OpenAIProvider = require('./openaiProvider');
const Bird = require('../../models/birdModel');
const Location = require('../../models/locationModel');
const { findActiveLocationByFlexibleName } = require('../../utils/locationName');

const createAiError = (message, code, statusCode = 400) => {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  return error;
};

class IdentificationService {
  constructor() {
    this.openaiProvider = new OpenAIProvider();
    // 初始化HHO提供商
    this.hhoProvider = new HHOAIProvider();
    
    // 默认优先OpenAI兼容提供商，其次HHO
    this.defaultProvider = this.openaiProvider.isAvailable()
      ? 'openai'
      : (this.hhoProvider.isAvailable() ? 'hho' : null);
  }

  /**
   * 识别鸟类
   * @param {Buffer} imageBuffer - 图片Buffer
   * @param {Object} options - 选项
   * @returns {Promise<Object>} 识别结果
   */
  async identify(imageBuffer, options = {}) {
    const provider = options.provider || this.defaultProvider;

    if (!provider) {
      throw createAiError(
        '未配置AI识别服务，请设置OPENAI_API_KEY或HHO_API_KEY环境变量',
        'AI_PROVIDER_NOT_CONFIGURED',
        503
      );
    }

    let result;
    
    // 调用对应的提供商
    switch (provider) {
      case 'openai':
        if (!this.openaiProvider.isAvailable()) {
          throw createAiError('OpenAI兼容API未配置', 'AI_PROVIDER_UNAVAILABLE', 503);
        }
        result = await this.openaiProvider.identify(imageBuffer, options);
        break;
      case 'hho':
        if (!this.hhoProvider.isAvailable()) {
          throw createAiError('HHO API未配置', 'AI_PROVIDER_UNAVAILABLE', 503);
        }
        result = await this.hhoProvider.identify(imageBuffer, options);
        break;
      default:
        throw createAiError(`不支持的AI提供商: ${provider}`, 'AI_PROVIDER_NOT_SUPPORTED', 400);
    }

    // 与本地数据库匹配
    if (result.species) {
      const matched = await this.matchWithDatabase(result);
      result.matchedBird = matched.bird;
      result.matchDetails = matched.details;
    }

    return result;
  }

  /**
   * 与本地数据库匹配
   * @param {Object} identificationResult - 识别结果
   * @returns {Promise<Object|null>} 匹配的鸟类信息
   */
  async matchWithDatabase(identificationResult) {
    const { species, candidates } = identificationResult;
    const selectedFields = '_id name scientificName description habitat distribution images category';

    // 1) 先用严格匹配，尽量避免误匹配
    const topByScientific = await this.findByScientificName(species, selectedFields);
    if (topByScientific) {
      return {
        bird: topByScientific,
        details: { source: 'top1', matchedBy: 'scientificName', matchedValue: species },
      };
    }

    const topByName = await this.findByName(species, selectedFields);
    if (topByName) {
      return {
        bird: topByName,
        details: { source: 'top1', matchedBy: 'name', matchedValue: species },
      };
    }

    // 如果精确匹配失败，尝试候选列表
    if (candidates && candidates.length > 0) {
      for (let i = 0; i < candidates.length; i += 1) {
        const candidate = candidates[i];
        const byScientific = await this.findByScientificName(candidate.scientificName || candidate.name, selectedFields);
        if (byScientific) {
          return {
            bird: byScientific,
            details: {
              source: `candidate#${i + 1}`,
              matchedBy: 'scientificName',
              matchedValue: candidate.scientificName || candidate.name,
            },
          };
        }

        const byName = await this.findByName(candidate.name, selectedFields);
        if (byName) {
          return {
            bird: byName,
            details: {
              source: `candidate#${i + 1}`,
              matchedBy: 'name',
              matchedValue: candidate.name,
            },
          };
        }
      }
    }

    return { bird: null, details: null };
  }

  normalizeText(value) {
    return (value || '').toString().trim();
  }

  async findByName(name, selectedFields) {
    const normalized = this.normalizeText(name);
    if (!normalized) return null;

    const escaped = normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const exactInsensitive = new RegExp(`^${escaped}$`, 'i');

    const bird = await Bird.findOne({
      $or: [
        { name: normalized },
        { name: exactInsensitive },
        { nameAliases: normalized },
        { nameAliases: exactInsensitive },
      ],
    }).select(selectedFields);

    return bird ? bird.toObject() : null;
  }

  async findByScientificName(scientificName, selectedFields) {
    const normalized = this.normalizeText(scientificName);
    if (!normalized) return null;

    const escaped = normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const exactInsensitive = new RegExp(`^${escaped}$`, 'i');

    const bird = await Bird.findOne({
      $or: [{ scientificName: normalized }, { scientificName: exactInsensitive }],
    }).select(selectedFields);

    return bird ? bird.toObject() : null;
  }

  /**
   * 把自由文本整理成观鸟记录草稿，并尽量对齐本地鸟种/地点名录。
   * 不写入数据库。
   */
  async draftFromText(text) {
    if (!this.openaiProvider.isAvailable()) {
      throw createAiError(
        '文字草稿需要配置 OPENAI_API_KEY（兼容接口即可）',
        'AI_PROVIDER_NOT_CONFIGURED',
        503
      );
    }

    const drafted = await this.openaiProvider.draftFromText(text);
    const parsed = drafted?.parsed && typeof drafted.parsed === 'object' ? drafted.parsed : drafted;
    const usage = drafted?.usage || null;
    const warnings = [];
    const date = this.normalizeDate(parsed.date);
    if (parsed.date && !date) warnings.push('日期无法识别，请在详细记录里手填');

    const locationName = this.normalizeText(parsed.locationName);
    let location = null;
    if (locationName) {
      const doc = await findActiveLocationByFlexibleName(Location, locationName);
      const pair = doc?.coordinates?.coordinates;
      const lng = Number(pair?.[0]);
      const lat = Number(pair?.[1]);
      if (doc && Number.isFinite(lng) && Number.isFinite(lat) && !(lng === 0 && lat === 0)) {
        const address = doc.address || {};
        location = {
          name: doc.name,
          coordinates: [lng, lat],
          address: {
            province: address.province || '',
            city: address.city || '',
            district: address.district || '',
            detail: address.detail || address.street || '',
          },
        };
      } else {
        warnings.push(`地点「${locationName}」未在名录中匹配到有效坐标，请在详细记录里从名录选择`);
      }
    } else {
      warnings.push('原文没有明确地点，请在详细记录里选择');
    }

    const rawBirds = Array.isArray(parsed.birds) ? parsed.birds.slice(0, 40) : [];
    const birds = [];
    const birdPreview = [];
    for (const item of rawBirds) {
      const name = this.normalizeText(item?.name);
      const scientificName = this.normalizeText(item?.scientificName);
      if (!name && !scientificName) continue;
      const count = this.normalizeCount(item?.count);
      const notes = this.normalizeText(item?.notes);
      const matched = await this.matchWithDatabase({
        species: scientificName || name,
        candidates: name && scientificName ? [{ name, scientificName }] : [],
      });
      if (matched.bird?._id) {
        birds.push({
          bird: {
            _id: String(matched.bird._id),
            name: matched.bird.name,
            scientificName: matched.bird.scientificName || '',
          },
          birdId: String(matched.bird._id),
          notes,
          count,
          images: [],
        });
        birdPreview.push({
          name: name || scientificName,
          catalogName: matched.bird.name,
          count,
          notes,
          matched: true,
        });
      } else {
        warnings.push(`鸟种「${name || scientificName}」未在名录中匹配，请在详细记录里手动添加`);
        birdPreview.push({
          name: name || scientificName,
          catalogName: '',
          count,
          notes,
          matched: false,
        });
      }
    }

    if (birds.length === 0) {
      warnings.push('没有匹配到名录中的鸟种，填入后请手动添加');
    }

    const uncertainty = this.normalizeText(parsed.uncertainty);
    const noteParts = [this.normalizeText(parsed.notes)];
    if (uncertainty) noteParts.push(`待核对：${uncertainty}`);
    if (!location && locationName) noteParts.push(`原文地点：${locationName}`);
    const unmatchedNames = birdPreview.filter((item) => !item.matched).map((item) => item.name);
    if (unmatchedNames.length > 0) {
      noteParts.push(`未匹配鸟种：${unmatchedNames.join('、')}`);
    }

    return {
      form: {
        date: date || '',
        notes: noteParts.filter(Boolean).join('\n'),
        weather: this.normalizeText(parsed.weather).slice(0, 40),
        ...(location ? { location } : {}),
        effort: {
          startTime: this.normalizeTime(parsed.startTime),
          endTime: this.normalizeTime(parsed.endTime),
        },
        birds,
      },
      preview: {
        date: date || '',
        locationName,
        locationMatchedName: location?.name || '',
        birds: birdPreview,
        uncertainty,
      },
      warnings,
      usage,
    };
  }

  normalizeDate(value) {
    const text = this.normalizeText(value);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return '';
    const date = new Date(`${text}T00:00:00`);
    if (Number.isNaN(date.getTime())) return '';
    return text;
  }

  normalizeTime(value) {
    const text = this.normalizeText(value);
    return /^([01]\d|2[0-3]):[0-5]\d$/.test(text) ? text : '';
  }

  normalizeCount(value) {
    const num = Number(value);
    if (!Number.isFinite(num) || num <= 0) return 1;
    return Math.min(99999, Math.round(num));
  }

  /**
   * 获取可用的AI提供商列表
   * @returns {Array}
   */
  getAvailableProviders() {
    const providers = [];
    const openaiStatus = this.openaiProvider.getStatus();

    if (this.openaiProvider.isAvailable()) {
      providers.push({
        id: 'openai',
        name: openaiStatus.displayName || openaiStatus.vendorName || '兼容大模型',
        vendorId: openaiStatus.vendorId,
        vendorName: openaiStatus.vendorName,
        model: openaiStatus.model,
        roles: ['chat', 'identify'],
        status: openaiStatus,
      });
    }

    if (this.hhoProvider.isAvailable()) {
      const hhoStatus = this.hhoProvider.getStatus();
      providers.push({
        id: 'hho',
        name: 'HHO 懂鸟',
        vendorId: 'hho',
        vendorName: 'HHO 懂鸟',
        model: null,
        roles: ['identify'],
        status: hhoStatus,
      });
    }

    return providers;
  }

  /**
   * 获取服务状态（含厂商展示名，便于前端单独列出豆包/DeepSeek 等）
   * @returns {Object}
   */
  getStatus() {
    const openai = this.openaiProvider.getStatus();
    const hho = this.hhoProvider.getStatus();
    const availableProviders = this.getAvailableProviders();

    const models = [];
    if (openai.configured) {
      models.push({
        id: 'chat-openai',
        role: 'chat',
        roleLabel: '对话 / 知识 / 观鸟点',
        vendorId: openai.vendorId,
        vendorName: openai.vendorName,
        vendorBrand: openai.vendorBrand,
        model: openai.model,
        enabled: openai.enabled,
        displayName: openai.displayName,
      });
      models.push({
        id: 'identify-openai',
        role: 'identify',
        roleLabel: '认鸟（视觉）',
        vendorId: openai.vendorId,
        vendorName: openai.vendorName,
        vendorBrand: openai.vendorBrand,
        model: openai.model,
        enabled: openai.enabled,
        displayName: openai.displayName,
      });
    }
    if (hho.configured || hho.enabled) {
      models.push({
        id: 'identify-hho',
        role: 'identify',
        roleLabel: '认鸟（专用）',
        vendorId: 'hho',
        vendorName: 'HHO 懂鸟',
        vendorBrand: 'HHO',
        model: null,
        enabled: !!hho.enabled,
        displayName: hho.enabled ? 'HHO 懂鸟' : 'HHO 懂鸟（未配置）',
      });
    }

    return {
      defaultProvider: this.defaultProvider,
      availableProviders,
      models,
      openai,
      hho,
    };
  }
}

module.exports = new IdentificationService();
