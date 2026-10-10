// Next.js API代理路由 - 单个观鸟记录
import { resolveBackendApiBase } from '../../../utils/backendApiBase';
import {
  buildJsonHeaders,
  parseProxyJsonResponse,
  sendMethodNotAllowed,
  sendProxyError,
} from '../../../utils/proxyApi';

export default async function handler(req, res) {
  const { method, query, body } = req;
  if (!['GET', 'PUT', 'DELETE'].includes(method)) {
    return sendMethodNotAllowed(res, ['GET', 'PUT', 'DELETE']);
  }
  if (!query?.id) {
    return res.status(400).json({
      success: false,
      message: '缺少记录ID',
      code: 'MISSING_RECORD_ID',
    });
  }
  
  // 构建后端API URL
  const baseUrl = resolveBackendApiBase();
  const url = `${baseUrl}/records/${query.id}`;
  
  try {
    const response = await fetch(url, {
      method,
      headers: buildJsonHeaders(req),
      body: method !== 'GET' ? JSON.stringify(body) : undefined,
    });
    const data = await parseProxyJsonResponse(response, {
      invalidMessage: '记录详情响应解析失败',
      invalidCode: 'UPSTREAM_INVALID_RESPONSE',
    });

    res.status(response.status).json(data);
  } catch (error) {
    return sendProxyError(res, error, {
      message: '服务器错误',
      code: 'RECORD_PROXY_FAILED',
    });
  }
}
