// Next.js API代理路由 - 观鸟记录
import { resolveBackendApiBase } from '../../../utils/backendApiBase';
import {
  buildJsonHeaders,
  parseProxyJsonResponse,
  sendMethodNotAllowed,
  sendProxyError,
} from '../../../utils/proxyApi';

export default async function handler(req, res) {
  const { method, query, body } = req;
  if (!['GET', 'POST'].includes(method)) {
    return sendMethodNotAllowed(res, ['GET', 'POST']);
  }
  
  // 构建后端API URL
  const baseUrl = resolveBackendApiBase();
  const url = `${baseUrl}/records`;
  
  try {
    // 构建查询参数
    const params = new URLSearchParams();
    Object.keys(query).forEach((key) => {
      const value = query[key];
      if (value == null || value === '') return;
      if (Array.isArray(value)) {
        value.forEach((item) => {
          if (item != null && item !== '') params.append(key, String(item));
        });
        return;
      }
      params.append(key, String(value));
    });
    
    const fullUrl = params.toString() ? `${url}?${params.toString()}` : url;
    
    const response = await fetch(fullUrl, {
      method,
      headers: buildJsonHeaders(req),
      body: method !== 'GET' ? JSON.stringify(body) : undefined,
    });
    
    const data = await parseProxyJsonResponse(response, {
      invalidMessage: '记录接口响应解析失败',
      invalidCode: 'UPSTREAM_INVALID_RESPONSE',
    });
    
    res.status(response.status).json(data);
  } catch (error) {
    return sendProxyError(res, error, {
      message: '服务器错误',
      code: 'RECORDS_PROXY_FAILED',
    });
  }
}










