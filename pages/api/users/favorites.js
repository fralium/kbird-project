import { resolveBackendApiBase } from '@/utils/backendApiBase';
import {
  buildJsonHeaders,
  parseProxyJsonResponse,
  sendMethodNotAllowed,
  sendProxyError,
} from '@/utils/proxyApi';

export default async function handler(req, res) {
  const { method } = req;
  const token = req.headers.authorization;
  
  // 设置缓存控制头，防止缓存问题
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Last-Modified', new Date().toUTCString());

  // 检查token
  if (!token) {
    return res.status(401).json({
      success: false,
      message: '未授权访问，请提供token',
      code: 'UNAUTHORIZED',
    });
  }

  if (method !== 'GET') {
    return sendMethodNotAllowed(res, ['GET']);
  }

  try {
    const API_BASE_URL = resolveBackendApiBase();
    const response = await fetch(`${API_BASE_URL}/users/favorites`, {
      method: 'GET',
      headers: buildJsonHeaders(req),
    });

    const data = await parseProxyJsonResponse(response, {
      invalidMessage: '收藏列表响应解析失败',
      invalidCode: 'UPSTREAM_INVALID_RESPONSE',
    });
    if (response.status === 401) {
      return res.status(401).json({
        success: false,
        message: data?.message || 'Token无效或已过期，请重新登录',
        code: data?.code || 'TOKEN_INVALID',
      });
    }
    return res.status(response.status).json(data);
  } catch (error) {
    return sendProxyError(res, error, {
      message: '服务器错误',
      code: 'FAVORITES_PROXY_FAILED',
      hint: `尝试请求: ${resolveBackendApiBase()}/users/favorites`,
    });
  }
}