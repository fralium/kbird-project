import { resolveBackendApiBase } from '../../../../../../../utils/backendApiBase';
import {
  buildJsonHeaders,
  sendMethodNotAllowed,
  sendProxyError,
} from '../../../../../../../utils/proxyApi';

export const config = {
  api: {
    responseLimit: false,
  },
};

export default async function handler(req, res) {
  const { method, query } = req;
  if (method !== 'GET') {
    return sendMethodNotAllowed(res, ['GET']);
  }

  const { id, assetId } = query;
  if (!id || !assetId) {
    return res.status(400).json({ success: false, message: '缺少参数' });
  }

  const baseUrl = resolveBackendApiBase();
  const url = `${baseUrl}/personal/projects/${encodeURIComponent(id)}/assets/${encodeURIComponent(assetId)}/file`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: buildJsonHeaders(req),
    });

    if (!response.ok) {
      const text = await response.text();
      let data = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = { success: false, message: '下载失败' };
      }
      return res.status(response.status).json(data);
    }

    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    const disposition = response.headers.get('content-disposition');
    res.setHeader('Content-Type', contentType);
    if (disposition) res.setHeader('Content-Disposition', disposition);

    const buffer = Buffer.from(await response.arrayBuffer());
    return res.status(200).send(buffer);
  } catch (error) {
    return sendProxyError(res, error, {
      message: '项目文件下载暂不可用',
      code: 'PERSONAL_PROJECT_FILE_PROXY_FAILED',
    });
  }
}
