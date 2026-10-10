import { useState, useCallback, useEffect, useRef } from 'react';

export const useErrorHandler = () => {
  const [errors, setErrors] = useState([]);
  const timeoutIdsRef = useRef(new Set());

  const removeError = useCallback((errorId) => {
    setErrors(prev => prev.filter(error => error.id !== errorId));
  }, []);

  const addError = useCallback((error, type = 'error') => {
    const errorId = Date.now() + Math.random();
    const errorMessage = typeof error === 'string' ? error : error.message || '发生未知错误';
    
    setErrors(prev => [...prev, { id: errorId, message: errorMessage, type }]);
    
    // 自动移除错误（5秒后）
    const timeoutId = setTimeout(() => {
      removeError(errorId);
      timeoutIdsRef.current.delete(timeoutId);
    }, 5000);
    timeoutIdsRef.current.add(timeoutId);
  }, [removeError]);

  const clearErrors = useCallback(() => {
    setErrors([]);
  }, []);

  useEffect(() => {
    const timeoutIds = timeoutIdsRef.current;
    return () => {
      timeoutIds.forEach((timeoutId) => clearTimeout(timeoutId));
      timeoutIds.clear();
    };
  }, []);

  const handleApiError = useCallback((error, context = '') => {
    console.error(`${context}失败:`, error);
    
    let message = '操作失败，请重试';
    
    if (error.response || error.status) {
      // API响应错误
      const status = error.response?.status || error.status;
      switch (status) {
        case 400:
          message = '请求参数错误';
          break;
        case 401:
          message = '请先登录';
          break;
        case 403:
          message = '没有权限执行此操作';
          break;
        case 404:
          message = '请求的资源不存在';
          break;
        case 500:
          message = '服务器内部错误';
          break;
        default:
          message = `请求失败 (${status})`;
      }
    } else if (error.request) {
      // 网络错误
      message = '网络连接失败，请检查网络';
    } else {
      // 其他错误
      message = error.message || '发生未知错误';
    }
    
    addError(message);
  }, [addError]);

  return {
    errors,
    addError,
    removeError,
    clearErrors,
    handleApiError
  };
};
