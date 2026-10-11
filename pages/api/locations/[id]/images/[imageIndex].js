import { resolveBackendApiBase } from '@/utils/backendApiBase';
import {
  buildJsonHeaders,
  parseProxyJsonResponse,
  sendMethodNotAllowed,
  sendProxyError,
} from '@/utils/proxyApi';

export default async function handler(req, res) {
  if (req.method !== 'DELETE' && req.method !== 'PUT') {
    return sendMethodNotAllowed(res, ['DELETE', 'PUT']);
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

  const isDelete = req.method === 'DELETE';
  try {
    const response = await fetch(
      `${resolveBackendApiBase()}/locations/${id}/images/${encodeURIComponent(imageIndex)}`,
      {
        method: req.method,
        headers: buildJsonHeaders(req),
        body: isDelete ? undefined : JSON.stringify(req.body || {}),
      }
    );
    const data = await parseProxyJsonResponse(response, {
      invalidMessage: isDelete ? '删除生境照片响应解析失败' : '更新生境照片响应解析失败',
      invalidCode: 'UPSTREAM_INVALID_RESPONSE',
    });
    return res.status(response.status).json(data);
  } catch (error) {
    return sendProxyError(res, error, {
      message: isDelete ? '删除生境照片失败' : '更新生境照片失败',
      code: isDelete
        ? 'LOCATION_IMAGE_DELETE_PROXY_FAILED'
        : 'LOCATION_IMAGE_UPDATE_PROXY_FAILED',
    });
  }
}
