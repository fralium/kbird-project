import { resolveBackendApiBase } from '@/utils/backendApiBase';
import {
  buildJsonHeaders,
  parseProxyJsonResponse,
  sendMethodNotAllowed,
  sendProxyError,
} from '@/utils/proxyApi';

export default async function handler(req, res) {
  const { method } = req;
  if (method !== 'GET') {
    return sendMethodNotAllowed(res, ['GET']);
  }

  const baseUrl = resolveBackendApiBase();
  const query = new URLSearchParams(req.query || {}).toString();
  const url = `${baseUrl}/records/map-points${query ? `?${query}` : ''}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: buildJsonHeaders(req),
    });

    const data = await parseProxyJsonResponse(response, {
      invalidMessage: '地图点接口响应解析失败',
      invalidCode: 'UPSTREAM_INVALID_RESPONSE',
    });

    return res.status(response.status).json(data);
  } catch (error) {
    return sendProxyError(res, error, {
      message: '获取地图点失败',
      code: 'RECORD_MAP_POINTS_PROXY_FAILED',
    });
  }
}
