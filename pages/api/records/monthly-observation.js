import { resolveBackendApiBase } from '../../../utils/backendApiBase';
import {
  buildJsonHeaders,
  parseProxyJsonResponse,
  sendMethodNotAllowed,
  sendProxyError,
} from '../../../utils/proxyApi';

export default async function handler(req, res) {
  const { method, query } = req;
  if (method !== 'GET') {
    return sendMethodNotAllowed(res, ['GET']);
  }

  const baseUrl = resolveBackendApiBase();
  const url = `${baseUrl}/records/monthly-observation`;

  try {
    const params = new URLSearchParams();
    Object.keys(query).forEach((key) => {
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
      method: 'GET',
      headers: buildJsonHeaders(req),
    });

    const data = await parseProxyJsonResponse(response, {
      invalidMessage: '本月观察推荐接口响应解析失败',
      invalidCode: 'UPSTREAM_INVALID_RESPONSE',
    });

    return res.status(response.status).json(data);
  } catch (error) {
    return sendProxyError(res, error, {
      message: '获取本月观察推荐失败',
      code: 'MONTHLY_OBSERVATION_PROXY_FAILED',
    });
  }
}
