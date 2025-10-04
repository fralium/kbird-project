// Next.js API代理路由 - 单个观鸟记录
export default async function handler(req, res) {
  const { method, query, body } = req;
  
  // 构建后端API URL
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';
  const url = `${baseUrl}/api/records/${query.id}`;
  
  // 准备请求头
  const headers = {
    'Content-Type': 'application/json',
  };
  
  // 如果有token，添加到请求头
  if (req.headers.authorization) {
    headers.Authorization = req.headers.authorization;
  }
  
  try {
    const response = await fetch(url, {
      method,
      headers,
      body: method !== 'GET' ? JSON.stringify(body) : undefined,
    });
    
    console.log('后端响应状态:', response.status);
    console.log('后端响应头:', response.headers.get('content-type'));
    
    // 检查响应是否为JSON
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const text = await response.text();
      console.log('后端响应文本:', text);
      return res.status(response.status).json({
        success: false,
        message: '服务器返回了非JSON响应',
        error: text,
      });
    }
    
    const data = await response.json();
    console.log('后端响应数据:', data);
    
    res.status(response.status).json(data);
  } catch (error) {
    console.error('API代理错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误',
      error: error.message,
    });
  }
}
