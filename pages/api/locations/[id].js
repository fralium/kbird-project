// Next.js API代理路由 - 地点详情和编辑
import { resolveBackendApiBase } from '@/utils/backendApiBase';
import { buildJsonHeaders, parseProxyJsonResponse, sendMethodNotAllowed, sendProxyError } from '@/utils/proxyApi';

export default async function handler(req, res) {
  const { id } = req.query;
  const method = req.method;
  
  const baseUrl = resolveBackendApiBase();
  const url = `${baseUrl}/locations/${id}`;
  
  try {
    let response;
    
    if (method === 'GET') {
      // 获取地点详情
      response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
    } else if (method === 'PUT') {
      // 更新地点信息
      const token = req.headers.authorization;
      
      if (!token) {
        return res.status(401).json({
          success: false,
          message: '未提供认证令牌',
          code: 'MISSING_AUTH_TOKEN',
        });
      }
      
      response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token,
        },
        body: JSON.stringify(req.body),
      });
    } else if (method === 'DELETE') {
      // 删除地点
      const token = req.headers.authorization;
      
      if (!token) {
        return res.status(401).json({
          success: false,
          message: '未提供认证令牌',
          code: 'MISSING_AUTH_TOKEN',
        });
      }
      
      response = await fetch(url, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token,
        },
      });
    } else {
      return sendMethodNotAllowed(res, ['GET', 'PUT', 'DELETE']);
    }
    
    const data = await parseProxyJsonResponse(response);
    
    // 添加缓存控制头
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Last-Modified', new Date().toUTCString());
    
    res.status(response.status).json(data);
  } catch (error) {
    return sendProxyError(res, error, {
      message: '服务器错误',
      code: 'LOCATION_DETAIL_PROXY_FAILED',
    });
  }
}