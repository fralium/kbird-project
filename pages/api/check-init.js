import { resolveBackendApiBase } from '@/utils/backendApiBase';
import { buildJsonHeaders, parseProxyJsonResponse, sendMethodNotAllowed, sendProxyError } from '@/utils/proxyApi';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return sendMethodNotAllowed(res, ['GET']);
  }

  const baseUrl = resolveBackendApiBase();
  const url = `${baseUrl}/check-init`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: buildJsonHeaders(req),
    });
    const data = await parseProxyJsonResponse(response, {
      invalidMessage: '初始化状态检查失败',
      invalidCode: 'INIT_CHECK_PROXY_FAILED',
    });
    return res.status(response.status).json(data);
  } catch (error) {
    return sendProxyError(res, error, {
      message: '初始化状态检查失败',
      code: 'INIT_CHECK_PROXY_FAILED',
    });
  }
}
