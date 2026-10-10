'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import PageState from '../../components/PageState';
import styles from '../../styles/ExploreDemo.module.css';

function ExploreRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const qs = searchParams.toString();
    router.replace(qs ? `/personal/projects?${qs}` : '/personal/projects');
  }, [router, searchParams]);

  return (
    <div className={styles.container}>
      <Navbar />
      <main className={styles.main}>
        <PageState type="loading" title="正在打开探索 Demo..." />
      </main>
      <Footer />
    </div>
  );
}

export default function ExploreRedirectPage() {
  return (
    <Suspense
      fallback={
        <div className={styles.container}>
          <Navbar />
          <main className={styles.main}>
            <PageState type="loading" title="正在打开探索 Demo..." />
          </main>
          <Footer />
        </div>
      }
    >
      <ExploreRedirect />
    </Suspense>
  );
}
