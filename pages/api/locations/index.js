// Next.js API代理路由 - 地点相关API
import { resolveBackendApiBase } from '../../../utils/backendApiBase';
import { buildJsonHeaders, parseProxyJsonResponse, sendProxyError } from '../../../utils/proxyApi';

export default async function handler(req, res) {
  const { method, query, body } = req;
  
  // 构建后端API URL
  const baseUrl = resolveBackendApiBase();
  const url = `${baseUrl}/locations`;
  
  try {
    // 构建查询参数
    const params = new URLSearchParams();
    Object.keys(query).forEach(key => {
      if (query[key]) {
        params.append(key, query[key]);
      }
    });
    
    const fullUrl = params.toString() ? `${url}?${params.toString()}` : url;
    
    const response = await fetch(fullUrl, {
      method,
      headers: buildJsonHeaders(req),
      body: method !== 'GET' ? JSON.stringify(body) : undefined,
    });
    
    const data = await parseProxyJsonResponse(response);
    
    res.status(response.status).json(data);
  } catch (error) {
    return sendProxyError(res, error, {
      message: '服务器错误',
      code: 'LOCATIONS_PROXY_FAILED',
    });
  }
}