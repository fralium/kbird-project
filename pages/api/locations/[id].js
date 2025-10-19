// Next.js API代理路由 - 地点详情和编辑
export default async function handler(req, res) {
  const { id } = req.query;
  const method = req.method;
  
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';
  const url = `${baseUrl}/api/locations/${id}`;
  
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
          message: '未提供认证令牌'
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
          message: '未提供认证令牌'
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
      return res.status(405).json({
        success: false,
        message: 'Method not allowed'
      });
    }
    
    const data = await response.json();
    
    // 添加缓存控制头
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Last-Modified', new Date().toUTCString());
    
    res.status(response.status).json(data);
  } catch (error) {
    console.error('地点API代理错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误',
      error: error.message,
    });
  }
}