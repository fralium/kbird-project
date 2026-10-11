import { resolveBackendApiBase } from '@/utils/backendApiBase';
import {
  buildJsonHeaders,
  parseProxyJsonResponse,
  sendMethodNotAllowed,
  sendProxyError,
} from '@/utils/proxyApi';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '50mb',
    },
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return sendMethodNotAllowed(res, ['POST']);
  }

  const baseUrl = resolveBackendApiBase();
  const url = `${baseUrl}/personal/backup/restore/preview`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: buildJsonHeaders(req),
      body: JSON.stringify(req.body || {}),
    });

    const data = await parseProxyJsonResponse(response, {
      invalidMessage: '备份预览接口响应解析失败',
      invalidCode: 'UPSTREAM_INVALID_RESPONSE',
    });

    return res.status(response.status).json(data);
  } catch (error) {
    return sendProxyError(res, error, {
      message: '备份预览服务暂不可用',
      code: 'PERSONAL_BACKUP_PREVIEW_PROXY_FAILED',
    });
  }
}
