import { resolveBackendApiBase } from '../../../../utils/backendApiBase';
import {
  buildJsonHeaders,
  parseProxyJsonResponse,
  sendMethodNotAllowed,
  sendProxyError,
} from '../../../../utils/proxyApi';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return sendMethodNotAllowed(res, ['GET']);
  }

  const baseUrl = resolveBackendApiBase();
  const params = new URLSearchParams();
  const name = req.query?.name;
  const locationId = req.query?.locationId;
  if (name) params.set('name', String(Array.isArray(name) ? name[0] : name));
  if (locationId) params.set('locationId', String(Array.isArray(locationId) ? locationId[0] : locationId));
  const url = `${baseUrl}/personal/trip-preview/location-past${params.toString() ? `?${params}` : ''}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: buildJsonHeaders(req),
    });
    const data = await parseProxyJsonResponse(response, {
      invalidMessage: '地点过往观察接口响应解析失败',
      invalidCode: 'UPSTREAM_INVALID_RESPONSE',
    });
    return res.status(response.status).json(data);
  } catch (error) {
    return sendProxyError(res, error, {
      message: '地点过往观察暂不可用',
      code: 'TRIP_PREVIEW_LOCATION_PAST_PROXY_FAILED',
    });
  }
}
