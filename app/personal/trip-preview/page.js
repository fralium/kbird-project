'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Navbar from '../../../components/Navbar';
import Footer from '../../../components/Footer';
import PageState from '../../../components/PageState';
import styles from '../../../styles/PersonalGoals.module.css';

function TripPreviewRedirectClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const params = new URLSearchParams();
    params.set('tab', 'predict');
    const id = searchParams.get('id');
    if (id) params.set('id', id);
    router.replace(`/personal/goals?${params.toString()}`);
  }, [router, searchParams]);

  return (
    <div className={styles.container}>
      <Navbar />
      <main className={styles.main}>
        <PageState type="loading" title="正在前往加新预测..." />
      </main>
      <Footer />
    </div>
  );
}

export default function TripPreviewRedirectPage() {
  return (
    <Suspense
      fallback={
        <div className={styles.container}>
          <Navbar />
          <main className={styles.main}>
            <PageState type="loading" title="正在前往加新预测..." />
          </main>
          <Footer />
        </div>
      }
    >
      <TripPreviewRedirectClient />
    </Suspense>
  );
}
