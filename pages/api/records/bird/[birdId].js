// Next.js API代理路由 - 获取特定鸟类的观鸟记录
import { resolveBackendApiBase } from '@/utils/backendApiBase';
import { buildJsonHeaders, parseProxyJsonResponse, sendMethodNotAllowed, sendProxyError } from '@/utils/proxyApi';

export default async function handler(req, res) {
  const { method, query } = req;
  
  if (method !== 'GET') {
    return sendMethodNotAllowed(res, ['GET']);
  }
  
  const { birdId } = query;
  
  if (!birdId) {
    return res.status(400).json({
      success: false,
      message: '缺少鸟类ID',
      code: 'MISSING_BIRD_ID',
    });
  }
  
  // 构建后端API URL
  const baseUrl = resolveBackendApiBase();
  const restQuery = { ...req.query };
  delete restQuery.birdId;
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
  const url = `${baseUrl}/records/bird/${birdId}${params.toString() ? `?${params.toString()}` : ''}`;
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: buildJsonHeaders(req),
    });
    
    const data = await parseProxyJsonResponse(response, {
      invalidMessage: '鸟类记录响应解析失败',
      invalidCode: 'UPSTREAM_INVALID_RESPONSE',
    });
    
    res.status(response.status).json(data);
  } catch (error) {
    return sendProxyError(res, error, {
      message: '服务器错误',
      code: 'BIRD_RECORDS_PROXY_FAILED',
    });
  }
}










