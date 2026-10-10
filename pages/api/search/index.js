import { resolveBackendApiBase } from '../../../utils/backendApiBase';
import { buildJsonHeaders, parseProxyJsonResponse, sendMethodNotAllowed, sendProxyError } from '../../../utils/proxyApi';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return sendMethodNotAllowed(res, ['GET']);
  }

  const baseUrl = resolveBackendApiBase();
  const qs = req.url?.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
  const url = `${baseUrl}/search${qs}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: buildJsonHeaders(req),
    });
    const data = await parseProxyJsonResponse(response, {
      invalidMessage: '搜索失败',
      invalidCode: 'SEARCH_PROXY_FAILED',
    });
    return res.status(response.status).json(data);
  } catch (error) {
    return sendProxyError(res, error, {
      message: '搜索暂不可用',
      code: 'SEARCH_PROXY_FAILED',
    });
  }
}
