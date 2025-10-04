import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { api } from './api';

const UserContext = createContext();

export const UserProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [hasFetched, setHasFetched] = useState(false);
  const fetchPromiseRef = useRef(null); // 用于防止重复请求

  useEffect(() => {
    const fetchUser = async () => {
      if (hasFetched || fetchPromiseRef.current) return;
      
      const token = localStorage.getItem('token');
      if (!token) {
        setUser(null);
        setLoading(false);
        setHasFetched(true);
        return;
      }

      try {
        // 如果已经有相同的请求在进行中，等待它完成
        if (fetchPromiseRef.current) {
          const result = await fetchPromiseRef.current;
          if (result.success) {
            setUser(result.data);
          } else {
            setUser(null);
          }
          return;
        }

        // 创建新的请求Promise
        fetchPromiseRef.current = api.users.getProfile();
        const data = await fetchPromiseRef.current;
        
        if (data.success) {
          setUser(data.data);
        } else {
          setUser(null);
        }
      } catch (error) {
        console.error('获取用户信息失败:', error);
        setUser(null);
      } finally {
        setLoading(false);
        setHasFetched(true);
        fetchPromiseRef.current = null; // 清除引用
      }
    };

    fetchUser();
  }, []); // 只在组件挂载时执行一次

  const login = (userData) => {
    setUser(userData);
    setHasFetched(true);
  };

  const logout = () => {
    setUser(null);
    setHasFetched(false);
    localStorage.removeItem('token');
  };

  return (
    <UserContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};
