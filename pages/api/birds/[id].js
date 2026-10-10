// Next.js API代理路由 - 单个鸟类API
import { resolveBackendApiBase } from '../../../utils/backendApiBase';
import { buildJsonHeaders, parseProxyJsonResponse, sendProxyError } from '../../../utils/proxyApi';

export default async function handler(req, res) {
  const { method, query, body } = req;
  
  // 设置缓存控制头，防止缓存问题
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Last-Modified', new Date().toUTCString());
  
  // 构建后端API URL
  const baseUrl = resolveBackendApiBase();
  const url = `${baseUrl}/birds/${query.id}`;
  
  try {
    const response = await fetch(url, {
      method,
      headers: buildJsonHeaders(req),
      body: method !== 'GET' ? JSON.stringify(body) : undefined,
    });
    
    const data = await parseProxyJsonResponse(response);
    
    res.status(response.status).json(data);
  } catch (error) {
    return sendProxyError(res, error, {
      message: '服务器错误',
      code: 'BIRD_DETAIL_PROXY_FAILED',
    });
  }
}

