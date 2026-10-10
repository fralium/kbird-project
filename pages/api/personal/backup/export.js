import { resolveBackendApiBase } from '../../../../utils/backendApiBase';
import {
  buildJsonHeaders,
  sendMethodNotAllowed,
  sendProxyError,
} from '../../../../utils/proxyApi';

export const config = {
  api: {
    bodyParser: false,
    responseLimit: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return sendMethodNotAllowed(res, ['GET']);
  }

  const baseUrl = resolveBackendApiBase();
  const params = new URLSearchParams();
  Object.keys(req.query || {}).forEach((key) => {
    const value = req.query[key];
    if (value == null || value === '') return;
    if (Array.isArray(value)) {
      value.forEach((item) => {
        if (item != null && item !== '') params.append(key, String(item));
      });
      return;
    }
    params.append(key, String(value));
  });

  const url = `${baseUrl}/personal/backup/export${params.toString() ? `?${params.toString()}` : ''}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: buildJsonHeaders(req),
    });

    const contentType = response.headers.get('content-type') || 'application/json; charset=utf-8';
    const disposition = response.headers.get('content-disposition');
    const buf = Buffer.from(await response.arrayBuffer());

    res.status(response.status);
    res.setHeader('Content-Type', contentType);
    if (disposition) res.setHeader('Content-Disposition', disposition);
    return res.send(buf);
  } catch (error) {
    return sendProxyError(res, error, {
      message: '备份导出服务暂不可用',
      code: 'PERSONAL_BACKUP_EXPORT_PROXY_FAILED',
    });
  }
}
