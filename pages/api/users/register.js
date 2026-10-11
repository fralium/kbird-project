// Next.js API代理路由 - 用户注册
import { resolveBackendApiBase } from '@/utils/backendApiBase';
import { parseProxyJsonResponse, sendMethodNotAllowed, sendProxyError } from '@/utils/proxyApi';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return sendMethodNotAllowed(res, ['POST']);
  }
  
  const baseUrl = resolveBackendApiBase();
  const url = `${baseUrl}/users/register`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(req.body),
    });
    
    const data = await parseProxyJsonResponse(response);
    
    res.status(response.status).json(data);
  } catch (error) {
    return sendProxyError(res, error, {
      message: '服务器错误',
      code: 'REGISTER_PROXY_FAILED',
    });
  }
}