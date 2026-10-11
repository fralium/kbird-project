import { resolveBackendApiBase } from '@/utils/backendApiBase';
import {
  buildJsonHeaders,
  parseProxyJsonResponse,
  sendMethodNotAllowed,
  sendProxyError,
} from '@/utils/proxyApi';

export default async function handler(req, res) {
  const { method, query } = req;
  if (!['GET', 'DELETE'].includes(method)) {
    return sendMethodNotAllowed(res, ['GET', 'DELETE']);
  }

  const id = Array.isArray(query?.id) ? query.id[0] : query?.id;
  if (!id) {
    return res.status(400).json({ success: false, message: '缺少对话 ID' });
  }

  const baseUrl = resolveBackendApiBase();
  const url = `${baseUrl}/ai/conversations/${encodeURIComponent(id)}`;

  try {
    const response = await fetch(url, {
      method,
      headers: buildJsonHeaders(req),
    });
    const data = await parseProxyJsonResponse(response, {
      invalidMessage: 'AI对话接口响应解析失败',
      invalidCode: 'UPSTREAM_INVALID_RESPONSE',
    });
    return res.status(response.status).json(data);
  } catch (error) {
    return sendProxyError(res, error, {
      message: 'AI对话服务暂不可用',
      code: 'AI_CONVERSATION_PROXY_FAILED',
    });
  }
}
