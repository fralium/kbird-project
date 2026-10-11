'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import SimplePageHeader from '@/components/SimplePageHeader';
import PageState from '@/components/PageState';
import styles from '@/styles/PersonalManage.module.css';

/** 旧入口：统一跳到数据管理 · 导入 */
export default function PersonalImportRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/personal/manage?tab=import');
  }, [router]);

  return (
    <div className={styles.container}>
      <Navbar />
      <main className={styles.main}>
        <SimplePageHeader
          title="数据管理"
          description="正在打开导入…"
          descriptionVariant="caption"
        />
        <PageState type="loading" title="正在跳转…" message="导入已并入数据管理。" />
      </main>
      <Footer />
    </div>
  );
}