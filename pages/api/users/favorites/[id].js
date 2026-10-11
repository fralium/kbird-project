import { resolveBackendApiBase } from '@/utils/backendApiBase';
import {
  buildJsonHeaders,
  parseProxyJsonResponse,
  sendMethodNotAllowed,
  sendProxyError,
} from '@/utils/proxyApi';

export default async function handler(req, res) {
  const { method, query } = req;
  const { id } = query;
  const token = req.headers.authorization;

  if (!token) {
    return res.status(401).json({
      success: false,
      message: '未授权访问，请提供token',
      code: 'UNAUTHORIZED',
    });
  }

  if (!['POST', 'DELETE'].includes(method)) {
    return sendMethodNotAllowed(res, ['POST', 'DELETE']);
  }

  if (!id) {
    return res.status(400).json({
      success: false,
      message: '缺少收藏ID',
      code: 'MISSING_FAVORITE_ID',
    });
  }

  const API_BASE_URL = resolveBackendApiBase();

  try {
    const response = await fetch(`${API_BASE_URL}/users/favorites/${id}`, {
      method,
      headers: buildJsonHeaders(req),
      body: method === 'POST' ? JSON.stringify({}) : undefined,
    });

    const data = await parseProxyJsonResponse(response, {
      invalidMessage: '收藏操作响应解析失败',
      invalidCode: 'UPSTREAM_INVALID_RESPONSE',
    });
    return res.status(response.status).json(data);
  } catch (error) {
    return sendProxyError(res, error, {
      message: '服务器错误',
      code: 'FAVORITE_ITEM_PROXY_FAILED',
    });
  }
}