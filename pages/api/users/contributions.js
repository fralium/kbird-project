// Next.js API代理路由 - 用户贡献
import { resolveBackendApiBase } from '@/utils/backendApiBase';
import { buildJsonHeaders, parseProxyJsonResponse, sendMethodNotAllowed, sendProxyError } from '@/utils/proxyApi';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return sendMethodNotAllowed(res, ['GET']);
  }
  
  const baseUrl = resolveBackendApiBase();
  const url = `${baseUrl}/users/contributions`;
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: buildJsonHeaders(req),
    });
    
    const data = await parseProxyJsonResponse(response);
    
    res.status(response.status).json(data);
  } catch (error) {
    return sendProxyError(res, error, {
      message: '服务器错误',
      code: 'CONTRIBUTIONS_PROXY_FAILED',
    });
  }
}