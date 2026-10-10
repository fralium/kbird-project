import { resolveBackendApiBase } from '../../../../utils/backendApiBase';
import {
  buildJsonHeaders,
  parseProxyJsonResponse,
  sendMethodNotAllowed,
  sendProxyError,
} from '../../../../utils/proxyApi';

export default async function handler(req, res) {
  const { method, query, body } = req;
  if (!['GET', 'POST'].includes(method)) {
    return sendMethodNotAllowed(res, ['GET', 'POST']);
  }

  const baseUrl = resolveBackendApiBase();
  const url = `${baseUrl}/personal/plots`;

  try {
    const params = new URLSearchParams();
    Object.keys(query || {}).forEach((key) => {
      const value = query[key];
      if (value == null || value === '') return;
      if (Array.isArray(value)) {
        value.forEach((item) => {
          if (item != null && item !== '') params.append(key, String(item));
        });
        return;
      }
      params.append(key, String(value));
    });

    const fullUrl = params.toString() ? `${url}?${params.toString()}` : url;
    const response = await fetch(fullUrl, {
      method,
      headers: buildJsonHeaders(req),
      body: method !== 'GET' ? JSON.stringify(body || {}) : undefined,
    });

    const data = await parseProxyJsonResponse(response, {
      invalidMessage: '自留地接口响应解析失败',
      invalidCode: 'UPSTREAM_INVALID_RESPONSE',
    });

    return res.status(response.status).json(data);
  } catch (error) {
    return sendProxyError(res, error, {
      message: '自留地服务暂不可用',
      code: 'PERSONAL_PLOTS_PROXY_FAILED',
    });
  }
}
