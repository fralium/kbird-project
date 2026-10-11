import { resolveBackendApiBase } from '@/utils/backendApiBase';
import {
  buildJsonHeaders,
  parseProxyJsonResponse,
  sendMethodNotAllowed,
  sendProxyError,
} from '@/utils/proxyApi';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '20mb',
    },
  },
};

export default async function handler(req, res) {
  const { method } = req;
  if (!['GET', 'POST'].includes(method)) {
    return sendMethodNotAllowed(res, ['GET', 'POST']);
  }

  const baseUrl = resolveBackendApiBase();
  const query = method === 'GET' && req.url?.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
  const url = `${baseUrl}/region-lists${query}`;

  try {
    const response = await fetch(url, {
      method,
      headers: buildJsonHeaders(req),
      body: method === 'POST' ? JSON.stringify(req.body || {}) : undefined,
    });
    const data = await parseProxyJsonResponse(response, {
      invalidMessage: '各地鸟种接口响应解析失败',
      invalidCode: 'UPSTREAM_INVALID_RESPONSE',
    });
    return res.status(response.status).json(data);
  } catch (error) {
    return sendProxyError(res, error, {
      message: '各地鸟种服务暂不可用',
      code: 'REGION_LISTS_PROXY_FAILED',
    });
  }
}
