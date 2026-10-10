const AiConversation = require('../models/aiConversationModel');
const { AI_MODES } = require('../models/aiConversationModel');
const chatService = require('../services/ai/chatService');
const { sendControllerError } = require('../middleware/controllerError');
const { devError } = require('../utils/devLogger');

const summarizeConversation = (doc) => ({
  _id: doc._id,
  mode: doc.mode,
  title: doc.title,
  lastMessageAt: doc.lastMessageAt,
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt,
  messageCount: Array.isArray(doc.messages) ? doc.messages.length : 0,
  preview: (() => {
    const msgs = Array.isArray(doc.messages) ? doc.messages : [];
    for (let i = msgs.length - 1; i >= 0; i -= 1) {
      const m = msgs[i];
      if (m?.content) return String(m.content).slice(0, 80);
    }
    return '';
  })(),
});

const loadOwned = async (id, userId) => {
  if (!id || !userId) return null;
  if (!require('mongoose').Types.ObjectId.isValid(id)) return null;
  return AiConversation.findOne({ _id: id, owner: userId });
};

// GET /api/ai/conversations
const listConversations = async (req, res) => {
  try {
    const mode = String(req.query.mode || '').trim();
    const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit, 10) || 30));
    const query = {
      owner: req.user.id,
      // 只要真正聊过的；空开场白对话不进列表
      'messages.role': 'user',
    };
    if (mode && AI_MODES.includes(mode)) query.mode = mode;

    // 后台顺手清空对话，不阻塞列表
    AiConversation.deleteMany({
      owner: req.user.id,
      messages: { $not: { $elemMatch: { role: 'user' } } },
    }).catch(() => {});

    const rows = await AiConversation.find(query)
      .sort({ lastMessageAt: -1 })
      .limit(limit)
      // 列表只需末尾几条做预览，避免把长对话全文拖垮代理
      .select({
        mode: 1,
        title: 1,
        lastMessageAt: 1,
        createdAt: 1,
        updatedAt: 1,
        messages: { $slice: -4 },
      })
      .lean();

    return res.json({
      success: true,
      data: rows.map(summarizeConversation),
    });
  } catch (error) {
    devError('列出 AI 对话失败:', error);
    return sendControllerError(res, error, {
      defaultMessage: '获取对话历史失败',
      defaultCode: 'AI_CONVERSATION_LIST_FAILED',
    });
  }
};

// POST /api/ai/conversations
const createConversation = async (req, res) => {
  try {
    let mode = String(req.body.mode || 'general').trim();
    if (!AI_MODES.includes(mode)) mode = 'general';

    const starter = chatService.getStarter(mode);
    const title = String(req.body.title || '').trim().slice(0, 120) || chatService.buildTitleFromMessage('', mode);

    const doc = await AiConversation.create({
      owner: req.user.id,
      mode,
      title,
      messages: [
        {
          role: 'assistant',
          content: starter,
          kind: 'text',
        },
      ],
      lastMessageAt: new Date(),
    });

    return res.status(201).json({
      success: true,
      data: doc,
    });
  } catch (error) {
    devError('创建 AI 对话失败:', error);
    return sendControllerError(res, error, {
      defaultMessage: '创建对话失败',
      defaultCode: 'AI_CONVERSATION_CREATE_FAILED',
    });
  }
};

// GET /api/ai/conversations/:id
const getConversation = async (req, res) => {
  try {
    const doc = await loadOwned(req.params.id, req.user.id);
    if (!doc) {
      return res.status(404).json({ success: false, message: '对话不存在' });
    }
    return res.json({ success: true, data: doc });
  } catch (error) {
    return sendControllerError(res, error, {
      defaultMessage: '获取对话失败',
      defaultCode: 'AI_CONVERSATION_GET_FAILED',
    });
  }
};

// DELETE /api/ai/conversations/:id
const deleteConversation = async (req, res) => {
  try {
    const doc = await loadOwned(req.params.id, req.user.id);
    if (!doc) {
      return res.status(404).json({ success: false, message: '对话不存在' });
    }
    await doc.deleteOne();
    return res.json({ success: true, message: '已删除' });
  } catch (error) {
    return sendControllerError(res, error, {
      defaultMessage: '删除对话失败',
      defaultCode: 'AI_CONVERSATION_DELETE_FAILED',
    });
  }
};

const classifyChatError = (error) => {
  const msg = String(error?.message || '');
  if (error.code === 'AI_PROVIDER_TIMEOUT' || /timeout|ECONNABORTED|ETIMEDOUT/i.test(msg)) {
    error.statusCode = error.statusCode || 504;
    error.code = error.code || 'AI_PROVIDER_TIMEOUT';
    error.message = error.message || '大模型响应超时，请稍后重试';
  } else if (/401|403|Unauthorized|invalid.?api.?key|Authentication|欠费|过期|PermissionDenied/i.test(msg)) {
    error.statusCode = error.statusCode || 502;
    error.code = error.code || 'AI_PROVIDER_AUTH_FAILED';
    error.message = `大模型鉴权失败或额度异常：${msg}`;
  } else if (/429|rate.?limit|Too Many/i.test(msg)) {
    error.statusCode = error.statusCode || 429;
    error.code = error.code || 'AI_PROVIDER_RATE_LIMITED';
    error.message = error.message || '大模型调用过于频繁，请稍后再试';
  } else if (/404|NotFound|model/i.test(msg) && /model|Model|endpoint|Endpoint/i.test(msg)) {
    error.statusCode = error.statusCode || 502;
    error.code = error.code || 'AI_MODEL_NOT_FOUND';
    error.message = `模型不可用，请检查 OPENAI_MODEL：${msg}`;
  } else if (/OpenAI兼容API/i.test(msg)) {
    error.statusCode = error.statusCode || 502;
    error.code = error.code || 'AI_PROVIDER_ERROR';
    error.message = msg;
  }
  return error;
};

const prepareOutgoingMessage = async (req) => {
  const doc = await loadOwned(req.params.id, req.user.id);
  if (!doc) {
    const err = new Error('对话不存在');
    err.statusCode = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }

  const content = String(req.body.content || '').trim();
  if (!content) {
    const err = new Error('请输入内容');
    err.statusCode = 400;
    err.code = 'BAD_REQUEST';
    throw err;
  }
  if (content.length > 8000) {
    const err = new Error('消息过长（最多 8000 字）');
    err.statusCode = 400;
    err.code = 'BAD_REQUEST';
    throw err;
  }

  const userMsgCount = (doc.messages || []).filter((m) => m.role === 'user').length;
  if (userMsgCount === 0) {
    doc.title = chatService.buildTitleFromMessage(content, doc.mode);
  }

  doc.messages.push({
    role: 'user',
    content,
    kind: 'text',
  });

  const history = (doc.messages || [])
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({ role: m.role, content: m.content }));

  const thinkingRaw = String(req.body.thinking || '').trim().toLowerCase();
  const thinking = ['enabled', 'disabled', 'auto'].includes(thinkingRaw) ? thinkingRaw : null;

  return { doc, content, history, thinking };
};

const writeSse = (res, event, data) => {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  if (typeof res.flush === 'function') res.flush();
};

// POST /api/ai/conversations/:id/messages
const postMessage = async (req, res) => {
  try {
    const { doc, history, thinking } = await prepareOutgoingMessage(req);

    const ai = await chatService.reply({
      mode: doc.mode,
      messages: history,
      thinking,
    });

    doc.messages.push({
      role: 'assistant',
      content: ai.content,
      kind: 'text',
      meta: ai.usage ? { usage: ai.usage, model: ai.model } : null,
    });
    doc.lastMessageAt = new Date();
    await doc.save();

    return res.json({
      success: true,
      data: doc,
      reply: ai.content,
    });
  } catch (error) {
    devError('AI 对话失败:', error);
    classifyChatError(error);
    return sendControllerError(res, error, {
      defaultMessage: '发送消息失败',
      defaultCode: 'AI_CONVERSATION_CHAT_FAILED',
    });
  }
};

// POST /api/ai/conversations/:id/messages/stream  (SSE)
const postMessageStream = async (req, res) => {
  let closed = false;
  req.on('close', () => {
    closed = true;
  });

  try {
    const { doc, history, thinking } = await prepareOutgoingMessage(req);

    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    if (typeof res.flushHeaders === 'function') res.flushHeaders();

    writeSse(res, 'status', { stage: 'received', label: '已收到消息' });
    const thinkingLabel =
      thinking === 'disabled'
        ? '正在连接大模型（已关思考）…'
        : thinking === 'auto'
          ? '正在连接大模型（自动思考）…'
          : '正在连接大模型…';
    writeSse(res, 'status', { stage: 'calling', label: thinkingLabel });

    let full = '';
    let usage = null;
    let model = null;
    let started = false;

    for await (const event of chatService.replyStream({
      mode: doc.mode,
      messages: history,
      thinking,
    })) {
      if (closed) break;

      if (event.type === 'reasoning') {
        if (!started) {
          started = true;
          writeSse(res, 'status', { stage: 'thinking', label: '模型思考中…' });
        }
        writeSse(res, 'reasoning', { text: event.text || '' });
        continue;
      }

      if (event.type === 'delta') {
        if (!started) {
          started = true;
          writeSse(res, 'status', { stage: 'generating', label: '正在生成回复…' });
        }
        full += event.text || '';
        writeSse(res, 'delta', { text: event.text || '' });
        continue;
      }

      if (event.type === 'done') {
        full = event.content || full;
        usage = event.usage || usage;
        model = event.model || model;
      }
    }

    if (closed) {
      try {
        res.end();
      } catch {
        /* ignore */
      }
      return;
    }

    if (!String(full || '').trim()) {
      writeSse(res, 'error', {
        message: 'AI返回为空',
        code: 'AI_EMPTY_RESPONSE',
      });
      return res.end();
    }

    writeSse(res, 'status', { stage: 'saving', label: '正在保存对话…' });

    doc.messages.push({
      role: 'assistant',
      content: String(full).trim(),
      kind: 'text',
      meta: usage ? { usage, model } : model ? { model } : null,
    });
    doc.lastMessageAt = new Date();
    await doc.save();

    writeSse(res, 'done', {
      success: true,
      data: doc,
      reply: String(full).trim(),
    });
    return res.end();
  } catch (error) {
    devError('AI 流式对话失败:', error);
    classifyChatError(error);
    if (res.headersSent) {
      writeSse(res, 'error', {
        message: error.message || '发送消息失败',
        code: error.code || 'AI_CONVERSATION_CHAT_FAILED',
      });
      return res.end();
    }
    return sendControllerError(res, error, {
      defaultMessage: '发送消息失败',
      defaultCode: 'AI_CONVERSATION_CHAT_FAILED',
    });
  }
};

// POST /api/ai/conversations/:id/identify-result
// 把一次识别结果写入对话历史（不重新调用识别）
const appendIdentifyResult = async (req, res) => {
  try {
    const doc = await loadOwned(req.params.id, req.user.id);
    if (!doc) {
      return res.status(404).json({ success: false, message: '对话不存在' });
    }

    const result = req.body.result;
    if (!result || typeof result !== 'object') {
      return res.status(400).json({ success: false, message: '缺少识别结果' });
    }

    const species = result.species || result.name || '未知鸟种';
    const confidence =
      result.confidence != null ? `（置信度 ${Math.round(Number(result.confidence) * 100)}%）` : '';
    const userNote = String(req.body.note || '').trim();

    doc.messages.push({
      role: 'user',
      content: userNote || '上传照片请求识别',
      kind: 'text',
    });
    doc.messages.push({
      role: 'assistant',
      content: `识别结果：${species}${confidence}${
        result.reasoning ? `\n依据：${result.reasoning}` : ''
      }${result.encyclopedia ? `\n简介：${result.encyclopedia}` : ''}`,
      kind: 'identify_result',
      meta: result,
    });

    if ((doc.messages || []).filter((m) => m.role === 'user').length <= 1) {
      doc.title = chatService.buildTitleFromMessage(`识别：${species}`, 'identify');
    }
    doc.mode = 'identify';
    doc.lastMessageAt = new Date();
    await doc.save();

    return res.json({ success: true, data: doc });
  } catch (error) {
    return sendControllerError(res, error, {
      defaultMessage: '保存识别结果失败',
      defaultCode: 'AI_CONVERSATION_IDENTIFY_SAVE_FAILED',
    });
  }
};

module.exports = {
  listConversations,
  createConversation,
  getConversation,
  deleteConversation,
  postMessage,
  postMessageStream,
  appendIdentifyResult,
};
