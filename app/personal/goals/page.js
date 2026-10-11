'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import SimplePageHeader from '@/components/SimplePageHeader';
import PageState from '@/components/PageState';
import PersonalGoalsPanel from '@/components/PersonalGoalsPanel';
import TripPredictPanel from '@/components/TripPredictPanel';
import { useAuth } from '@/components/AuthProvider';
import styles from '@/styles/PersonalGoals.module.css';

const TABS = [
  { id: 'predict', label: '加新预测', hint: '上传名录表，预测还能加哪些新种。' },
  {
    id: 'lists',
    label: '特定目标',
    hint: '预测确认后的清单、许愿，以及年度与地点目标。',
  },
  { id: 'taxonomy', label: '名录进度', hint: '按目科看整本名录还差哪些。' },
];

function normalizeTab(raw) {
  if (raw === 'predict' || raw === 'lists' || raw === 'taxonomy') return raw;
  // 兼容短暂用过的 goals + view
  if (raw === 'goals') return null;
  return null;
}

function PersonalGoalsPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading, refreshUser } = useAuth();
  const hasRedirectedRef = useRef(false);
  const tabFromUrl = searchParams.get('tab');
  const listIdFromUrl = searchParams.get('listId') || '';
  const [section, setSection] = useState(() => {
    const fromTab = normalizeTab(tabFromUrl);
    if (fromTab) return fromTab;
    if (tabFromUrl === 'goals') {
      return searchParams.get('view') === 'taxonomy' ? 'taxonomy' : 'lists';
    }
    if (typeof window !== 'undefined' && window.location.hash === '#taxonomy') {
      return 'taxonomy';
    }
    return 'predict';
  });
  const [focusListId, setFocusListId] = useState(listIdFromUrl);

  useEffect(() => {
    if (authLoading) return;

    const hasToken = typeof window !== 'undefined' && localStorage.getItem('token');
    if (!hasToken) {
      if (!hasRedirectedRef.current) {
        hasRedirectedRef.current = true;
        router.replace('/login?redirect=/personal/goals');
      }
      return;
    }

    if (!user) {
      refreshUser?.();
    }
  }, [authLoading, user, refreshUser, router]);

  useEffect(() => {
    const raw = searchParams.get('tab');
    const next = normalizeTab(raw);
    if (next) {
      setSection(next);
    } else if (raw === 'goals') {
      setSection(searchParams.get('view') === 'taxonomy' ? 'taxonomy' : 'lists');
    }
    const listId = searchParams.get('listId') || '';
    if (listId) setFocusListId(listId);
  }, [searchParams]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const applyHash = () => {
      if (window.location.hash === '#taxonomy') setSection('taxonomy');
    };
    applyHash();
    window.addEventListener('hashchange', applyHash);
    return () => window.removeEventListener('hashchange', applyHash);
  }, []);

  const switchSection = (next) => {
    setSection(next);
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams();
    params.set('tab', next);
    if (next === 'lists' && focusListId) params.set('listId', focusListId);
    const qs = params.toString();
    router.replace(`/personal/goals?${qs}`, { scroll: false });
    if (next === 'taxonomy') {
      window.history.replaceState(null, '', `${window.location.pathname}?${qs}#taxonomy`);
    }
  };

  const handleConfirmedList = (list) => {
    const listId = list?._id ? String(list._id) : '';
    if (listId) setFocusListId(listId);
    setSection('lists');
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams();
    params.set('tab', 'lists');
    if (listId) params.set('listId', listId);
    router.replace(`/personal/goals?${params.toString()}`, { scroll: false });
  };

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

  const active = TABS.find((item) => item.id === section) || TABS[0];

  return (
    <div className={styles.container}>
      <Navbar />
      <main className={styles.main}>
        <SimplePageHeader
          title="加新之旅"
          description={active.hint}
          descriptionVariant="caption"
          actions={
            <div className="kb-view-seg" role="tablist" aria-label="加新之旅功能区">
              {TABS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={section === item.id}
                  className={`kb-view-tab${section === item.id ? ' is-active' : ''}`}
                  onClick={() => switchSection(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          }
        />

        {section === 'predict' ? (
          <TripPredictPanel onConfirmedList={handleConfirmedList} />
        ) : null}
        {section === 'lists' ? (
          <PersonalGoalsPanel section="lists" focusListId={focusListId} />
        ) : null}
        {section === 'taxonomy' ? <PersonalGoalsPanel section="taxonomy" /> : null}
      </main>
      <Footer />
    </div>
  );
}

export default function PersonalGoalsPage() {
  return (
    <Suspense
      fallback={
        <div className={styles.container}>
          <Navbar />
          <main className={styles.main}>
            <PageState type="loading" title="加载中..." />
          </main>
          <Footer />
        </div>
      }
    >
      <PersonalGoalsPageClient />
    </Suspense>
  );
}
