// Next.js API代理路由 - 用户个人资料
import { resolveBackendApiBase } from '../../../utils/backendApiBase';
import { buildJsonHeaders, parseProxyJsonResponse, sendMethodNotAllowed, sendProxyError } from '../../../utils/proxyApi';

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'PUT') {
    return sendMethodNotAllowed(res, ['GET', 'PUT']);
  }
  
  const baseUrl = resolveBackendApiBase();
  const url = `${baseUrl}/users/profile`;
  
  try {
    const response = await fetch(url, {
      method: req.method,
      headers: buildJsonHeaders(req),
      body: req.method === 'PUT' ? JSON.stringify(req.body || {}) : undefined,
    });

    const data = await parseProxyJsonResponse(response, {
      invalidMessage: response.ok ? '服务器返回格式错误' : '未授权或请求失败',
      invalidCode: 'UPSTREAM_INVALID_RESPONSE',
    });
    res.status(response.status).json(data);
  } catch (error) {
    return sendProxyError(res, error, {
      message: '服务器错误',
      code: 'PROFILE_PROXY_FAILED',
    });
  }
}
