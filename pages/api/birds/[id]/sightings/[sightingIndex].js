import axios from 'axios';

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3002/api';

export default async function handler(req, res) {
  const { method, query } = req;
  const { id, sightingIndex } = query;
  const token = req.headers.authorization;

  try {
    let response;
    
    switch (method) {
      case 'PUT':
        // 更新鸟类观察记录信息
        response = await axios.put(`${API_BASE_URL}/birds/${id}/sightings/${sightingIndex}`, req.body, {
          headers: {
            'Authorization': token,
            'Content-Type': 'application/json',
          },
        });
        break;
        
      case 'DELETE':
        // 删除鸟类观察记录
        response = await axios.delete(`${API_BASE_URL}/birds/${id}/sightings/${sightingIndex}`, {
          headers: {
            'Authorization': token,
            'Content-Type': 'application/json',
          },
        });
        break;
        
      default:
        res.setHeader('Allow', ['PUT', 'DELETE']);
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








