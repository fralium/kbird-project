import { resolveBackendApiBase } from '../../../../utils/backendApiBase';
import {
  buildJsonHeaders,
  sendMethodNotAllowed,
  sendProxyError,
} from '../../../../utils/proxyApi';

export const config = {
  api: {
    responseLimit: false,
  },
};

async function proxyExport(req, res, backendPath) {
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

  const qs = params.toString();
  const url = `${baseUrl}${backendPath}${qs ? `?${qs}` : ''}`;

  try {
    const init = {
      method: req.method,
      headers: buildJsonHeaders(req),
    };
    if (req.method === 'POST') {
      init.body = JSON.stringify(req.body || {});
    }

    const response = await fetch(url, init);
    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    const disposition = response.headers.get('content-disposition');
    const exportCount = response.headers.get('x-export-count');
    const buf = Buffer.from(await response.arrayBuffer());

    res.status(response.status);
    res.setHeader('Content-Type', contentType);
    if (disposition) res.setHeader('Content-Disposition', disposition);
    if (exportCount) res.setHeader('X-Export-Count', exportCount);
    return res.send(buf);
  } catch (error) {
    return sendProxyError(res, error, {
      message: '导出服务暂不可用',
      code: 'PERSONAL_EXPORT_PROXY_FAILED',
    });
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return sendMethodNotAllowed(res, ['GET', 'POST']);
  }
  return proxyExport(req, res, '/personal/export/ebird');
}
