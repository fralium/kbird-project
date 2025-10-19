import '../styles/globals.css';
import '../styles/accessibility.css';
import Head from 'next/head';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import ToastManager from '../components/ToastManager';
import PerformanceMonitor from '../components/PerformanceMonitor';
import { AccessibilityProvider } from '../components/AccessibilityProvider';
import ErrorBoundary from '../components/ErrorBoundary';
import { UserProvider } from '../utils/userContext';

function MyApp({ Component, pageProps }) {
  const router = useRouter();
  const [isInitialized, setIsInitialized] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 检查是否需要初始化 - 只在组件首次挂载时执行一次
    const checkInit = async () => {
      // 如果已经检查过，直接跳过
      const checked = localStorage.getItem('init-checked');
      if (checked === 'true') {
        setLoading(false);
        return;
      }
      
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002'}/api/check-init`);
        const result = await response.json();
        
        // 只在开发环境下打印初始化日志
        if (process.env.NODE_ENV === 'development') {
          console.log('初始化检查结果:', result);
        }
        
        if (!result.initialized && router.pathname !== '/init') {
          if (process.env.NODE_ENV === 'development') {
            console.log('需要初始化，重定向到 /init');
          }
          setIsInitialized(false);
          router.replace('/init');
        } else {
          if (process.env.NODE_ENV === 'development') {
            console.log('已初始化，允许访问');
          }
          setIsInitialized(true);
        }
      } catch (error) {
        console.error('检查初始化状态失败:', error);
        // 如果API不可用，假设已初始化
        setIsInitialized(true);
      } finally {
        setLoading(false);
        // 标记已经检查过初始化状态
        localStorage.setItem('init-checked', 'true');
      }
    };

    checkInit();
  }, []); // 只在组件挂载时执行一次

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
      }}>
        <div style={{ 
          color: 'white', 
          fontSize: '1.2rem',
          textAlign: 'center'
        }}>
          🐦 正在加载 KBird...
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <AccessibilityProvider>
        <UserProvider>
          <PerformanceMonitor>
            <Head>
              <meta name="viewport" content="width=device-width, initial-scale=1" />
              <meta name="robots" content="index, follow" />
              <meta name="theme-color" content="#2d5016" />
              <meta name="description" content="KBird - 专业的鸟类观察记录平台，帮助您记录、分享和探索鸟类的奇妙世界。包含345种鸟类的详细信息和观察记录。" />
              <meta name="keywords" content="鸟类,观鸟,鸟类图鉴,鸟类记录,鸟类观察,自然,生态,野生动物" />
              <meta property="og:type" content="website" />
              <meta property="og:site_name" content="KBird" />
              <meta name="twitter:card" content="summary_large_image" />
              <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
              <link rel="icon" href="/favicon.ico" sizes="any" />
            </Head>
            <Component {...pageProps} />
            <ToastManager />
          </PerformanceMonitor>
        </UserProvider>
      </AccessibilityProvider>
    </ErrorBoundary>
  );
}

export default MyApp;