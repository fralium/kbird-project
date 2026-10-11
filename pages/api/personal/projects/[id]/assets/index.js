import { resolveBackendApiBase } from '@/utils/backendApiBase';
import {
  buildJsonHeaders,
  parseProxyJsonResponse,
  sendMethodNotAllowed,
  sendProxyError,
} from '@/utils/proxyApi';

export default async function handler(req, res) {
  const { method, body, query } = req;
  if (method !== 'POST') {
    return sendMethodNotAllowed(res, ['POST']);
  }

  const { id } = query;
  if (!id) return res.status(400).json({ success: false, message: '缺少项目ID' });

  const baseUrl = resolveBackendApiBase();
  const url = `${baseUrl}/personal/projects/${encodeURIComponent(id)}/assets`;

  try {
    const response = await fetch(url, {
      method,
      headers: buildJsonHeaders(req),
      body: JSON.stringify(body || {}),
    });

    const data = await parseProxyJsonResponse(response, {
      invalidMessage: '项目资料接口响应解析失败',
      invalidCode: 'UPSTREAM_INVALID_RESPONSE',
    });

    return res.status(response.status).json(data);
  } catch (error) {
    return sendProxyError(res, error, {
      message: '项目资料服务暂不可用',
      code: 'PERSONAL_PROJECT_ASSETS_PROXY_FAILED',
    });
  }
}
