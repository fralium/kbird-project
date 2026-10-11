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
  const { id, imageIndex } = query;

  if (method !== 'PUT') {
    return sendMethodNotAllowed(res, ['PUT']);
  }

  if (!id || imageIndex === undefined) {
    return res.status(400).json({
      success: false,
      message: '缺少主图设置参数',
      code: 'MISSING_IMAGE_PARAMS',
    });
  }

  try {
    const response = await fetch(
      `${API_BASE_URL}/birds/${id}/images/${imageIndex}/set-main`,
      {
        method: 'PUT',
        headers: buildJsonHeaders(req),
      }
    );

    const data = await parseProxyJsonResponse(response, {
      invalidMessage: '设置主图响应解析失败',
      invalidCode: 'UPSTREAM_INVALID_RESPONSE',
    });
    return res.status(response.status).json(data);
  } catch (error) {
    return sendProxyError(res, error, {
      message: '服务器错误',
      code: 'BIRD_SET_MAIN_IMAGE_PROXY_FAILED',
    });
  }
}
