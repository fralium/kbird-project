'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import PageState from '@/components/PageState';
import BirdDetailClassic from './BirdDetailClassic';
import BirdDetailNotebook from './BirdDetailNotebook';
import styles from '@/styles/BirdDetail.module.css';

function BirdDetailSwitch() {
  const layout = useSearchParams().get('layout');
  if (layout === 'classic') return <BirdDetailClassic />;
  return <BirdDetailNotebook />;
}

export default function BirdDetailPage() {
  return (
    <Suspense
      fallback={
        <div className={styles.container}>
          <Navbar />
          <main className={styles.main}>
            <PageState type="loading" title="鸟类详情加载中..." message="正在读取物种信息与观察数据。" />
          </main>
          <Footer />
        </div>
      }
    >
      <BirdDetailSwitch />
    </Suspense>
  );
}
