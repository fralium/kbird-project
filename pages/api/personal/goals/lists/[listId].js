import { resolveBackendApiBase } from '../../../../../utils/backendApiBase';
import {
  buildJsonHeaders,
  parseProxyJsonResponse,
  sendMethodNotAllowed,
  sendProxyError,
} from '../../../../../utils/proxyApi';

export default async function handler(req, res) {
  const { method, query } = req;
  if (method !== 'DELETE') {
    return sendMethodNotAllowed(res, ['DELETE']);
  }

  const listId = String(query.listId || '');
  if (!listId) {
    return res.status(400).json({ success: false, message: '缺少列表 id' });
  }

  const baseUrl = resolveBackendApiBase();
  const url = `${baseUrl}/personal/goals/lists/${encodeURIComponent(listId)}`;

  try {
    const response = await fetch(url, {
      method: 'DELETE',
      headers: buildJsonHeaders(req),
    });
    const data = await parseProxyJsonResponse(response, {
      invalidMessage: '目标列表接口响应解析失败',
      invalidCode: 'UPSTREAM_INVALID_RESPONSE',
    });
    return res.status(response.status).json(data);
  } catch (error) {
    return sendProxyError(res, error, {
      message: '目标列表服务暂不可用',
      code: 'PERSONAL_GOALS_LISTS_PROXY_FAILED',
    });
  }
}
