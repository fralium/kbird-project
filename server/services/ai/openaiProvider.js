/**
 * OpenAI-compatible bird identification provider.
 * Supports vendors with OpenAI chat completions API compatibility
 * (e.g. Volcengine Ark, OpenAI-compatible gateways).
 */

const axios = require('axios');
const { resolveCompatibleVendor } = require('./providerLabels');

class OpenAIProvider {
  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY || '';
    this.baseUrl = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
    this.model = process.env.OPENAI_MODEL || 'doubao-seed-2-0';
    this.enabled = !!this.apiKey;
    // 豆包等模型偶发 50s+；经 Next 代理后再叠加一点开销，60s 易误杀
    const chatTimeout = Number.parseInt(process.env.OPENAI_CHAT_TIMEOUT_MS || '', 10);
    this.chatTimeoutMs = Number.isFinite(chatTimeout) && chatTimeout >= 15000 ? chatTimeout : 120000;
    // 服务端默认不强制 thinking；前端可按次传入。OPENAI_THINKING 仅作全局兜底
    const thinkingRaw = process.env.OPENAI_THINKING;
    const thinking = String(thinkingRaw || '')
      .trim()
      .toLowerCase();
    this.thinkingType = ['enabled', 'disabled', 'auto'].includes(thinking) ? thinking : null;
  }

  /**
   * @param {object} payload
   * @param {string|null|undefined} overrideThinking 单次请求覆盖：enabled|disabled|auto
   */
  applyThinkingOptions(payload, overrideThinking) {
    const type = ['enabled', 'disabled', 'auto'].includes(overrideThinking)
      ? overrideThinking
      : this.thinkingType;
    if (!type) return payload;
    return { ...payload, thinking: { type } };
  }

  isAvailable() {
    return this.enabled;
  }

  getStatus() {
    const vendor = resolveCompatibleVendor(this.baseUrl, this.model);
    return {
      provider: 'openai',
      enabled: this.enabled,
      configured: !!this.apiKey,
      baseUrl: this.baseUrl,
      model: this.model,
      ...vendor,
      displayName: this.enabled
        ? `${vendor.vendorName} · ${this.model}`
        : `${vendor.vendorName}（未配置）`,
    };
  }

  async identify(imageBuffer, options = {}) {
    if (!this.enabled) {
      throw new Error('OpenAI兼容API未配置，请设置OPENAI_API_KEY');
    }

    const model = options.model || this.model;
    const mimeType = options.contentType || 'image/jpeg';
    const base64Image = imageBuffer.toString('base64');
    const imageUrl = `data:${mimeType};base64,${base64Image}`;

    const systemPrompt =
      '你是鸟类识别助手。请根据图片内容给出最可能的鸟种，尽量使用中文名，并提供学名、置信度与判据。';
    const userDescription = (options.userDescription || '').toString().trim();
    const userPrompt =
      '请识别图中鸟类，并只返回JSON，不要返回其它文本。JSON格式：' +
      '{"species":"中文名","scientificName":"学名","confidence":0.0,"candidates":[{"name":"中文名","scientificName":"学名","confidence":0.0}],"encyclopedia":"一句话简介","reasoning":"判定依据","keyFeatures":["关键特征1","关键特征2"],"lookalikes":[{"name":"易混淆种中文名","scientificName":"学名","difference":"区别点"}],"uncertainty":"不确定性说明","advice":"建议补拍角度或信息"}' +
      (userDescription ? `。补充描述如下（仅作辅助）：${userDescription}` : '');

    try {
      const response = await axios.post(
        `${this.baseUrl}/chat/completions`,
        {
          model,
          temperature: 0.2,
          messages: [
            { role: 'system', content: systemPrompt },
            {
              role: 'user',
              content: [
                { type: 'text', text: userPrompt },
                { type: 'image_url', image_url: { url: imageUrl } },
              ],
            },
          ],
        },
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 45000,
        }
      );

      return this.parseResponse(response.data, model);
    } catch (error) {
      if (error.response) {
        const msg = error.response.data?.error?.message || error.response.data?.message || error.message;
        throw new Error(`OpenAI兼容API错误: ${error.response.status} - ${msg}`);
      }
      throw new Error(`OpenAI兼容API调用失败: ${error.message}`);
    }
  }

  extractUsage(apiResponse, fallbackModel) {
    const usage = apiResponse?.usage || {};
    const promptTokens = this.toTokenCount(usage.prompt_tokens ?? usage.input_tokens);
    const completionTokens = this.toTokenCount(usage.completion_tokens ?? usage.output_tokens);
    let totalTokens = this.toTokenCount(usage.total_tokens);
    if (totalTokens == null && (promptTokens != null || completionTokens != null)) {
      totalTokens = (promptTokens || 0) + (completionTokens || 0);
    }
    return {
      model: apiResponse?.model || fallbackModel || null,
      promptTokens,
      completionTokens,
      totalTokens,
    };
  }

  toTokenCount(value) {
    const num = Number(value);
    if (!Number.isFinite(num) || num < 0) return null;
    return Math.round(num);
  }

  parseResponse(apiResponse, fallbackModel) {
    const content = apiResponse?.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('AI返回为空');
    }

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch {
      const match = content.match(/\{[\s\S]*\}/);
      parsed = match ? JSON.parse(match[0]) : null;
    }

    if (!parsed) {
      throw new Error('AI返回格式无效');
    }

    const inputCandidates = Array.isArray(parsed.candidates) ? parsed.candidates : [];
    const confidence = this.normalizeConfidence(parsed.confidence ?? inputCandidates[0]?.confidence ?? 0);
    const species = parsed.species || inputCandidates[0]?.name || null;
    const scientificName = parsed.scientificName || inputCandidates[0]?.scientificName || inputCandidates[0]?.scientific_name || null;

    const normalizedCandidates = inputCandidates.slice(0, 8).map((item) => ({
      name: item.name || item.species || null,
      scientificName: item.scientificName || item.scientific_name || null,
      confidence: this.normalizeConfidence(item.confidence ?? 0),
    })).filter((item) => item.name);

    // 确保主判定一定出现在候选列表首位，避免前端展示和大模型主判定不一致
    if (species) {
      const top = {
        name: species,
        scientificName,
        confidence,
      };
      const deduped = normalizedCandidates.filter((item) => {
        const sameName = (item.name || '').trim().toLowerCase() === (top.name || '').trim().toLowerCase();
        const sameSci = (item.scientificName || '').trim().toLowerCase() &&
          (item.scientificName || '').trim().toLowerCase() === (top.scientificName || '').trim().toLowerCase();
        return !sameName && !sameSci;
      });
      normalizedCandidates.splice(0, normalizedCandidates.length, top, ...deduped);
    }

    return {
      success: true,
      provider: 'openai',
      timestamp: new Date(),
      species,
      scientificName,
      confidence,
      candidates: normalizedCandidates.slice(0, 5),
      encyclopedia: parsed.encyclopedia || parsed.description || null,
      reasoning: parsed.reasoning || parsed.analysis || null,
      keyFeatures: Array.isArray(parsed.keyFeatures) ? parsed.keyFeatures : [],
      lookalikes: Array.isArray(parsed.lookalikes) ? parsed.lookalikes : [],
      uncertainty: parsed.uncertainty || null,
      advice: parsed.advice || parsed.suggestion || null,
      usage: this.extractUsage(apiResponse, fallbackModel),
      raw: parsed,
    };
  }

  buildChatMessages(messages, options = {}) {
    const systemPrompt =
      options.systemPrompt ||
      '你是 KBird 观鸟助手，回答简洁、务实，优先中文；不确定时说明依据与不确定性。';
    const history = Array.isArray(messages)
      ? messages
          .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && String(m.content || '').trim())
          .slice(-24)
          .map((m) => ({
            role: m.role,
            content: String(m.content).trim().slice(0, 8000),
          }))
      : [];
    return [{ role: 'system', content: systemPrompt }, ...history];
  }

  mapChatError(error) {
    if (error.response) {
      // stream 模式下 error.response.data 可能是可读流
      const data = error.response.data;
      let msg = error.message;
      if (data && typeof data === 'object' && !data.readable) {
        msg = data?.error?.message || data?.message || error.message;
      }
      return new Error(`OpenAI兼容API错误: ${error.response.status} - ${msg}`);
    }
    if (error.message && error.message.startsWith('AI返回')) return error;
    const timedOut =
      error.code === 'ECONNABORTED' ||
      error.code === 'ETIMEDOUT' ||
      /timeout/i.test(String(error.message || ''));
    if (timedOut) {
      const err = new Error(
        `大模型响应超时（>${Math.round(this.chatTimeoutMs / 1000)}s），请稍后重试`
      );
      err.statusCode = 504;
      err.code = 'AI_PROVIDER_TIMEOUT';
      return err;
    }
    return new Error(`OpenAI兼容API调用失败: ${error.message}`);
  }

  /**
   * 通用多轮文本对话（观鸟助手）
   * @param {Array<{role:string, content:string}>} messages
   * @param {{ systemPrompt?: string, temperature?: number, maxTokens?: number }} options
   */
  async chat(messages, options = {}) {
    if (!this.enabled) {
      throw new Error('OpenAI兼容API未配置，请设置OPENAI_API_KEY');
    }

    const model = options.model || this.model;

    try {
      const response = await axios.post(
        `${this.baseUrl}/chat/completions`,
        this.applyThinkingOptions(
          {
            model,
            temperature: options.temperature ?? 0.4,
            max_tokens: options.maxTokens ?? 1200,
            messages: this.buildChatMessages(messages, options),
          },
          options.thinking
        ),
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: this.chatTimeoutMs,
        }
      );

      const content = response.data?.choices?.[0]?.message?.content;
      if (!content || !String(content).trim()) {
        throw new Error('AI返回为空');
      }

      return {
        content: String(content).trim(),
        usage: this.extractUsage(response.data, model),
        model: response.data?.model || model,
      };
    } catch (error) {
      throw this.mapChatError(error);
    }
  }

  /**
   * 流式对话：yield { type: 'delta'|'reasoning'|'done', text?, content?, usage?, model? }
   */
  async *chatStream(messages, options = {}) {
    if (!this.enabled) {
      throw new Error('OpenAI兼容API未配置，请设置OPENAI_API_KEY');
    }

    const model = options.model || this.model;
    const isArk = /volces\.com/i.test(this.baseUrl);
    const payload = this.applyThinkingOptions(
      {
        model,
        temperature: options.temperature ?? 0.4,
        max_tokens: options.maxTokens ?? 1200,
        stream: true,
        ...(isArk ? { stream_options: { include_usage: true } } : {}),
        messages: this.buildChatMessages(messages, options),
      },
      options.thinking
    );
    let response;
    try {
      response = await axios.post(`${this.baseUrl}/chat/completions`, payload, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
        },
        timeout: this.chatTimeoutMs,
        responseType: 'stream',
        validateStatus: (s) => s < 500,
      });
    } catch (error) {
      throw this.mapChatError(error);
    }

    if (response.status >= 400) {
      let body = '';
      try {
        for await (const chunk of response.data) {
          body += chunk.toString('utf8');
        }
      } catch {
        /* ignore */
      }
      let msg = body;
      try {
        const parsed = JSON.parse(body);
        msg = parsed?.error?.message || parsed?.message || body;
      } catch {
        /* keep raw */
      }
      throw new Error(`OpenAI兼容API错误: ${response.status} - ${msg}`);
    }

    let buffer = '';
    let full = '';
    let usage = null;
    let resolvedModel = model;

    try {
      for await (const chunk of response.data) {
        buffer += chunk.toString('utf8');
        const parts = buffer.split('\n');
        buffer = parts.pop() || '';

        for (const rawLine of parts) {
          const line = rawLine.trim();
          if (!line || line.startsWith(':')) continue;
          if (!line.startsWith('data:')) continue;
          const data = line.slice(5).trim();
          if (!data) continue;
          if (data === '[DONE]') {
            yield {
              type: 'done',
              content: full.trim(),
              usage,
              model: resolvedModel,
            };
            return;
          }

          let parsed;
          try {
            parsed = JSON.parse(data);
          } catch {
            continue;
          }

          if (parsed?.model) resolvedModel = parsed.model;
          if (parsed?.usage) {
            usage = this.extractUsage(parsed, resolvedModel);
          }

          const choice = parsed?.choices?.[0] || {};
          const delta = choice.delta || {};
          const reasoning =
            delta.reasoning_content ||
            delta.reasoning ||
            choice.reasoning_content ||
            '';
          if (reasoning) {
            yield { type: 'reasoning', text: String(reasoning) };
          }
          const text = delta.content || '';
          if (text) {
            full += text;
            yield { type: 'delta', text: String(text) };
          }
        }
      }
    } catch (error) {
      throw this.mapChatError(error);
    }

    if (!full.trim()) {
      throw new Error('AI返回为空');
    }
    yield {
      type: 'done',
      content: full.trim(),
      usage,
      model: resolvedModel,
    };
  }

  async draftFromText(text) {
    if (!this.enabled) {
      throw new Error('OpenAI兼容API未配置，请设置OPENAI_API_KEY');
    }

    const model = this.model;
    const systemPrompt =
      '你是观鸟记录整理助手。只根据用户原文抽取字段，不要补充原文没有的鸟种、数量、地点或日期。不确定就留空，并在 uncertainty 说明。数量未写明时 count 用 1，并在该鸟 notes 里注明「数量未写明」。';
    const userPrompt =
      '把下面的观鸟笔记整理成 JSON，不要返回其它文本。日期用 YYYY-MM-DD，时间用 HH:mm，没有就用空字符串。JSON 格式：' +
      '{"date":"","startTime":"","endTime":"","locationName":"","weather":"","notes":"","birds":[{"name":"中文名","scientificName":"","count":1,"notes":""}],"uncertainty":""}\n\n笔记：\n' +
      text;

    try {
      const response = await axios.post(
        `${this.baseUrl}/chat/completions`,
        {
          model,
          temperature: 0.1,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
        },
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 45000,
        }
      );

      const content = response.data?.choices?.[0]?.message?.content;
      return {
        parsed: this.parseJsonContent(content),
        usage: this.extractUsage(response.data, model),
      };
    } catch (error) {
      if (error.response) {
        const msg = error.response.data?.error?.message || error.response.data?.message || error.message;
        throw new Error(`OpenAI兼容API错误: ${error.response.status} - ${msg}`);
      }
      if (error.message && error.message.startsWith('AI返回')) throw error;
      throw new Error(`OpenAI兼容API调用失败: ${error.message}`);
    }
  }

  parseJsonContent(content) {
    if (!content) {
      throw new Error('AI返回为空');
    }
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch {
      const match = String(content).match(/\{[\s\S]*\}/);
      parsed = match ? JSON.parse(match[0]) : null;
    }
    if (!parsed || typeof parsed !== 'object') {
      throw new Error('AI返回格式无效');
    }
    return parsed;
  }

  normalizeConfidence(value) {
    const num = Number(value);
    if (!Number.isFinite(num)) return 0;
    let normalized = num;
    if (normalized > 1) normalized = normalized / 100;
    if (normalized < 0) normalized = 0;
    if (normalized > 1) normalized = 1;
    return normalized;
  }
}

module.exports = OpenAIProvider;
