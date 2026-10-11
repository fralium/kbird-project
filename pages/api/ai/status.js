import { resolveBackendApiBase } from '@/utils/backendApiBase';
import {
  buildJsonHeaders,
  parseProxyJsonResponse,
  sendMethodNotAllowed,
  sendProxyError,
} from '@/utils/proxyApi';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return sendMethodNotAllowed(res, ['GET']);
  }

  const baseUrl = resolveBackendApiBase();

  try {
    const response = await fetch(`${baseUrl}/ai/status`, {
      method: 'GET',
      headers: buildJsonHeaders(req),
    });
    const data = await parseProxyJsonResponse(response, {
      invalidMessage: 'AI状态响应解析失败',
      invalidCode: 'UPSTREAM_INVALID_RESPONSE',
    });
    return res.status(response.status).json(data);
  } catch (error) {
    return sendProxyError(res, error, {
      message: '获取AI状态失败',
      code: 'AI_STATUS_PROXY_FAILED',
    });
  }
}
