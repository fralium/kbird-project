import { resolveBackendApiBase } from '@/utils/backendApiBase';
import {
  buildJsonHeaders,
  parseProxyJsonResponse,
  sendMethodNotAllowed,
  sendProxyError,
} from '@/utils/proxyApi';

export default async function handler(req, res) {
  const { method, body, query } = req;
  if (!['GET', 'PUT', 'DELETE'].includes(method)) {
    return sendMethodNotAllowed(res, ['GET', 'PUT', 'DELETE']);
  }

  const { id } = query;
  if (!id) return res.status(400).json({ success: false, message: '缺少项目ID' });

  const baseUrl = resolveBackendApiBase();
  const url = `${baseUrl}/personal/projects/${encodeURIComponent(id)}`;

  try {
    const response = await fetch(url, {
      method,
      headers: buildJsonHeaders(req),
      body: method !== 'GET' && method !== 'DELETE' ? JSON.stringify(body || {}) : undefined,
    });

    const data = await parseProxyJsonResponse(response, {
      invalidMessage: '个人项目接口响应解析失败',
      invalidCode: 'UPSTREAM_INVALID_RESPONSE',
    });

    return res.status(response.status).json(data);
  } catch (error) {
    return sendProxyError(res, error, {
      message: '个人项目服务暂不可用',
      code: 'PERSONAL_PROJECTS_PROXY_FAILED',
    });
  }
}
