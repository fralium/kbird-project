'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '../../../components/Navbar';
import Footer from '../../../components/Footer';
import SimplePageHeader from '../../../components/SimplePageHeader';
import PageState from '../../../components/PageState';
import styles from '../../../styles/PersonalManage.module.css';

/**
 * 「我的清单」已并入观察鸟种的「地点」排版。
 * 保留此路由以免旧书签失效。
 */
export default function PersonalChecklistRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    try {
      window.localStorage.setItem('kbird-bird-list-view-mode', 'place');
    } catch {
      // ignore
    }
    router.replace('/birds?view=place');
  }, [router]);

  return (
    <div className={styles.container}>
      <Navbar />
      <main className={styles.main}>
        <SimplePageHeader
          title="已见鸟种"
          description="正在打开地点排版…"
          descriptionVariant="caption"
        />
        <PageState type="loading" title="正在跳转…" message="清单已并入观察鸟种 · 地点排版。" />
      </main>
      <Footer />
    </div>
  );
}
