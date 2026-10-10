'use client';

import { Suspense, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import Navbar from '../../../components/Navbar';
import Footer from '../../../components/Footer';
import SimplePageHeader from '../../../components/SimplePageHeader';
import PageState from '../../../components/PageState';
import PersonalReportsPanel from '../../../components/PersonalReportsPanel';
import PersonalImportPanel from '../../../components/PersonalImportPanel';
import PersonalBackupPanel from '../../../components/PersonalBackupPanel';
import PersonalFolderPhotosPanel from '../../../components/PersonalFolderPhotosPanel';
import PersonalExportPanel from '../../../components/PersonalExportPanel';
import { useAuth } from '../../../components/AuthProvider';
import styles from '../../../styles/PersonalManage.module.css';

const GROUPS = [
  { id: 'in', label: '导入', hint: '把表格、文件或本机照片收进来。' },
  { id: 'out', label: '导出', hint: '导出记录、备份整库，或出个人报告。' },
];

const TASKS = [
  {
    id: 'import',
    group: 'in',
    label: '导入记录',
    hint: '从 CBRC、eBird 或 JSON 导入观察记录。',
  },
  {
    id: 'photos',
    group: 'in',
    label: '导入照片',
    hint: '按鸟种或目/科/种文件夹，同步进对应详情页。',
  },
  {
    id: 'export',
    group: 'out',
    label: '导出记录',
    hint: '按年份导出 CBRC 表格或 eBird CSV。',
  },
  {
    id: 'backup',
    group: 'out',
    label: '备份数据',
    hint: '导出整库备份，方便换机或归档。',
  },
  {
    id: 'reports',
    group: 'out',
    label: '导出报告',
    hint: '生成年度或月度观鸟摘要。',
  },
];

function PersonalManagePageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading, refreshUser } = useAuth();
  const hasRedirectedRef = useRef(false);

  const tabParam = searchParams.get('tab');
  const activeTask = TASKS.some((task) => task.id === tabParam) ? tabParam : 'import';
  const current = TASKS.find((task) => task.id === activeTask) || TASKS[0];
  const activeGroup = current.group;
  const groupTasks = TASKS.filter((task) => task.group === activeGroup);
  const groupMeta = GROUPS.find((group) => group.id === activeGroup) || GROUPS[0];

  useEffect(() => {
    if (authLoading) return;
    const hasToken = typeof window !== 'undefined' && localStorage.getItem('token');
    if (!hasToken) {
      if (!hasRedirectedRef.current) {
        hasRedirectedRef.current = true;
        router.push('/login?redirect=/personal/manage');
      }
      return;
    }
    if (!user && refreshUser) {
      refreshUser().catch(() => null);
    }
  }, [authLoading, refreshUser, router, user]);

  const tabHref = (nextTab) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', nextTab);
    return `/personal/manage?${params.toString()}`;
  };

  const groupHref = (nextGroup) => {
    if (nextGroup === activeGroup) return tabHref(activeTask);
    const first = TASKS.find((task) => task.group === nextGroup);
    return tabHref(first?.id || 'import');
  };

  if (authLoading) {
    return (
      <div className={styles.container}>
        <Navbar />
        <main className={styles.main}>
          <PageState type="loading" title="数据管理加载中..." />
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <Navbar />

      <main className={styles.main}>
        <SimplePageHeader
          title="数据管理"
          description="导入记录和照片，或导出备份"
          descriptionVariant="caption"
        />

        <div className="kb-view-bar">
          <div className="kb-view-seg" role="tablist" aria-label="数据方向">
            {GROUPS.map((group) => (
              <Link
                key={group.id}
                href={groupHref(group.id)}
                scroll={false}
                role="tab"
                aria-selected={activeGroup === group.id}
                className={`kb-view-tab${activeGroup === group.id ? ' is-active' : ''}`}
              >
                {group.label}
              </Link>
            ))}
          </div>
          <p className="kb-view-hint">{groupMeta.hint}</p>
        </div>

        <div className={styles.layout}>
          <nav className={styles.rail} aria-label={`${groupMeta.label}任务`}>
            {groupTasks.map((task) => {
              const selected = activeTask === task.id;
              return (
                <Link
                  key={task.id}
                  href={tabHref(task.id)}
                  scroll={false}
                  className={`${styles.task}${selected ? ` ${styles.taskActive}` : ''}`}
                  aria-current={selected ? 'page' : undefined}
                >
                  <span className={styles.taskTitle}>{task.label}</span>
                  <span className={styles.taskHint}>{task.hint}</span>
                </Link>
              );
            })}
          </nav>

          <section className={styles.workspace} aria-labelledby="manage-task-title">
            <header className={styles.workspaceHead}>
              <h2 id="manage-task-title" className={styles.workspaceTitle}>
                {current.label}
              </h2>
            </header>
            <div className={styles.workspaceBody} role="tabpanel">
              {activeTask === 'import' ? <PersonalImportPanel /> : null}
              {activeTask === 'photos' ? <PersonalFolderPhotosPanel /> : null}
              {activeTask === 'export' ? <PersonalExportPanel /> : null}
              {activeTask === 'backup' ? <PersonalBackupPanel /> : null}
              {activeTask === 'reports' ? <PersonalReportsPanel /> : null}
            </div>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}

export default function PersonalManagePage() {
  return (
    <Suspense
      fallback={
        <div className={styles.container}>
          <Navbar />
          <main className={styles.main}>
            <PageState type="loading" title="数据管理加载中..." />
          </main>
          <Footer />
        </div>
      }
    >
      <PersonalManagePageClient />
    </Suspense>
  );
}
