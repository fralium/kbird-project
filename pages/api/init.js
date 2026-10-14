/**
 * 初始化代理：转发到 Express /api/init（含 x-setup-token）。
 * 仅本机客户端可调用，避免局域网经 Next 代理绕过 Express loopback 门闸。
 */
import { resolveBackendApiBase } from '@/utils/backendApiBase';
import { buildJsonHeaders, parseProxyJsonResponse, sendMethodNotAllowed, sendProxyError } from '@/utils/proxyApi';
import { isLocalLoopbackClient, rejectUnlessLocalLoopback } from '@/utils/requestLoopback';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return sendMethodNotAllowed(res, ['POST']);
  }

  if (!isLocalLoopbackClient(req)) {
    return rejectUnlessLocalLoopback(res, '初始化仅允许本机访问');
  }

  const baseUrl = resolveBackendApiBase();
  const url = `${baseUrl}/init`;

  try {
    const headers = buildJsonHeaders(req);
    if (req.headers['x-setup-token']) {
      headers['x-setup-token'] = req.headers['x-setup-token'];
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(req.body || {}),
    });

    const data = await parseProxyJsonResponse(response, {
      invalidMessage: '初始化失败',
      invalidCode: 'INIT_PROXY_FAILED',
    });
    return res.status(response.status).json(data);
  } catch (error) {
    return sendProxyError(res, error, {
      message: '初始化暂不可用',
      code: 'INIT_PROXY_FAILED',
    });
  }
}
