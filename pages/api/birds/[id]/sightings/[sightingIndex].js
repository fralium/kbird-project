import { resolveBackendApiBase } from '@/utils/backendApiBase';
import {
  buildJsonHeaders,
  parseProxyJsonResponse,
  sendMethodNotAllowed,
  sendProxyError,
} from '@/utils/proxyApi';

const API_BASE_URL = `${resolveBackendApiBase()}`;

export default async function handler(req, res) {
  const { method, query } = req;
  const { id, sightingIndex } = query;

  if (!['PUT', 'DELETE'].includes(method)) {
    return sendMethodNotAllowed(res, ['PUT', 'DELETE']);
  }

  if (!id || sightingIndex === undefined) {
    return res.status(400).json({
      success: false,
      message: '缺少观测记录参数',
      code: 'MISSING_SIGHTING_PARAMS',
    });
  }

  try {
    const response = await fetch(`${API_BASE_URL}/birds/${id}/sightings/${sightingIndex}`, {
      method,
      headers: buildJsonHeaders(req),
      body: method === 'PUT' ? JSON.stringify(req.body) : undefined,
    });

    const data = await parseProxyJsonResponse(response, {
      invalidMessage: '鸟类观测响应解析失败',
      invalidCode: 'UPSTREAM_INVALID_RESPONSE',
    });
    return res.status(response.status).json(data);
  } catch (error) {
    return sendProxyError(res, error, {
      message: '服务器错误',
      code: 'BIRD_SIGHTING_ITEM_PROXY_FAILED',
    });
  }
}










