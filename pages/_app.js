import '../styles/globals.css';
import '../styles/accessibility.css';
import Head from 'next/head';
import { useMemo } from 'react';
import { useRouter } from 'next/router';
import ToastManager from '../components/ToastManager';
import PerformanceMonitor from '../components/PerformanceMonitor';
import { AccessibilityProvider } from '../components/AccessibilityProvider';
import ErrorBoundary from '../components/ErrorBoundary';
import { AuthProvider } from '../components/AuthProvider';
import AppClientBootstrap from '../components/AppClientBootstrap';
import FloatingTips from '../components/FloatingTips';

function MyApp({ Component, pageProps }) {
  const router = useRouter();
  const showFloatingTips = useMemo(() => {
    const path = router?.pathname || '';
    const allowedPrefixes = ['/birds', '/records', '/locations', '/knowledge', '/leaderboard'];
    return allowedPrefixes.some((prefix) => path.startsWith(prefix));
  }, [router?.pathname]);

  return (
    <ErrorBoundary>
      <AccessibilityProvider>
        <AuthProvider>
          <PerformanceMonitor>
            <div>
              <AppClientBootstrap />
              <Head>
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <meta name="robots" content="index, follow" />
                <meta name="theme-color" content="#219EBC" />
                <meta name="description" content="KBird - 专业的鸟类观察记录平台，帮助您记录、分享和探索鸟类的奇妙世界。包含345种鸟类的详细信息和观察记录。" />
                <meta name="keywords" content="鸟类,观鸟,鸟类图鉴,鸟类记录,鸟类观察,自然,生态,野生动物" />
                <meta property="og:type" content="website" />
                <meta property="og:site_name" content="KBird" />
                <meta name="twitter:card" content="summary_large_image" />
                <link rel="icon" href="/logo-wetland.png" type="image/png" />
                <link rel="icon" href="/favicon.ico" sizes="any" />
              </Head>
              <Component {...pageProps} />
              <ToastManager />
              {showFloatingTips ? <FloatingTips /> : null}
            </div>
          </PerformanceMonitor>
        </AuthProvider>
      </AccessibilityProvider>
    </ErrorBoundary>
  );
}

export default MyApp;
