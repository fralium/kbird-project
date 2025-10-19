// Next.js API代理路由 - 鸟类图片上传
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
}

export default async function handler(req, res) {
  const { method, query, headers } = req;
  
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
    console.log('图片上传代理请求:', {
      url,
      method,
      hasAuth: !!headers.authorization,
      contentType: headers['content-type']
    });

    // 直接转发请求到后端
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': headers.authorization,
        // 保持原始的Content-Type
        'Content-Type': headers['content-type'] || 'multipart/form-data',
      },
      body: req.body, // 直接转发原始body
    });

    console.log('后端响应状态:', response.status);
    
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