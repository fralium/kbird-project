'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import SimplePageHeader from '@/components/SimplePageHeader';
import PageState from '@/components/PageState';
import { useAuth } from '@/components/AuthProvider';
import { api } from '@/utils/api';
import { saveRecordDraft } from '@/utils/recordDraft';
import { formatAiUsageLine } from '@/utils/aiUsage';
import SpeciesHoverChip from '@/components/SpeciesHoverChip';
import styles from '@/styles/RecordDraft.module.css';

const DRAFT_TEXT_MAX = 4000;

function RecordDraftPageClient() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const hasRedirectedRef = useRef(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (authLoading) return;
    const hasToken = typeof window !== 'undefined' && localStorage.getItem('token');
    if (!user || !hasToken) {
      if (!hasToken && !hasRedirectedRef.current) {
        hasRedirectedRef.current = true;
        router.push('/login?redirect=/records/draft');
      }
    }
  }, [authLoading, user, router]);

  const handleGenerate = async () => {
    const content = text.trim();
    if (!content) {
      setError('请先粘贴一段观鸟笔记');
      setResult(null);
      return;
    }
    if (content.length > DRAFT_TEXT_MAX) {
      setError(`笔记请控制在 ${DRAFT_TEXT_MAX} 字以内`);
      return;
    }
    setBusy(true);
    setError('');
    try {
      const data = await api.ai.draftRecord(content);
      if (!data?.success || !data.data?.form) {
        throw new Error(data?.message || '没有生成可用草稿');
      }
      setResult(data.data);
    } catch (generateError) {
      setResult(null);
      setError(generateError?.message || '生成草稿失败');
    } finally {
      setBusy(false);
    }
  };

  const handleFill = () => {
    if (!result?.form) return;
    saveRecordDraft(result.form);
    router.push('/records/add');
  };

  if (authLoading || !user) {
    return (
      <div className={styles.container}>
        <Navbar />
        <main className={styles.main}>
          <div className={styles.loading}>
            <PageState type="loading" title="加载中..." />
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const preview = result?.preview;

  return (
    <div className={styles.container}>
      <Navbar />
      <main className={styles.main}>
        <SimplePageHeader
          title="文字草稿"
          description="把笔记抽成可改的记录"
          descriptionVariant="caption"
        />
        <section className={styles.panel}>
          <p className={styles.hint}>
            粘贴一段笔记即可。只抽原文里的日期、地点和鸟种，不会直接写入记录。对不上名录的会标出来，下一页再改。
          </p>
          <textarea
            className={styles.textarea}
            value={text}
            maxLength={DRAFT_TEXT_MAX}
            placeholder={'例如：9月14日上午在西溪湿地，阴。看到白鹭 6 只，夜鹭 2 只，还有一只不认识的翠鸟。'}
            onChange={(event) => setText(event.target.value)}
          />
          <div className={styles.actions}>
            <button type="button" className={styles.primaryButton} onClick={handleGenerate} disabled={busy}>
              {busy ? '整理中...' : '生成草稿'}
            </button>
          </div>
          {error ? <p className={`${styles.message} ${styles.error}`}>{error}</p> : null}

          {preview ? (
            <div className={styles.preview}>
              <h2>草稿预览</h2>
              <p className={styles.usageLine}>{formatAiUsageLine(result.usage)}</p>
              <p className={styles.meta}>
                日期：{preview.date || '未识别'}
                {' · '}
                地点：
                {preview.locationMatchedName
                  ? `已匹配「${preview.locationMatchedName}」`
                  : preview.locationName || '未识别'}
              </p>
              {preview.birds?.length > 0 ? (
                <ul className={styles.birdList}>
                  {preview.birds.map((bird, index) => (
                    <li key={`${bird.name}-${index}`}>
                      <span>
                        <SpeciesHoverChip
                          name={bird.matched ? bird.catalogName || bird.name : bird.name}
                          href={bird.birdId ? `/birds/${bird.birdId}` : undefined}
                        />
                        {bird.count ? ` ×${bird.count}` : ''}
                      </span>
                      <span className={bird.matched ? styles.matched : styles.unmatched}>
                        {bird.matched ? '已匹配名录' : '未匹配'}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className={styles.hint}>没有抽出鸟种，仍可进入详细记录后手动添加。</p>
              )}
              {result.warnings?.length > 0 ? (
                <ul className={styles.warnings}>
                  {result.warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              ) : null}
              <div className={styles.actions}>
                <button type="button" className={styles.primaryButton} onClick={handleFill}>
                  填入详细记录
                </button>
              </div>
            </div>
          ) : null}
        </section>
      </main>
      <Footer />
    </div>
  );
}

export default function RecordDraftPage() {
  return (
    <Suspense fallback={null}>
      <RecordDraftPageClient />
    </Suspense>
  );
}
