import { useAuth } from './useAuth';
import apiCache from './apiCache';

class ApiClient {
  constructor() {
    this.baseURL = process.env.NEXT_PUBLIC_API_URL || '';
    this.defaultHeaders = {
      'Content-Type': 'application/json',
    };
    this.cache = apiCache;
  }

  // 设置认证token
  setAuthToken(token) {
    if (token) {
      this.defaultHeaders['Authorization'] = `Bearer ${token}`;
    } else {
      delete this.defaultHeaders['Authorization'];
    }
  }

  // 通用请求方法
  async request(endpoint, options = {}) {
    const url = endpoint.startsWith('http') ? endpoint : `${this.baseURL}${endpoint}`;
    const method = options.method || 'GET';
    
    // 检查缓存（仅GET请求）
    if (method === 'GET' && !options.skipCache) {
      const cachedData = this.cache.get(url, options);
      if (cachedData) {
        return cachedData;
      }
    }
    
    const config = {
      headers: { ...this.defaultHeaders, ...options.headers },
      ...options,
    };

    try {
      const response = await fetch(url, config);
      
      // 处理401未授权
      if (response.status === 401) {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('token');
          window.location.href = '/login';
        }
        throw new Error('未授权访问');
      }

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || `HTTP错误: ${response.status}`);
      }

      // 缓存GET请求结果
      if (method === 'GET' && !options.skipCache) {
        this.cache.set(url, options, data);
      }

      return data;
    } catch (error) {
      console.error(`API请求失败 [${endpoint}]:`, error);
      throw error;
    }
  }

  // GET请求
  async get(endpoint, params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const url = queryString ? `${endpoint}?${queryString}` : endpoint;
    return this.request(url, { method: 'GET' });
  }

  // POST请求
  async post(endpoint, data = {}) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // PUT请求
  async put(endpoint, data = {}) {
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // DELETE请求
  async delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' });
  }

  // 文件上传
  async upload(endpoint, formData) {
    const headers = { ...this.defaultHeaders };
    delete headers['Content-Type']; // 让浏览器设置multipart/form-data边界

    return this.request(endpoint, {
      method: 'POST',
      headers,
      body: formData,
    });
  }
}

// 创建单例实例
const apiClient = new ApiClient();

// 导出实例和Hook
export { apiClient };

// React Hook for API client with auth
export const useApiClient = () => {
  const { token, getAuthHeaders } = useAuth();

  // 更新API客户端的认证头
  React.useEffect(() => {
    if (token) {
      apiClient.setAuthToken(token);
    }
  }, [token]);

  return apiClient;
};
