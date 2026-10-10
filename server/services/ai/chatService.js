/**
 * 观鸟 AI 多场景对话
 */

const OpenAIProvider = require('./openaiProvider');

const MODE_PROMPTS = {
  general:
    '你是 KBird 观鸟助手。可回答认鸟、观鸟点、鸟类知识、记录整理等问题。回答简洁、务实，优先中文；涉及安全与法规时提醒遵守当地规定与观鸟礼仪。不确定时说明依据。',
  identify:
    '你是鸟类识别助手。用户可能上传过照片并得到识别结果，也可能继续追问特征、易混淆种、季节与分布。回答时结合已给出的识别上下文，不要编造未提及的细节；不确定时说明还需要哪些照片或信息。',
  spots:
    '你是观鸟点推荐助手。根据用户给出的地区、季节、目标鸟种或交通条件，推荐合适的观鸟点与路线思路，并说明生境、时段与注意事项。优先中国大陆语境；若信息不足先追问关键条件。不编造具体门禁或收费，提示用户自行核实最新情况。',
  knowledge:
    '你是鸟类知识讲解助手。用通俗但准确的中文解释分类、形态、习性、迁徙、鸣声、保护等级与观鸟礼仪。可举例，但标注不确定处；避免把传闻说成定论。',
};

const MODE_STARTERS = {
  general: '你好，我是观鸟助手。可以问认鸟、观鸟点推荐或鸟类知识。',
  identify: '可以上传照片识别，或描述外形/鸣声/地点，我来帮你缩小范围。',
  spots: '告诉我城市/季节/想看的鸟或交通方式，我来推荐观鸟点思路。',
  knowledge: '可以问分类、习性、迁徙、保护等级或观鸟礼仪等知识问题。',
};

class ChatService {
  constructor() {
    this.openaiProvider = new OpenAIProvider();
  }

  getSystemPrompt(mode) {
    return MODE_PROMPTS[mode] || MODE_PROMPTS.general;
  }

  getStarter(mode) {
    return MODE_STARTERS[mode] || MODE_STARTERS.general;
  }

  isChatAvailable() {
    return this.openaiProvider.isAvailable();
  }

  ensureChatReady() {
    if (!this.isChatAvailable()) {
      const err = new Error('文字对话需要配置 OPENAI_API_KEY（兼容接口即可）');
      err.statusCode = 503;
      err.code = 'AI_PROVIDER_NOT_CONFIGURED';
      throw err;
    }
  }

  chatOptions(mode, extra = {}) {
    return {
      systemPrompt: this.getSystemPrompt(mode),
      temperature: mode === 'knowledge' ? 0.35 : 0.45,
      ...(extra.thinking ? { thinking: extra.thinking } : {}),
    };
  }

  async reply({ mode = 'general', messages = [], thinking } = {}) {
    this.ensureChatReady();
    return this.openaiProvider.chat(messages, this.chatOptions(mode, { thinking }));
  }

  /** @returns {AsyncGenerator} */
  replyStream({ mode = 'general', messages = [], thinking } = {}) {
    this.ensureChatReady();
    return this.openaiProvider.chatStream(messages, this.chatOptions(mode, { thinking }));
  }

  buildTitleFromMessage(text, mode) {
    const raw = String(text || '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!raw) {
      const labels = {
        general: '综合对话',
        identify: '识别对话',
        spots: '观鸟点推荐',
        knowledge: '鸟类知识',
      };
      return labels[mode] || '新对话';
    }
    return raw.slice(0, 36) + (raw.length > 36 ? '…' : '');
  }
}

module.exports = new ChatService();
module.exports.MODE_PROMPTS = MODE_PROMPTS;
module.exports.MODE_STARTERS = MODE_STARTERS;
