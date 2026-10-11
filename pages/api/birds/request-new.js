// Next.js API代理路由 - 申请添加新鸟类
import { resolveBackendApiBase } from '@/utils/backendApiBase';
import { buildJsonHeaders, parseProxyJsonResponse, sendMethodNotAllowed, sendProxyError } from '@/utils/proxyApi';

export default async function handler(req, res) {
  const { method, body } = req;
  
  if (method !== 'POST') {
    return sendMethodNotAllowed(res, ['POST']);
  }
  
  // 构建后端API URL
  const baseUrl = resolveBackendApiBase();
  const url = `${baseUrl}/birds/request-new`;
  
  try {
    const response = await fetch(url, {
      method,
      headers: buildJsonHeaders(req),
      body: JSON.stringify(body),
    });
    
    const data = await parseProxyJsonResponse(response);
    
    res.status(response.status).json(data);
  } catch (error) {
    return sendProxyError(res, error, {
      message: '服务器错误',
      code: 'BIRD_REQUEST_PROXY_FAILED',
    });
  }
}
