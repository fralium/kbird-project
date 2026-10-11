'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import PageState from '@/components/PageState';

/** 旧入口：识别已并入观鸟助手 */
export default function AIIdentifyRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/ai?mode=identify');
  }, [router]);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar />
      <main style={{ flex: 1, padding: 24 }}>
        <PageState type="loading" title="正在打开观鸟助手…" />
      </main>
      <Footer />
    </div>
  );
}
