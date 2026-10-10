/**
 * 代理：按名称获取地点 GET /api/locations/by-name?name=xxx
 */
import { resolveBackendApiBase } from '../../../utils/backendApiBase';
import {
  buildJsonHeaders,
  parseProxyJsonResponse,
  sendMethodNotAllowed,
  sendProxyError,
} from '../../../utils/proxyApi';

const baseUrl = resolveBackendApiBase();

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return sendMethodNotAllowed(res, ['GET']);
  }
  const name = (req.query.name || '').trim();
  if (!name) {
    return res.status(400).json({
      success: false,
      message: '请提供 name 参数',
      code: 'MISSING_LOCATION_NAME',
    });
  }

  try {
    const response = await fetch(`${baseUrl}/locations/by-name?name=${encodeURIComponent(name)}`, {
      headers: buildJsonHeaders(req),
    });
    const data = await parseProxyJsonResponse(response, {
      invalidMessage: '响应解析失败',
      invalidCode: 'UPSTREAM_INVALID_RESPONSE',
    });
    res.status(response.status).json(data);
  } catch (e) {
    return sendProxyError(res, e, {
      message: '服务器错误',
      code: 'LOCATION_BY_NAME_PROXY_FAILED',
    });
  }
}
