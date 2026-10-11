import { resolveBackendApiBase } from '@/utils/backendApiBase';
import {
  buildJsonHeaders,
  parseProxyJsonResponse,
  sendMethodNotAllowed,
  sendProxyError,
} from '@/utils/proxyApi';

export default async function handler(req, res) {
  const { method, query } = req;
  if (method !== 'GET') {
    return sendMethodNotAllowed(res, ['GET']);
  }

  const baseUrl = resolveBackendApiBase();
  const params = new URLSearchParams();
  const q = query?.q;
  if (q) params.set('q', String(Array.isArray(q) ? q[0] : q));
  const url = `${baseUrl}/personal/trip-preview/history${params.toString() ? `?${params}` : ''}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: buildJsonHeaders(req),
    });
    const data = await parseProxyJsonResponse(response, {
      invalidMessage: '对照历史接口响应解析失败',
      invalidCode: 'UPSTREAM_INVALID_RESPONSE',
    });
    return res.status(response.status).json(data);
  } catch (error) {
    return sendProxyError(res, error, {
      message: '对照历史服务暂不可用',
      code: 'TRIP_PREVIEW_HISTORY_PROXY_FAILED',
    });
  }
}
