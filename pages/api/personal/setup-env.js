import { resolveBackendApiBase } from '../../../utils/backendApiBase';
import {
  buildJsonHeaders,
  parseProxyJsonResponse,
  sendMethodNotAllowed,
  sendProxyError,
} from '../../../utils/proxyApi';

export default async function handler(req, res) {
  const { method, body } = req;
  if (!['GET', 'PUT'].includes(method)) {
    return sendMethodNotAllowed(res, ['GET', 'PUT']);
  }

  const baseUrl = resolveBackendApiBase();
  const url = `${baseUrl}/personal/setup-env`;

  try {
    const response = await fetch(url, {
      method,
      headers: buildJsonHeaders(req),
      body: method !== 'GET' ? JSON.stringify(body || {}) : undefined,
    });

    const data = await parseProxyJsonResponse(response, {
      invalidMessage: '服务与密钥接口响应解析失败',
      invalidCode: 'SETUP_ENV_PROXY_FAILED',
    });

    return res.status(response.status).json(data);
  } catch (error) {
    return sendProxyError(res, error, {
      message: '服务与密钥暂不可用',
      code: 'SETUP_ENV_PROXY_FAILED',
    });
  }
}
