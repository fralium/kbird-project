import { resolveBackendApiBase } from '../../../utils/backendApiBase';
import {
  buildJsonHeaders,
  parseProxyJsonResponse,
  sendMethodNotAllowed,
  sendProxyError,
} from '../../../utils/proxyApi';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return sendMethodNotAllowed(res, ['GET']);
  }

  const baseUrl = resolveBackendApiBase();
  const params = new URLSearchParams();
  Object.entries(req.query || {}).forEach(([key, value]) => {
    if (value == null || value === '') return;
    if (Array.isArray(value)) {
      value.forEach((item) => {
        if (item != null && item !== '') params.append(key, String(item));
      });
      return;
    }
    params.append(key, String(value));
  });
  const url = `${baseUrl}/birds/filter-options${params.toString() ? `?${params.toString()}` : ''}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: buildJsonHeaders(req),
    });
    const data = await parseProxyJsonResponse(response, {
      invalidMessage: '筛选选项响应解析失败',
      invalidCode: 'UPSTREAM_INVALID_RESPONSE',
    });
    return res.status(response.status).json(data);
  } catch (error) {
    return sendProxyError(res, error, {
      message: '获取鸟类筛选选项失败',
      code: 'BIRD_FILTER_OPTIONS_PROXY_FAILED',
    });
  }
}
