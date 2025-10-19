// Next.js API代理路由 - 地点相关API
export default async function handler(req, res) {
  const { method, query, body } = req;
  
  // 构建后端API URL
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';
  const url = `${baseUrl}/api/locations`;
  
  // 准备请求头
  const headers = {
    'Content-Type': 'application/json',
  };
  
  // 如果有token，添加到请求头
  if (req.headers.authorization) {
    headers.Authorization = req.headers.authorization;
  }
  
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
      headers,
      body: method !== 'GET' ? JSON.stringify(body) : undefined,
    });
    
    const data = await response.json();
    
    res.status(response.status).json(data);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '服务器错误',
      error: error.message,
    });
  }
}