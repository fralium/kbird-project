import axios from 'axios';

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3002/api';

export default async function handler(req, res) {
  const { method, query } = req;
  const { id } = query;
  const token = req.headers.authorization;

  try {
    let response;
    
    switch (method) {
      case 'POST':
        // 添加鸟类到收藏
        response = await axios.post(`${API_BASE_URL}/users/favorites/${id}`, {}, {
          headers: {
            'Authorization': token,
            'Content-Type': 'application/json',
          },
        });
        break;
        
      case 'DELETE':
        // 从收藏中移除鸟类
        response = await axios.delete(`${API_BASE_URL}/users/favorites/${id}`, {
          headers: {
            'Authorization': token,
            'Content-Type': 'application/json',
          },
        });
        break;
        
      default:
        res.setHeader('Allow', ['POST', 'DELETE']);
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