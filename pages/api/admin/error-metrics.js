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
  const query = new URLSearchParams();
  if (req.query?.windowMinutes) {
    query.set('windowMinutes', String(req.query.windowMinutes));
  }
  const suffix = query.toString() ? `?${query.toString()}` : '';
  const url = `${baseUrl}/admin/error-metrics${suffix}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: buildJsonHeaders(req),
    });
    const data = await parseProxyJsonResponse(response);
    return res.status(response.status).json(data);
  } catch (error) {
    return sendProxyError(res, error, {
      message: '获取接口错误率指标失败',
      code: 'ADMIN_ERROR_METRICS_PROXY_FAILED',
    });
  }
}
