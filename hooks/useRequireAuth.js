'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '../components/AuthProvider';

/**
 * Redirect unauthenticated users to login (with redirect back).
 * @returns {{ user, token, loading, isAuthenticated, isAdmin }}
 */
export function useRequireAuth({ redirectTo = '/login', requireAdmin = false } = {}) {
  const { user, token, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const isAuthenticated = Boolean(token && user);
  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated) {
      const next = encodeURIComponent(pathname || '/');
      router.replace(`${redirectTo}?redirect=${next}`);
      return;
    }
    if (requireAdmin && !isAdmin) {
      router.replace('/');
    }
  }, [loading, isAuthenticated, requireAdmin, isAdmin, router, redirectTo, pathname]);

  return { user, token, loading, isAuthenticated, isAdmin };
}

export function useIsAdmin() {
  const { user, loading } = useAuth();
  return { isAdmin: user?.role === 'admin', loading, user };
}
