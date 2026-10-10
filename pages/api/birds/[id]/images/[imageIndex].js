import { resolveBackendApiBase } from '../../../../../utils/backendApiBase';
import {
  buildJsonHeaders,
  parseProxyJsonResponse,
  sendMethodNotAllowed,
  sendProxyError,
} from '../../../../../utils/proxyApi';

const API_BASE_URL = `${resolveBackendApiBase()}`;

export default async function handler(req, res) {
  const { method, query } = req;
  const { id, imageIndex } = query;

  if (!['PUT', 'DELETE'].includes(method)) {
    return sendMethodNotAllowed(res, ['PUT', 'DELETE']);
  }

  if (!id || imageIndex === undefined) {
    return res.status(400).json({
      success: false,
      message: '缺少图片更新参数',
      code: 'MISSING_IMAGE_PARAMS',
    });
  }

  try {
    const response = await fetch(`${API_BASE_URL}/birds/${id}/images/${imageIndex}`, {
      method,
      headers: buildJsonHeaders(req),
      body: method === 'PUT' ? JSON.stringify(req.body) : undefined,
    });

    const data = await parseProxyJsonResponse(response, {
      invalidMessage: '鸟类图片响应解析失败',
      invalidCode: 'UPSTREAM_INVALID_RESPONSE',
    });
    return res.status(response.status).json(data);
  } catch (error) {
    return sendProxyError(res, error, {
      message: '服务器错误',
      code: 'BIRD_IMAGE_ITEM_PROXY_FAILED',
    });
  }
}

