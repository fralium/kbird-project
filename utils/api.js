// API配置 - 直接调用后端，绕过Next.js代理
const API_BASE_URL = 'http://localhost:3002';

// 请求去重缓存
const pendingRequests = new Map();

// API请求函数
export const apiRequest = async (endpoint, options = {}) => {
  const url = `${API_BASE_URL}${endpoint}`;
  
  // 获取认证token
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  
  const defaultOptions = {
    headers: {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
    },
  };

  const config = {
    ...defaultOptions,
    ...options,
    headers: {
      ...defaultOptions.headers,
      ...options.headers,
    },
  };

  // 创建请求的唯一标识
  const requestKey = `${url}-${JSON.stringify(config)}`;
  
  // 如果是GET请求且已有相同的请求在进行中，等待该请求完成
  if (options.method === 'GET' || !options.method) {
    if (pendingRequests.has(requestKey)) {
      return await pendingRequests.get(requestKey);
    }
  }

  try {
    // 只在开发环境下打印API请求日志
    if (process.env.NODE_ENV === 'development') {
      console.log('API请求:', url, config);
    }
    
    // 创建完整的请求Promise（包括JSON解析）
    const requestPromise = (async () => {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        // 如果是401错误，先尝试获取错误信息
        if (response.status === 401) {
          try {
            const errorData = await response.json();
            throw new Error(`Unauthorized: ${errorData.message || 'Token无效'}`);
          } catch {
            throw new Error('Unauthorized: Token无效');
          }
        }
        // 处理429错误，添加重试机制
        if (response.status === 429) {
          const retryAfter = response.headers.get('Retry-After') || '15';
          throw new Error(`HTTP error! status: ${response.status} (Too Many Requests. Retry after ${retryAfter} seconds)`);
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    })();
    
    // 对于GET请求，缓存完整的Promise
    if (options.method === 'GET' || !options.method) {
      pendingRequests.set(requestKey, requestPromise);
    }
    
    const result = await requestPromise;
    
    // 清除GET请求的缓存
    if (options.method === 'GET' || !options.method) {
      pendingRequests.delete(requestKey);
    }
    
    return result;
  } catch (error) {
    // 清除请求缓存
    if (options.method === 'GET' || !options.method) {
      pendingRequests.delete(requestKey);
    }
    
    console.error('API请求失败:', {
      url,
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
};

// 具体的API调用函数
export const api = {
  // 鸟类相关API
  birds: {
    getAll: (params = {}) => {
      const queryString = new URLSearchParams(params).toString();
      return apiRequest(`/api/birds${queryString ? `?${queryString}` : ''}`);
    },
    getById: (id) => apiRequest(`/api/birds/${id}`),
    create: (data) => apiRequest('/api/birds', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    update: (id, data) => apiRequest(`/api/birds/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
    delete: (id) => apiRequest(`/api/birds/${id}`, {
      method: 'DELETE',
    }),
  },
  
  // 用户相关API
  users: {
    getProfile: () => apiRequest('/api/users/profile'),
    getContributions: () => apiRequest('/api/users/contributions'),
    getFavorites: () => apiRequest('/api/users/favorites'),
    login: (data) => apiRequest('/api/users/login', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    register: (data) => apiRequest('/api/users/register', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  },
  
  
  // 观鸟记录相关API（新版）
  records: {
    getAll: (params = {}) => {
      const queryString = new URLSearchParams(params).toString();
      return apiRequest(`/api/records${queryString ? `?${queryString}` : ''}`);
    },
    getById: (id) => apiRequest(`/api/records/${id}`),
    create: (data) => apiRequest('/api/records', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    update: (id, data) => apiRequest(`/api/records/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
    delete: (id) => apiRequest(`/api/records/${id}`, {
      method: 'DELETE',
    }),
    getByBird: (birdId, params = {}) => {
      const queryString = new URLSearchParams(params).toString();
      return apiRequest(`/api/records/bird/${birdId}${queryString ? `?${queryString}` : ''}`);
    },
  },
  
  // 地点相关API
  locations: {
    getAll: (params = {}) => {
      const queryString = new URLSearchParams(params).toString();
      return apiRequest(`/api/locations${queryString ? `?${queryString}` : ''}`);
    },
    getById: (id) => apiRequest(`/api/locations/${id}`),
  },
};

export default api;
