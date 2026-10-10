import { resolveBackendApiBase } from '../../../../utils/backendApiBase';
import {
  buildJsonHeaders,
  parseProxyJsonResponse,
  sendMethodNotAllowed,
  sendProxyError,
} from '../../../../utils/proxyApi';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return sendMethodNotAllowed(res, ['POST']);
  }
  const baseUrl = resolveBackendApiBase();
  const url = `${baseUrl}/personal/folder-photos/apply`;
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: buildJsonHeaders(req),
      body: JSON.stringify(req.body || {}),
    });
    const data = await parseProxyJsonResponse(response, {
      invalidMessage: '分类照片上传响应解析失败',
      invalidCode: 'UPSTREAM_INVALID_RESPONSE',
    });
    return res.status(response.status).json(data);
  } catch (error) {
    return sendProxyError(res, error, {
      message: '分类照片上传暂不可用',
      code: 'FOLDER_PHOTOS_APPLY_PROXY_FAILED',
    });
  }
}
