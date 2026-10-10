'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { api } from '../utils/api';
import { applyUiStyle, readStoredUiStyle } from '../utils/uiStyle';

/**
 * 始终向后端核对初始化状态：
 * - 未初始化 → 清掉本机 init-checked，送去 /init（避免清库后卡死）
 * - 已初始化 → 标记 init-checked，并刷新单机模式缓存
 */
export default function AppClientBootstrap() {
  const router = useRouter();
  const pathname = usePathname() || '';

  useEffect(() => {
    applyUiStyle(readStoredUiStyle());

    let cancelled = false;
    const syncUiStyleFromServer = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) return;
        // 勿因设置接口 401 清掉登录态（启动竞态时 token 可能尚未就绪）
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

    const checkInit = async () => {
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

        if (!result.initialized) {
          localStorage.removeItem('init-checked');
          router.replace('/init');
          return;
        }

        localStorage.setItem('init-checked', 'true');
      } catch (error) {
        // 网络失败不写 init-checked，也不误判已初始化
        if (process.env.NODE_ENV === 'development') {
          console.error('检查初始化状态失败:', error);
        }
      }
    };

    checkInit();
    return () => {
      cancelled = true;
    };
  }, [pathname, router]);

  return null;
}
