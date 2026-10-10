import { resolveBackendApiBase } from '../../../utils/backendApiBase';
import {
  buildJsonHeaders,
  parseProxyJsonResponse,
  sendMethodNotAllowed,
  sendProxyError,
} from '../../../utils/proxyApi';

export default async function handler(req, res) {
  const { method, query } = req;
  if (!['GET', 'PUT', 'DELETE'].includes(method)) {
    return sendMethodNotAllowed(res, ['GET', 'PUT', 'DELETE']);
  }

  const id = Array.isArray(query.id) ? query.id[0] : query.id;
  if (!id) {
    return res.status(400).json({
      success: false,
      message: '缺少清单 ID',
      code: 'MISSING_REGION_LIST_ID',
    });
  }

  const params = new URLSearchParams();
  Object.entries(query || {}).forEach(([key, value]) => {
    if (key === 'id') return;
    const raw = Array.isArray(value) ? value[0] : value;
    if (raw != null && String(raw).trim() !== '') {
      params.append(key, String(raw));
    }
  });
  const qs = params.toString();
  const baseUrl = resolveBackendApiBase();
  const url = `${baseUrl}/region-lists/${id}${qs ? `?${qs}` : ''}`;

  try {
    const response = await fetch(url, {
      method,
      headers: buildJsonHeaders(req),
      body: method === 'PUT' ? JSON.stringify(req.body || {}) : undefined,
    });
    const data = await parseProxyJsonResponse(response, {
      invalidMessage: '各地鸟种详情响应解析失败',
      invalidCode: 'UPSTREAM_INVALID_RESPONSE',
    });
    return res.status(response.status).json(data);
  } catch (error) {
    return sendProxyError(res, error, {
      message: '各地鸟种详情服务暂不可用',
      code: 'REGION_LIST_DETAIL_PROXY_FAILED',
    });
  }
}
