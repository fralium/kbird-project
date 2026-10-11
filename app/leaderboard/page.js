'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import PageState from '@/components/PageState';
import styles from '@/styles/Leaderboard.module.css';

/** 初见时刻已并入个人统计。 */
export default function LeaderboardPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/personal/stats?tab=bird-firsts');
  }, [router]);

  return (
    <div className={styles.container}>
      <Navbar />
      <main className={styles.main}>
        <PageState type="loading" title="正在打开个人统计…" message="鸟种初见与地点初见已并入个人统计。" />
      </main>
      <Footer />
    </div>
  );
}
