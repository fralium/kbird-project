// Next.js API 代理：本机自动登录（仅后端允许回环）
import { resolveBackendApiBase } from '../../../utils/backendApiBase';
import { parseProxyJsonResponse, sendMethodNotAllowed, sendProxyError } from '../../../utils/proxyApi';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return sendMethodNotAllowed(res, ['POST']);
  }

  const baseUrl = resolveBackendApiBase();
  const url = `${baseUrl}/users/local-session`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(req.body || {}),
    });

    const data = await parseProxyJsonResponse(response);

    res.status(response.status).json(data);
  } catch (error) {
    return sendProxyError(res, error, {
      message: '本机自动登录暂不可用',
      code: 'LOCAL_SESSION_PROXY_FAILED',
    });
  }
}
