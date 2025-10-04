// Next.js API代理路由 - 鸟类图片上传
export default async function handler(req, res) {
  const { method, query, body, headers } = req;
  
  if (method !== 'POST') {
    return res.status(405).json({
      success: false,
      message: '方法不允许'
    });
  }
  
  // 构建后端API URL
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';
  const url = `${baseUrl}/api/birds/${query.id}/images`;
  
  try {
    // 获取原始请求的FormData
    const formData = new FormData();
    
    // 如果有文件上传，需要特殊处理
    if (req.body && typeof req.body === 'object') {
      // 这里需要重新构建FormData
      // 由于Next.js API的限制，我们需要使用不同的方法
    }
    
    // 转发请求到后端
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': headers.authorization,
        // 不设置Content-Type，让fetch自动处理FormData
      },
      body: req.body, // 直接转发原始body
    });

    const data = await response.json();
    
    res.status(response.status).json(data);
  } catch (error) {
    console.error('图片上传代理错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误',
      error: error.message
    });
  }
}