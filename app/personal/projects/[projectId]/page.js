'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import PageState from '@/components/PageState';
import ExploreDemo from '@/components/ExploreDemo';
import { useAuth } from '@/components/AuthProvider';
import { api } from '@/utils/api';
import styles from '@/styles/ExploreDemo.module.css';

export default function PersonalExploreProjectPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = typeof params?.projectId === 'string' ? params.projectId : '';
  const { user, loading: authLoading, refreshUser } = useAuth();
  const hasRedirectedRef = useRef(false);
  const [projectMeta, setProjectMeta] = useState(undefined);
  const [metaError, setMetaError] = useState('');

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

  useEffect(() => {
    if (authLoading || !projectId) return;
    let cancelled = false;
    setProjectMeta(undefined);
    setMetaError('');
    api.personal
      .getExploreDemoProject(projectId)
      .then((res) => {
        if (cancelled) return;
        if (!res?.success) {
          setProjectMeta(null);
          setMetaError(res?.message || '未找到该调查项目');
          return;
        }
        setProjectMeta(res.data?.project || { id: projectId });
      })
      .catch((err) => {
        if (cancelled) return;
        setProjectMeta(null);
        setMetaError(err.message || '读取调查项目失败');
      });
    return () => {
      cancelled = true;
    };
  }, [authLoading, projectId]);

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

  if (projectMeta === undefined) {
    return (
      <div className={styles.container}>
        <Navbar />
        <main className={styles.main}>
          <PageState type="loading" title="正在读取本机调查数据..." />
        </main>
        <Footer />
      </div>
    );
  }

  if (!projectMeta) {
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
            message={
              metaError ||
              '请确认 KBird-Data/personal/exploreDemo 中已有 projects.js 与对应数据文件。'
            }
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
