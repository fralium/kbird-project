import { resolveBackendApiBase } from '../../../../../utils/backendApiBase';
import {
  buildJsonHeaders,
  parseProxyJsonResponse,
  sendMethodNotAllowed,
  sendProxyError,
} from '../../../../../utils/proxyApi';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '20mb',
    },
  },
};

export default async function handler(req, res) {
  const { method, query } = req;
  if (method !== 'POST') {
    return sendMethodNotAllowed(res, ['POST']);
  }

  const id = Array.isArray(query.id) ? query.id[0] : query.id;
  if (!id) {
    return res.status(400).json({
      success: false,
      message: '缺少清单 ID',
      code: 'MISSING_REGION_LIST_ID',
    });
  }

  const baseUrl = resolveBackendApiBase();
  const url = `${baseUrl}/region-lists/${id}/versions/preview`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: buildJsonHeaders(req),
      body: JSON.stringify(req.body || {}),
    });
    const data = await parseProxyJsonResponse(response, {
      invalidMessage: '版本对比接口响应解析失败',
      invalidCode: 'UPSTREAM_INVALID_RESPONSE',
    });
    return res.status(response.status).json(data);
  } catch (error) {
    return sendProxyError(res, error, {
      message: '版本对比服务暂不可用',
      code: 'REGION_LIST_VERSION_PREVIEW_PROXY_FAILED',
    });
  }
}
