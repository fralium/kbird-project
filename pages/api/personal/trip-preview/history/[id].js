import { resolveBackendApiBase } from '../../../../../utils/backendApiBase';
import {
  buildJsonHeaders,
  parseProxyJsonResponse,
  sendMethodNotAllowed,
  sendProxyError,
} from '../../../../../utils/proxyApi';

export default async function handler(req, res) {
  const { method, query } = req;
  if (!['GET', 'DELETE'].includes(method)) {
    return sendMethodNotAllowed(res, ['GET', 'DELETE']);
  }

  const id = Array.isArray(query?.id) ? query.id[0] : query?.id;
  if (!id) {
    return res.status(400).json({ success: false, message: '缺少历史记录 ID' });
  }

  const baseUrl = resolveBackendApiBase();
  const url = `${baseUrl}/personal/trip-preview/history/${encodeURIComponent(id)}`;

  try {
    const response = await fetch(url, {
      method,
      headers: buildJsonHeaders(req),
    });
    const data = await parseProxyJsonResponse(response, {
      invalidMessage: '对照历史接口响应解析失败',
      invalidCode: 'UPSTREAM_INVALID_RESPONSE',
    });
    return res.status(response.status).json(data);
  } catch (error) {
    return sendProxyError(res, error, {
      message: '对照历史服务暂不可用',
      code: 'TRIP_PREVIEW_HISTORY_PROXY_FAILED',
    });
  }
}
