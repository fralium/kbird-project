import { useEffect, useState } from 'react';

const PerformanceMonitor = ({ children }) => {
  const [metrics, setMetrics] = useState({
    loadTime: 0,
    renderTime: 0,
    memoryUsage: 0,
    networkRequests: 0
  });

  useEffect(() => {
    // 监控页面加载时间
    const startTime = performance.now();
    
    const handleLoad = () => {
      const loadTime = performance.now() - startTime;
      setMetrics(prev => ({ ...prev, loadTime }));
    };

    // 监控内存使用
    const updateMemoryUsage = () => {
      if (performance.memory) {
        setMetrics(prev => ({
          ...prev,
          memoryUsage: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024)
        }));
      }
    };

    // 监控网络请求
    let requestCount = 0;
    const originalFetch = window.fetch;
    window.fetch = function(...args) {
      requestCount++;
      setMetrics(prev => ({ ...prev, networkRequests: requestCount }));
      return originalFetch.apply(this, args);
    };

    // 监控渲染时间
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach((entry) => {
        if (entry.entryType === 'measure') {
          setMetrics(prev => ({ ...prev, renderTime: entry.duration }));
        }
      });
    });

    observer.observe({ entryTypes: ['measure'] });

    // 定期更新内存使用
    const memoryInterval = setInterval(updateMemoryUsage, 5000);

    // 页面加载完成
    if (document.readyState === 'complete') {
      handleLoad();
    } else {
      window.addEventListener('load', handleLoad);
    }

    // 清理
    return () => {
      window.removeEventListener('load', handleLoad);
      clearInterval(memoryInterval);
      observer.disconnect();
      window.fetch = originalFetch;
    };
  }, []);

  // 在开发环境显示性能指标
  if (process.env.NODE_ENV === 'development') {
    return (
      <>
        {children}
        <div style={{
          position: 'fixed',
          top: '10px',
          left: '10px',
          background: 'rgba(0,0,0,0.8)',
          color: 'white',
          padding: '10px',
          borderRadius: '5px',
          fontSize: '12px',
          zIndex: 9999,
          fontFamily: 'monospace'
        }}>
          <div>Load: {metrics.loadTime.toFixed(2)}ms</div>
          <div>Memory: {metrics.memoryUsage}MB</div>
          <div>Requests: {metrics.networkRequests}</div>
        </div>
      </>
    );
  }

  return children;
};

export default PerformanceMonitor;
