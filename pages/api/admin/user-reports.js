// Next.js API代理路由 - 获取用户报告
import { resolveBackendApiBase } from '@/utils/backendApiBase';
import { buildJsonHeaders, parseProxyJsonResponse, sendMethodNotAllowed, sendProxyError } from '@/utils/proxyApi';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return sendMethodNotAllowed(res, ['GET']);
  }

  const baseUrl = resolveBackendApiBase();
  const url = `${baseUrl}/admin/user-reports`;

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
      code: 'ADMIN_USER_REPORTS_PROXY_FAILED',
    });
  }
}
