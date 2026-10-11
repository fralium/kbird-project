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
  const url = `${baseUrl}/personal/checklist/taxonomy`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: buildJsonHeaders(req),
    });

    const data = await parseProxyJsonResponse(response, {
      invalidMessage: '名录进度接口响应解析失败',
      invalidCode: 'UPSTREAM_INVALID_RESPONSE',
    });

    return res.status(response.status).json(data);
  } catch (error) {
    return sendProxyError(res, error, {
      message: '名录进度服务暂不可用',
      code: 'PERSONAL_CHECKLIST_TAXONOMY_PROXY_FAILED',
    });
  }
}
