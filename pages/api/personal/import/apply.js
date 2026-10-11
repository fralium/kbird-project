import { resolveBackendApiBase } from '@/utils/backendApiBase';
import {
  buildJsonHeaders,
  parseProxyJsonResponse,
  sendMethodNotAllowed,
  sendProxyError,
} from '@/utils/proxyApi';

export default async function handler(req, res) {
  const { method, body } = req;
  if (method !== 'POST') {
    return sendMethodNotAllowed(res, ['POST']);
  }

  const baseUrl = resolveBackendApiBase();
  const url = `${baseUrl}/personal/import/apply`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: buildJsonHeaders(req),
      body: JSON.stringify(body || {}),
    });

    const data = await parseProxyJsonResponse(response, {
      invalidMessage: '导入执行接口响应解析失败',
      invalidCode: 'UPSTREAM_INVALID_RESPONSE',
    });

    return res.status(response.status).json(data);
  } catch (error) {
    return sendProxyError(res, error, {
      message: '导入执行服务暂不可用',
      code: 'PERSONAL_IMPORT_APPLY_PROXY_FAILED',
    });
  }
}
