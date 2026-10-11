'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import PageState from '@/components/PageState';
import styles from '@/styles/PersonalManage.module.css';

/** 旧入口：统一到数据管理 · 备份 */
export default function PersonalBackupRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/personal/manage?tab=backup');
  }, [router]);

  return (
    <div className={styles.container}>
      <Navbar />
      <main className={styles.main}>
        <PageState type="loading" title="正在打开备份..." />
      </main>
      <Footer />
    </div>
  );
}
