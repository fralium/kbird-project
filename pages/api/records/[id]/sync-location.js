/**
 * 代理：从地点名录同步坐标到观鸟记录 PUT /api/records/:id/sync-location
 */
import { resolveBackendApiBase } from '@/utils/backendApiBase';
import {
  buildJsonHeaders,
  parseProxyJsonResponse,
  sendMethodNotAllowed,
  sendProxyError,
} from '@/utils/proxyApi';

const baseUrl = resolveBackendApiBase();

export default async function handler(req, res) {
  if (req.method !== 'PUT') {
    return sendMethodNotAllowed(res, ['PUT']);
  }
  const { id } = req.query;
  if (!id) {
    return res.status(400).json({
      success: false,
      message: '缺少记录 ID',
      code: 'MISSING_RECORD_ID',
    });
  }

  try {
    const response = await fetch(`${baseUrl}/records/${id}/sync-location`, {
      method: 'PUT',
      headers: buildJsonHeaders(req),
    });
    const data = await parseProxyJsonResponse(response, {
      invalidMessage: '请求失败',
      invalidCode: 'UPSTREAM_INVALID_RESPONSE',
    });
    res.status(response.status).json(data);
  } catch (e) {
    return sendProxyError(res, e, {
      message: '服务器错误',
      code: 'SYNC_RECORD_LOCATION_PROXY_FAILED',
    });
  }
}
