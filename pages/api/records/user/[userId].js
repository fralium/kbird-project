// Next.js API代理路由 - 获取用户观鸟记录
import { resolveBackendApiBase } from '@/utils/backendApiBase';
import {
  buildJsonHeaders,
  parseProxyJsonResponse,
  sendMethodNotAllowed,
  sendProxyError,
} from '@/utils/proxyApi';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return sendMethodNotAllowed(res, ['GET']);
  }

  const { userId, ...restQuery } = req.query;
  if (!userId) {
    return res.status(400).json({
      success: false,
      message: '缺少用户ID',
      code: 'MISSING_USER_ID',
    });
  }

  const params = new URLSearchParams();
  Object.entries(restQuery).forEach(([key, value]) => {
    if (value == null || value === '') return;
    if (Array.isArray(value)) {
      value.forEach((item) => {
        if (item != null && item !== '') params.append(key, String(item));
      });
      return;
    }
    params.append(key, String(value));
  });

  const baseUrl = resolveBackendApiBase();
  const url = `${baseUrl}/records/user/${encodeURIComponent(String(userId))}${
    params.toString() ? `?${params.toString()}` : ''
  }`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: buildJsonHeaders(req),
    });
    const data = await parseProxyJsonResponse(response, {
      invalidMessage: '用户记录响应解析失败',
      invalidCode: 'UPSTREAM_INVALID_RESPONSE',
    });
    return res.status(response.status).json(data);
  } catch (error) {
    return sendProxyError(res, error, {
      message: '获取用户观鸟记录失败',
      code: 'USER_RECORDS_PROXY_FAILED',
    });
  }
}
