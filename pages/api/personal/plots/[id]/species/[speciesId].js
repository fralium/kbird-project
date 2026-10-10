import { resolveBackendApiBase } from '../../../../../../utils/backendApiBase';
import {
  buildJsonHeaders,
  parseProxyJsonResponse,
  sendMethodNotAllowed,
  sendProxyError,
} from '../../../../../../utils/proxyApi';

export default async function handler(req, res) {
  const { method, body, query } = req;
  if (!['PUT', 'DELETE'].includes(method)) {
    return sendMethodNotAllowed(res, ['PUT', 'DELETE']);
  }

  const { id, speciesId } = query;
  if (!id || !speciesId) {
    return res.status(400).json({ success: false, message: '缺少参数' });
  }

  const baseUrl = resolveBackendApiBase();
  const url = `${baseUrl}/personal/plots/${encodeURIComponent(id)}/species/${encodeURIComponent(speciesId)}`;

  try {
    const response = await fetch(url, {
      method,
      headers: buildJsonHeaders(req),
      body: method === 'PUT' ? JSON.stringify(body || {}) : undefined,
    });

    const data = await parseProxyJsonResponse(response, {
      invalidMessage: '自留地鸟种接口响应解析失败',
      invalidCode: 'UPSTREAM_INVALID_RESPONSE',
    });

    return res.status(response.status).json(data);
  } catch (error) {
    return sendProxyError(res, error, {
      message: '自留地服务暂不可用',
      code: 'PERSONAL_PLOTS_PROXY_FAILED',
    });
  }
}
