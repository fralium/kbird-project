'use client';
import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Navbar from '../../components/Navbar';
import { useAuth } from '../../components/AuthProvider';
import styles from '../../styles/Dashboard.module.css';

function DashboardRedirectClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: userLoading } = useAuth();

  useEffect(() => {
    if (userLoading) return;

    if (!user) {
      router.replace('/login');
      return;
    }

    const tab = searchParams?.get('tab');
    if (tab === 'favorites') {
      router.replace('/personal/settings?tab=favorites');
      return;
    }
    if (tab === 'profile') {
      router.replace('/personal/settings?tab=account');
      return;
    }
    // 旧书签 /dashboard 落到首页，避免多一跳到设置页
    router.replace('/');
  }, [user, userLoading, router, searchParams]);

  return (
    <div className={styles.container}>
      <Navbar />
      <main className={styles.main}>
        <div className={styles.loading}>
          <p>正在进入首页...</p>
        </div>
      </main>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className={styles.container}>
          <Navbar />
          <main className={styles.main}>
            <div className={styles.loading}>
              <p>加载中...</p>
            </div>
          </main>
        </div>
      }
    >
      <DashboardRedirectClient />
    </Suspense>
  );
}
