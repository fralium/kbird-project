import axios from 'axios';

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3002/api';

export default async function handler(req, res) {
  const { method } = req;
  const token = req.headers.authorization;
  
  // 设置缓存控制头，防止缓存问题
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Last-Modified', new Date().toUTCString());

  try {
    let response;
    
    switch (method) {
      case 'GET':
        // 获取用户收藏的鸟类
        response = await axios.get(`${API_BASE_URL}/users/favorites`, {
          headers: {
            'Authorization': token,
            'Content-Type': 'application/json',
          },
        });
        break;
        
      default:
        res.setHeader('Allow', ['GET']);
        return res.status(405).json({ 
          success: false, 
          message: `方法 ${method} 不被允许` 
        });
    }

    res.status(response.status).json(response.data);
  } catch (error) {
    console.error('API代理错误:', error.response?.data || error.message);
    
    if (error.response) {
      res.status(error.response.status).json(error.response.data);
    } else {
      res.status(500).json({
        success: false,
        message: '服务器错误',
        error: error.message,
      });
    }
  }
}