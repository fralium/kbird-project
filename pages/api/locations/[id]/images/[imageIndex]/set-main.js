import { resolveBackendApiBase } from '@/utils/backendApiBase';
import {
  buildJsonHeaders,
  parseProxyJsonResponse,
  sendMethodNotAllowed,
  sendProxyError,
} from '@/utils/proxyApi';

export default async function handler(req, res) {
  if (req.method !== 'PUT') {
    return sendMethodNotAllowed(res, ['PUT']);
  }

  const { id, imageIndex } = req.query;
  const token = req.headers.authorization;
  if (!token) {
    return res.status(401).json({
      success: false,
      message: '未提供认证令牌',
      code: 'MISSING_AUTH_TOKEN',
    });
  }

  try {
    const response = await fetch(
      `${resolveBackendApiBase()}/locations/${id}/images/${encodeURIComponent(imageIndex)}/set-main`,
      {
        method: 'PUT',
        headers: buildJsonHeaders(req),
        body: JSON.stringify(req.body || {}),
      }
    );
    const data = await parseProxyJsonResponse(response, {
      invalidMessage: '设置封面响应解析失败',
      invalidCode: 'UPSTREAM_INVALID_RESPONSE',
    });
    return res.status(response.status).json(data);
  } catch (error) {
    return sendProxyError(res, error, {
      message: '设置封面失败',
      code: 'LOCATION_IMAGE_COVER_PROXY_FAILED',
    });
  }
}
