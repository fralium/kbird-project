import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import { api } from './api';

export const useAuth = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(null);
  const router = useRouter();

  // 检查token有效性
  const checkTokenValidity = useCallback(async (authToken) => {
    if (!authToken) return false;
    
    try {
      const data = await api.users.getProfile();
      
      if (data.success) {
        setUser(data.data);
        return true;
      }
      
      // Token无效，清除
      if (typeof window !== 'undefined') {
        localStorage.removeItem('token');
      }
      setToken(null);
      setUser(null);
      return false;
    } catch (error) {
      console.error('Token验证失败:', error);
      // 如果是429错误，不清理token，只是返回false
      if (error.message.includes('429')) {
        console.warn('请求过于频繁，稍后重试');
        return false;
      }
      return false;
    }
  }, []);

  // 登录
  const login = useCallback(async (usernameOrEmail, password) => {
    try {
      const data = await api.users.login({ usernameOrEmail, password });
      
      if (data.success && data.token) {
        if (typeof window !== 'undefined') {
          localStorage.setItem('token', data.token);
        }
        setToken(data.token);
        setUser(data.user);
        return { success: true, user: data.user };
      } else {
        return { success: false, message: data.message || '登录失败' };
      }
    } catch (error) {
      console.error('登录错误:', error);
      return { success: false, message: '网络错误，请重试' };
    }
  }, []);

  // 登出
  const logout = useCallback(() => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token');
    }
    setToken(null);
    setUser(null);
    router.push('/login');
  }, [router]);

  // 获取认证头
  const getAuthHeaders = useCallback(() => {
    if (!token) return {};
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }, [token]);

  // 检查是否已登录
  const isAuthenticated = useCallback(() => {
    return !!token && !!user;
  }, [token, user]);

  // 初始化检查
  useEffect(() => {
    const initAuth = async () => {
      if (typeof window !== 'undefined') {
        const storedToken = localStorage.getItem('token');
        if (storedToken) {
          setToken(storedToken);
          const isValid = await checkTokenValidity(storedToken);
          if (!isValid) {
            setToken(null);
            setUser(null);
          }
        }
      }
      setLoading(false);
    };

    initAuth();
  }, [checkTokenValidity]);

  return {
    user,
    token,
    loading,
    login,
    logout,
    getAuthHeaders,
    isAuthenticated,
    checkTokenValidity,
  };
};
