'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import styles from '@/styles/MustChangePasswordBanner.module.css';

export default function MustChangePasswordBanner() {
  const { user, loading } = useAuth();
  const pathname = usePathname() || '';

  if (loading || !user?.mustChangePassword) return null;
  if (pathname.startsWith('/personal/settings') || pathname.startsWith('/init')) {
    return null;
  }

  return (
    <div className={styles.banner} role="status">
      <p className={styles.text}>
        当前账号使用默认或临时密码，请尽快修改。
      </p>
      <Link href="/personal/settings?tab=account" className={styles.link}>
        去修改密码
      </Link>
    </div>
  );
}
