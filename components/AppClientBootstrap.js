'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { api } from '@/utils/api';
import { applyUiStyle, readStoredUiStyle } from '@/utils/uiStyle';

/**
 * 启动时同步本机偏好与单机模式缓存。
 * 默认不再强制跳转 /init：后端会静默就绪管理员与鸟种种子。
 */
export default function AppClientBootstrap() {
  const pathname = usePathname() || '';

  useEffect(() => {
    applyUiStyle(readStoredUiStyle());

    let cancelled = false;
    const syncUiStyleFromServer = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) return;
        const result = await api.personal.getSettings({ skipAuthHandling: true });
        if (cancelled || !result?.success) return;
        const styleId = result.data?.uiStyle;
        if (styleId) applyUiStyle(styleId);
      } catch {
        // 未登录或网络失败时保留本机风格
      }
    };
    syncUiStyleFromServer();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const syncAppMode = async () => {
      if (typeof window === 'undefined') return;
      if (pathname === '/init') return;

      try {
        const result = await api.init.checkStatus();
        if (cancelled) return;

        try {
          sessionStorage.setItem(
            'kbird-app-mode',
            JSON.stringify({
              singleUserMode: result.singleUserMode !== false,
              registrationEnabled: Boolean(result.registrationEnabled),
              autoLogin: Boolean(result.autoLogin),
            })
          );
        } catch {
          // ignore
        }

        if (result.initialized) {
          localStorage.setItem('init-checked', 'true');
        }
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('检查初始化状态失败:', error);
        }
      }
    };

    syncAppMode();
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  return null;
}
