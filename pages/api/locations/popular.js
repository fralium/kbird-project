// Next.js API代理路由 - 热门地点
import { resolveBackendApiBase } from '../../../utils/backendApiBase';
import { devLog } from '../../../utils/devLogger';
import { buildJsonHeaders, parseProxyJsonResponse, sendMethodNotAllowed, sendProxyError } from '../../../utils/proxyApi';

export default async function handler(req, res) {
  const { method, query } = req;
  
  if (method !== 'GET') {
    return sendMethodNotAllowed(res, ['GET']);
  }
  
  // 构建后端API URL
  const baseUrl = resolveBackendApiBase();
  const url = `${baseUrl}/locations/popular`;
  
  try {
    // 构建查询参数
    const queryParams = new URLSearchParams();
    Object.keys(query).forEach(key => {
      if (query[key] !== undefined) {
        queryParams.append(key, query[key]);
      }
    });
    
    const fullUrl = queryParams.toString() ? `${url}?${queryParams.toString()}` : url;
    
    devLog('热门地点API请求:', fullUrl);
    
    const response = await fetch(fullUrl, {
      method: 'GET',
      headers: buildJsonHeaders(req),
    });
    
    const data = await parseProxyJsonResponse(response);
    
    if (!response.ok) {
      return res.status(response.status).json(data);
    }
    
    devLog('热门地点API响应:', data);
    res.status(200).json(data);
    
  } catch (error) {
    return sendProxyError(res, error, {
      message: '获取热门地点失败',
      code: 'POPULAR_LOCATIONS_PROXY_FAILED',
    });
  }
}
