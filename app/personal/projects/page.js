'use client';

import { Suspense, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import PageState from '@/components/PageState';
import ExploreProjectList from '@/components/ExploreProjectList';
import { useAuth } from '@/components/AuthProvider';
import styles from '@/styles/ExploreDemo.module.css';

function PersonalExploreListInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading, refreshUser } = useAuth();
  const hasRedirectedRef = useRef(false);

  useEffect(() => {
    // 旧书签 /personal/projects?tab=… 仍进默认探索工作台
    const tab = searchParams.get('tab');
    if (tab) {
      const qs = searchParams.toString();
      router.replace(qs ? `/personal/projects/leping?${qs}` : '/personal/projects/leping');
    }
  }, [router, searchParams]);

  useEffect(() => {
    if (authLoading) return;

    const hasToken = typeof window !== 'undefined' && localStorage.getItem('token');
    if (!hasToken) {
      if (!hasRedirectedRef.current) {
        hasRedirectedRef.current = true;
        router.replace('/login?redirect=/personal/projects');
      }
      return;
    }

    if (!user) {
      refreshUser?.();
    }
  }, [authLoading, user, refreshUser, router]);

  if (authLoading) {
    return (
      <div className={styles.container}>
        <Navbar />
        <main className={styles.main}>
          <PageState type="loading" title="加载中..." />
        </main>
        <Footer />
      </div>
    );
  }

  if (!user && !(typeof window !== 'undefined' && localStorage.getItem('token'))) {
    return (
      <div className={styles.container}>
        <Navbar />
        <main className={styles.main}>
          <PageState type="loading" title="正在前往登录..." />
        </main>
        <Footer />
      </div>
    );
  }

  if (searchParams.get('tab')) {
    return (
      <div className={styles.container}>
        <Navbar />
        <main className={styles.main}>
          <PageState type="loading" title="正在打开调查项目..." />
        </main>
        <Footer />
      </div>
    );
  }

  return <ExploreProjectList />;
}

export default function PersonalExploreListPage() {
  return (
    <Suspense
      fallback={
        <div className={styles.container}>
          <Navbar />
          <main className={styles.main}>
            <PageState type="loading" title="加载中..." />
          </main>
          <Footer />
        </div>
      }
    >
      <PersonalExploreListInner />
    </Suspense>
  );
}
