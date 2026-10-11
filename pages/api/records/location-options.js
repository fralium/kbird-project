import { resolveBackendApiBase } from '@/utils/backendApiBase';
import {
  buildJsonHeaders,
  parseProxyJsonResponse,
  sendMethodNotAllowed,
  sendProxyError,
} from '@/utils/proxyApi';

export default async function handler(req, res) {
  const { method } = req;
  if (method !== 'GET') {
    return sendMethodNotAllowed(res, ['GET']);
  }

  const baseUrl = resolveBackendApiBase();
  const url = `${baseUrl}/records/location-options`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: buildJsonHeaders(req),
    });

    const data = await parseProxyJsonResponse(response, {
      invalidMessage: '地点筛选接口响应解析失败',
      invalidCode: 'UPSTREAM_INVALID_RESPONSE',
    });

    return res.status(response.status).json(data);
  } catch (error) {
    return sendProxyError(res, error, {
      message: '获取地点筛选选项失败',
      code: 'RECORD_LOCATION_OPTIONS_PROXY_FAILED',
    });
  }
}
