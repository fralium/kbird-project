'use client';

import { useMemo } from 'react';
import { usePathname } from 'next/navigation';
import ErrorBoundary from '@/components/ErrorBoundary';
import { AccessibilityProvider } from '@/components/AccessibilityProvider';
import { AuthProvider } from '@/components/AuthProvider';
import PerformanceMonitor from '@/components/PerformanceMonitor';
import AppClientBootstrap from '@/components/AppClientBootstrap';
import ToastManager from '@/components/ToastManager';
import FloatingTips from '@/components/FloatingTips';

export default function AppProviders({ children }) {
  const pathname = usePathname() || '';
  const showFloatingTips = useMemo(() => {
    const allowedPrefixes = ['/birds', '/records', '/locations', '/knowledge', '/leaderboard'];
    return allowedPrefixes.some((prefix) => pathname.startsWith(prefix));
  }, [pathname]);

  return (
    <ErrorBoundary>
      <AccessibilityProvider>
        <AuthProvider>
          <PerformanceMonitor>
            <AppClientBootstrap />
            {children}
            <ToastManager />
            {showFloatingTips ? <FloatingTips /> : null}
          </PerformanceMonitor>
        </AuthProvider>
      </AccessibilityProvider>
    </ErrorBoundary>
  );
}
