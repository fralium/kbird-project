import { resolveBackendApiBase } from '@/utils/backendApiBase';
import {
  buildJsonHeaders,
  parseProxyJsonResponse,
  sendMethodNotAllowed,
  sendProxyError,
} from '@/utils/proxyApi';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return sendMethodNotAllowed(res, ['POST']);
  }

  const id = Array.isArray(req.query?.id) ? req.query.id[0] : req.query?.id;
  if (!id) {
    return res.status(400).json({ success: false, message: '缺少对话 ID' });
  }

  const baseUrl = resolveBackendApiBase();
  const url = `${baseUrl}/ai/conversations/${encodeURIComponent(id)}/identify-result`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: buildJsonHeaders(req),
      body: JSON.stringify(req.body || {}),
    });
    const data = await parseProxyJsonResponse(response, {
      invalidMessage: 'AI对话接口响应解析失败',
      invalidCode: 'UPSTREAM_INVALID_RESPONSE',
    });
    return res.status(response.status).json(data);
  } catch (error) {
    return sendProxyError(res, error, {
      message: '保存识别结果失败',
      code: 'AI_CONVERSATION_IDENTIFY_PROXY_FAILED',
    });
  }
}
