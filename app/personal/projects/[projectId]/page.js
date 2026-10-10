'use client';

import { useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Navbar from '../../../../components/Navbar';
import Footer from '../../../../components/Footer';
import PageState from '../../../../components/PageState';
import ExploreDemo from '../../../../components/ExploreDemo';
import { useAuth } from '../../../../components/AuthProvider';
import { getExploreProject } from '../../../../data/exploreDemo/projects';
import styles from '../../../../styles/ExploreDemo.module.css';

export default function PersonalExploreProjectPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = typeof params?.projectId === 'string' ? params.projectId : '';
  const project = getExploreProject(projectId);
  const { user, loading: authLoading, refreshUser } = useAuth();
  const hasRedirectedRef = useRef(false);

  useEffect(() => {
    if (authLoading) return;

    const hasToken = typeof window !== 'undefined' && localStorage.getItem('token');
    if (!hasToken) {
      if (!hasRedirectedRef.current) {
        hasRedirectedRef.current = true;
        router.replace(
          `/login?redirect=${encodeURIComponent(`/personal/projects/${projectId || ''}`)}`
        );
      }
      return;
    }

    if (!user) {
      refreshUser?.();
    }
  }, [authLoading, user, refreshUser, router, projectId]);

  if (authLoading) {
    return (
      <div className={styles.container}>
        <Navbar />
        <main className={styles.main}>
          <PageState type="loading" title="加载中..." />
        </main>
        <Footer />
      </div>
    );
  }

  if (!user && !(typeof window !== 'undefined' && localStorage.getItem('token'))) {
    return (
      <div className={styles.container}>
        <Navbar />
        <main className={styles.main}>
          <PageState type="loading" title="正在前往登录..." />
        </main>
        <Footer />
      </div>
    );
  }

  if (!project) {
    return (
      <div className={styles.container}>
        <Navbar />
        <main className={styles.main}>
          <Link href="/personal/projects" className={styles.backToList}>
            ← 我的调查
          </Link>
          <PageState
            type="empty"
            title="未找到该调查项目"
            message="请从「我的调查」列表重新选择。"
            actionLabel="返回列表"
            onAction={() => router.push('/personal/projects')}
          />
        </main>
        <Footer />
      </div>
    );
  }

  // 公开仓库仅 stub；本机可恢复个人 demo。未注册的 id 显示占位
  if (projectId !== 'leping') {
    return (
      <div className={styles.container}>
        <Navbar />
        <main className={styles.main}>
          <Link href="/personal/projects" className={styles.backToList}>
            ← 我的调查
          </Link>
          <PageState
            type="empty"
            title={`${project.title}尚未接入`}
            message="该项目已登记，工作台数据稍后挂载。"
            actionLabel="返回列表"
            onAction={() => router.push('/personal/projects')}
          />
        </main>
        <Footer />
      </div>
    );
  }

  return <ExploreDemo projectId={projectId} listPath="/personal/projects" />;
}
