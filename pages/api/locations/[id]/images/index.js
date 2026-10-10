import { resolveBackendApiBase } from '../../../../../utils/backendApiBase';
import {
  buildJsonHeaders,
  parseProxyJsonResponse,
  sendMethodNotAllowed,
  sendProxyError,
} from '../../../../../utils/proxyApi';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return sendMethodNotAllowed(res, ['POST']);
  }

  const { id } = req.query;
  const token = req.headers.authorization;
  if (!token) {
    return res.status(401).json({
      success: false,
      message: '未提供认证令牌',
      code: 'MISSING_AUTH_TOKEN',
    });
  }

  try {
    const response = await fetch(`${resolveBackendApiBase()}/locations/${id}/images`, {
      method: 'POST',
      headers: buildJsonHeaders(req),
      body: JSON.stringify(req.body || {}),
    });
    const data = await parseProxyJsonResponse(response, {
      invalidMessage: '生境照片响应解析失败',
      invalidCode: 'UPSTREAM_INVALID_RESPONSE',
    });
    return res.status(response.status).json(data);
  } catch (error) {
    return sendProxyError(res, error, {
      message: '添加生境照片失败',
      code: 'LOCATION_IMAGE_PROXY_FAILED',
    });
  }
}
