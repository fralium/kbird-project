'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import PageState from '@/components/PageState';
import SimplePageHeader from '@/components/SimplePageHeader';
import { resolvePublicApiBase } from '@/utils/publicApiBase';
import { resolveLocationCover, useHabitatCoverSet } from '@/utils/habitatCover';
import styles from '@/styles/Search.module.css';

const API_BASE_URL = resolvePublicApiBase();
const FILTER_ALL = 'all';
const FILTER_BIRDS = 'birds';
const FILTER_LOCATIONS = 'locations';
const MIN_SEARCH_LENGTH = 1;
const SEARCH_DEBOUNCE_MS = 350;
const FALLBACK_SUGGESTIONS = ['麻雀', '白鹭', '西湖', '杭州湾'];

function SearchPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [coverSet] = useHabitatCoverSet();

  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeFilter, setActiveFilter] = useState(FILTER_ALL);
  const [results, setResults] = useState({
    query: '',
    mode: 'match',
    suggestions: [],
    birds: [],
    locations: [],
  });
  const [hotSuggestions, setHotSuggestions] = useState([]);
  const initDoneRef = useRef(false);
  const skipNextDebounceRef = useRef(false);
  const debounceTimerRef = useRef(null);
  const requestSeqRef = useRef(0);

  const runSearch = async (rawQuery, updateUrl = true) => {
    const q = String(rawQuery || '').trim();
    if (q.length < MIN_SEARCH_LENGTH) {
      setError('');
      setLoading(false);
      setResults({ query: q, mode: 'match', suggestions: [], birds: [], locations: [] });
      if (updateUrl) {
        router.replace('/search');
      }
      return;
    }

    const requestId = requestSeqRef.current + 1;
    requestSeqRef.current = requestId;
    setLoading(true);
    setError('');
    try {
      if (updateUrl) {
        router.replace(`/search?q=${encodeURIComponent(q)}`);
      }
      const response = await fetch(`${API_BASE_URL}/api/search?q=${encodeURIComponent(q)}`);
      const data = await response.json();
      if (requestSeqRef.current !== requestId) return;
      if (data.success) {
        setResults({
          query: data.data?.query || q,
          mode: data.data?.mode === 'suggest' ? 'suggest' : 'match',
          suggestions: Array.isArray(data.data?.suggestions) ? data.data.suggestions : [],
          birds: Array.isArray(data.data?.birds) ? data.data.birds : [],
          locations: Array.isArray(data.data?.locations) ? data.data.locations : [],
        });
      } else {
        setError(data.message || '搜索失败，请稍后重试');
      }
    } catch (requestError) {
      if (requestSeqRef.current !== requestId) return;
      setError(requestError.message || '搜索失败，请稍后重试');
    } finally {
      if (requestSeqRef.current === requestId) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    if (initDoneRef.current) return;
    initDoneRef.current = true;
    const initial = (searchParams?.get('q') || '').trim();
    skipNextDebounceRef.current = true;
    setKeyword(initial);
    if (initial.length >= MIN_SEARCH_LENGTH) {
      runSearch(initial, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;
    const loadHotSuggestions = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/search/hot?limit=8`);
        const data = await response.json();
        if (cancelled || !data.success) return;
        const words = Array.isArray(data.data?.keywords)
          ? data.data.keywords.map((item) => item.term).filter(Boolean)
          : [];
        setHotSuggestions(words.slice(0, 8));
      } catch {
        // silent fallback
      }
    };
    loadHotSuggestions();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!initDoneRef.current) return undefined;
    if (skipNextDebounceRef.current) {
      skipNextDebounceRef.current = false;
      return undefined;
    }
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      runSearch(keyword, true);
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyword]);

  const isSuggest = results.mode === 'suggest';
  const resultCount = useMemo(() => {
    if (results.mode === 'suggest') return results.suggestions?.length || 0;
    return (results.birds?.length || 0) + (results.locations?.length || 0);
  }, [results]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    await runSearch(keyword, true);
  };

  const handleSuggestionClick = (q) => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    skipNextDebounceRef.current = true;
    setKeyword(q);
    runSearch(q, true);
  };

  const showResults = results.query.length >= MIN_SEARCH_LENGTH;
  const showEmptyState = showResults && !loading && resultCount === 0 && !error;
  const suggestionWords = hotSuggestions.length ? hotSuggestions : FALLBACK_SUGGESTIONS;

  return (
    <div className={styles.container}>
      <Navbar />

      <main className={styles.main}>
        <SimplePageHeader
          title="搜索"
          description="鸟种、地点"
          descriptionVariant="caption"
        />

        <div className="kb-view-bar">
          <div className="kb-view-seg" role="tablist" aria-label="搜索范围">
            {[
              [FILTER_ALL, '全部'],
              [FILTER_BIRDS, '鸟种'],
              [FILTER_LOCATIONS, '地点'],
            ].map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={activeFilter === id}
                className={`kb-view-tab${activeFilter === id ? ' is-active' : ''}`}
                onClick={() => setActiveFilter(id)}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="kb-view-hint">
            {activeFilter === FILTER_BIRDS
              ? '只看鸟种。'
              : activeFilter === FILTER_LOCATIONS
                ? '只看地点。'
                : '鸟种和地点一起搜。'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className={styles.searchForm}>
          <input
            type="search"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="中文名 / 拼音 / 首字母 / 学名 / 英文 / 地点"
            className={styles.searchInput}
            aria-label="搜索"
          />
          <button type="submit" className={`btn btn-primary ${styles.searchButton}`} disabled={loading}>
            {loading ? '搜索中…' : '搜索'}
          </button>
        </form>

        <div className={styles.listMeta}>
          <div className={styles.listMetaLead}>
            {showResults && !error && !loading ? (
              <span className={styles.listMetaCount}>
                {isSuggest
                  ? `${results.suggestions.length} 个候选`
                  : `${activeFilter === FILTER_BIRDS
                    ? results.birds.length
                    : activeFilter === FILTER_LOCATIONS
                      ? results.locations.length
                      : resultCount} 条`}
              </span>
            ) : null}
          </div>
        </div>

        {error ? <PageState type="error" title="搜索失败" message={error} /> : null}
        {!error && loading ? (
          <PageState type="loading" title="正在搜索..." />
        ) : null}

        {showResults && !error && !loading && isSuggest && results.suggestions.length > 0 && (
          <section className={styles.resultSection}>
            <h3 className={styles.sectionTitle}>候选鸟种</h3>
            <p className={styles.candidateHint}>点一个名字，再按这个种去对地点。</p>
            <div className={styles.candidateList}>
              {results.suggestions.map((bird) => (
                <button
                  key={bird._id}
                  type="button"
                  className={styles.candidateButton}
                  onClick={() => handleSuggestionClick(bird.name)}
                >
                  <span className={styles.candidateName}>{bird.name}</span>
                  {bird.scientificName ? (
                    <span className={styles.candidateMeta}>{bird.scientificName}</span>
                  ) : null}
                </button>
              ))}
            </div>
          </section>
        )}

        {showResults && !error && !loading && !isSuggest && (
          <div className={styles.results}>
            {(activeFilter === FILTER_ALL || activeFilter === FILTER_BIRDS) && (
              <section className={styles.resultSection}>
                <h3 className={styles.sectionTitle}>鸟种</h3>
                {results.birds.length === 0 ? (
                  <div className={styles.emptyState}>未找到匹配鸟种</div>
                ) : (
                  <div className={styles.resultGrid}>
                    {results.birds.map((bird) => {
                      const imageUrl = String(bird.image || '').trim();
                      const optimizeImage = imageUrl.startsWith('/');
                      return (
                        <Link key={bird._id} href={`/birds/${bird._id}`} className={styles.resultCard}>
                          <div className={styles.cardImageWrap}>
                            {imageUrl ? (
                              <Image
                                src={imageUrl}
                                alt={bird.name}
                                fill
                                sizes="240px"
                                unoptimized={!optimizeImage}
                                className={styles.cardImage}
                              />
                            ) : null}
                          </div>
                          <div className={styles.cardContent}>
                            <h4 className={styles.cardTitle}>{bird.name}</h4>
                            <p className={styles.cardMeta}>{bird.scientificName || '-'}</p>
                            <p className={styles.cardMeta}>{bird.category || '未分类'}</p>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </section>
            )}

            {(activeFilter === FILTER_ALL || activeFilter === FILTER_LOCATIONS) && (
              <section className={styles.resultSection}>
                <h3 className={styles.sectionTitle}>地点</h3>
                {results.locations.length === 0 ? (
                  <div className={styles.emptyState}>
                    {results.birds.length > 0 ? '这些鸟还没有观察地点' : '未找到匹配地点'}
                  </div>
                ) : (
                  <div className={styles.resultGrid}>
                    {(() => {
                      const usedCoverUrls = new Set();
                      return results.locations.map((location) => {
                        const cover = resolveLocationCover(location, usedCoverUrls, coverSet);
                        const meta = location.sightingCount > 0
                          ? `见过 ${location.sightingCount} 次${location.type ? ` · ${location.type}` : ''}`
                          : (location.type || '地点');
                        return (
                          <Link
                            key={location._id || location.name}
                            href={
                              location._id
                                ? `/locations/${location._id}`
                                : `/locations?search=${encodeURIComponent(location.name || '')}`
                            }
                            className={styles.resultCard}
                          >
                            <div className={styles.cardImageWrap}>
                              <Image
                                src={cover.url}
                                alt=""
                                fill
                                sizes="240px"
                                unoptimized
                                className={styles.cardImage}
                              />
                            </div>
                            <div className={styles.cardContent}>
                              <h4 className={styles.cardTitle}>{location.name}</h4>
                              <p className={styles.cardMeta}>{meta}</p>
                            </div>
                          </Link>
                        );
                      });
                    })()}
                  </div>
                )}
              </section>
            )}
          </div>
        )}

        {showEmptyState && (
          <div className={styles.noResults}>
            {isSuggest ? '没有找到候选鸟种' : '没有找到相关内容'}
            <div className={styles.noResultsHint}>
              试试这些常用关键词：
            </div>
            <div className={styles.typeFilter} style={{ marginTop: 10 }}>
              {suggestionWords.map((item) => (
                <button
                  key={item}
                  type="button"
                  className={styles.typeButton}
                  onClick={() => handleSuggestionClick(item)}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className={styles.loading}>正在加载搜索页...</div>}>
      <SearchPageClient />
    </Suspense>
  );
}
