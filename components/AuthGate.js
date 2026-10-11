'use client';

import PageState from './PageState';
import { useRequireAuth } from '@/hooks/useRequireAuth';

/** Blocks children until auth (and optional admin) is satisfied. */
export default function AuthGate({
  children,
  requireAdmin = false,
  loadingTitle = '检查登录状态…',
}) {
  const { loading, isAuthenticated, isAdmin } = useRequireAuth({ requireAdmin });

  if (loading || !isAuthenticated || (requireAdmin && !isAdmin)) {
    return <PageState type="loading" title={loadingTitle} />;
  }

  return children;
}
