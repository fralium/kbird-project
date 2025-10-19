// Next.js API代理路由 - 用户头像上传
export default async function handler(req, res) {
  const { method } = req;
  
  if (method !== 'POST') {
    return res.status(405).json({
      success: false,
      message: '方法不允许'
    });
  }
  
  // 构建后端API URL
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';
  const url = `${baseUrl}/api/users/avatar`;
  
  try {
    // 准备请求头
    const headers = {
      'Authorization': req.headers.authorization || '',
    };
    
    // 不要手动设置Content-Type，让fetch自动处理multipart/form-data
    console.log('代理请求信息:', {
      url,
      headers,
      hasBody: !!req.body,
      contentType: req.headers['content-type']
    });
    
    // 直接转发请求体到后端API
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: req.body, // 直接转发原始请求体
    });
    
    const data = await response.json();
    
    res.status(response.status).json(data);
  } catch (error) {
    console.error('头像上传代理错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误',
      error: error.message,
    });
  }
}

// 禁用默认的body解析器，让Next.js保持原始请求体
export const config = {
  api: {
    bodyParser: false,
  },
}