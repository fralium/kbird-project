'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import PageState from '@/components/PageState';

/** Canonical records table lives at /personal/stats?tab=records */
export default function RecordsTablePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/personal/stats?tab=records');
  }, [router]);

  return (
    <div style={{ minHeight: '40vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <PageState type="loading" title="正在跳转到个人统计…" message="记录一览已并入个人统计页。" />
    </div>
  );
}
