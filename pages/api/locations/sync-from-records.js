// Next.js API 代理 - 地点同步（从观鸟记录同步到地点名录）
import { resolveBackendApiBase } from '@/utils/backendApiBase';
import { buildJsonHeaders, parseProxyJsonResponse, sendMethodNotAllowed, sendProxyError } from '@/utils/proxyApi';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return sendMethodNotAllowed(res, ['POST']);
  }

  const baseUrl = resolveBackendApiBase();
  const url = `${baseUrl}/locations/sync-from-records`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: buildJsonHeaders(req),
      body: JSON.stringify(req.body || {}),
    });
    const data = await parseProxyJsonResponse(response);
    res.status(response.status).json(data);
  } catch (error) {
    return sendProxyError(res, error, {
      message: '地点同步请求失败',
      code: 'SYNC_LOCATIONS_PROXY_FAILED',
    });
  }
}
