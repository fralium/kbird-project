// Next.js API代理路由 - 申请添加新鸟类
export default async function handler(req, res) {
  const { method, body } = req;
  
  if (method !== 'POST') {
    return res.status(405).json({
      success: false,
      message: '方法不允许'
    });
  }
  
  // 构建后端API URL
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';
  const url = `${baseUrl}/api/birds/request-new`;
  
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
      body: JSON.stringify(body),
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
