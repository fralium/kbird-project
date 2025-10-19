// Next.js API代理路由 - 获取特定鸟类的观鸟记录
export default async function handler(req, res) {
  const { method, query } = req;
  
  if (method !== 'GET') {
    return res.status(405).json({
      success: false,
      message: '方法不允许'
    });
  }
  
  const { birdId } = query;
  
  if (!birdId) {
    return res.status(400).json({
      success: false,
      message: '缺少鸟类ID'
    });
  }
  
  // 构建后端API URL
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';
  const url = `${baseUrl}/api/records/bird/${birdId}?${new URLSearchParams(req.query).toString()}`;
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
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








