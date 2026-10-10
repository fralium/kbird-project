// Next.js API 代理 - 地点统计小结
import { resolveBackendApiBase } from '../../../utils/backendApiBase';
import { parseProxyJsonResponse, sendMethodNotAllowed, sendProxyError } from '../../../utils/proxyApi';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return sendMethodNotAllowed(res, ['GET']);
  }
  const baseUrl = resolveBackendApiBase();
  try {
    const response = await fetch(`${baseUrl}/locations/summary`);
    const data = await parseProxyJsonResponse(response);
    res.status(response.status).json(data);
  } catch (error) {
    return sendProxyError(res, error, {
      message: '获取地点小结失败',
      code: 'LOCATION_SUMMARY_PROXY_FAILED',
    });
  }
}
