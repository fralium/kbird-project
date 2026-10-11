'use client';
import { Suspense, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import SimplePageHeader from '@/components/SimplePageHeader';
import PageState from '@/components/PageState';
import RecordsTablePanel from '@/components/RecordsTablePanel';
import FirstsPanel from '@/components/FirstsPanel';
import FootprintAlbum from '@/components/FootprintAlbum';
import SpeciesWordCloud from '@/components/SpeciesWordCloud';
import SpeciesHoverChip from '@/components/SpeciesHoverChip';
import ProtectionDonutChart from '@/components/ProtectionDonutChart';
import { useAuth } from '@/components/AuthProvider';
import { api } from '@/utils/api';
import { getOrderChineseName, getFamilyChineseName } from '@/data/taxonomyTranslation';
import { devError } from '@/utils/devLogger';
import {
  HABITAT_COVER_SETS,
  HABITAT_COVER_SET_KEY,
  normalizeHabitatCoverSet,
  resolveLocationCover,
  writeHabitatCoverSet,
} from '@/utils/habitatCover';
import styles from '@/styles/PersonalStats.module.css';

const VALID_TABS = ['overview', 'species', 'places', 'records', 'bird-firsts', 'location-firsts'];
const TAB_LABELS = {
  overview: '总览',
  species: '名录',
  places: '足迹',
  records: '记录',
  'bird-firsts': '鸟种初见',
  'location-firsts': '地点初见',
};

const TAB_HINTS = {
  overview: '',
  species: '',
  places: '',
  records: '表格或卡片翻全部观察记录。',
  'bird-firsts': '每种鸟第一次记下的时间和地点。',
  'location-firsts': '每个地点第一次记下的时间。',
};

const STATS_CAPTION = '种数、足迹和初见';

const MONTH_LABELS = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

/* 圆角环图色板：分段对比清晰，贴近示意稿 */
const PROTECTION_COLORS = {
  国家一级: '#F06464',
  国家二级: '#E983D2',
  三有: '#91CC75',
  省级保护: '#F2A65A',
  未列入: '#5470C6',
};

const IUCN_COLORS = {
  '无危(LC)': '#5470C6',
  '近危(NT)': '#FAC858',
  '易危(VU)': '#F2A65A',
  '濒危(EN)': '#EE6666',
  '极危(CR)': '#C23531',
  '野外灭绝(EW)': '#91A0B0',
  '灭绝(EX)': '#5B6470',
  '数据缺乏(DD)': '#B0B8C4',
  '未评估(NE)': '#B0B8C4',
};

function formatCount(value) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  return Number(value).toLocaleString('zh-CN');
}

function PersonalStatsPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading, refreshUser } = useAuth();
  const [dash, setDash] = useState(null);
  const [stats, setStats] = useState(null);
  const [footprint, setFootprint] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [selectedYear, setSelectedYear] = useState('');
  const [expandedYear, setExpandedYear] = useState(null);
  const [expandedLocation, setExpandedLocation] = useState(null);
  const [expandedCategory, setExpandedCategory] = useState(null);
  const [placeCoverSet, setPlaceCoverSet] = useState('watercolor');
  const [activeTab, setActiveTab] = useState(() => {
    const tab = searchParams?.get('tab');
    return VALID_TABS.includes(tab) ? tab : 'overview';
  });
  const [activityCounts, setActivityCounts] = useState({ week: null, month: null, year: null });
  const hasRedirectedRef = useRef(false);

  useEffect(() => {
    const tabValue = searchParams?.get('tab');
    if (tabValue && VALID_TABS.includes(tabValue)) {
      setActiveTab(tabValue);
    } else {
      setActiveTab('overview');
    }
  }, [searchParams]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(HABITAT_COVER_SET_KEY);
      if (raw) setPlaceCoverSet(normalizeHabitatCoverSet(raw));
    } catch {
      // ignore
    }
  }, []);

  const updatePlaceCoverSet = useCallback((setId) => {
    const next = normalizeHabitatCoverSet(setId);
    setPlaceCoverSet(next);
    writeHabitatCoverSet(next);
  }, []);

  const placeLocationCovers = useMemo(() => {
    const used = new Set();
    const map = new Map();
    const list = Array.isArray(stats?.locations) ? stats.locations : [];
    list.forEach((location, index) => {
      const cover = resolveLocationCover(
        {
          name: location.name,
          type: location.type,
          images: location.images,
          environment: location.environment,
          _id: location.locationId || location.name || index,
        },
        used,
        placeCoverSet
      );
      map.set(location.name, cover);
    });
    return map;
  }, [stats?.locations, placeCoverSet]);

  const setTab = useCallback(
    (tab) => {
      setActiveTab(tab);
      const params = new URLSearchParams(searchParams?.toString() || '');
      if (tab === 'overview') {
        params.delete('tab');
      } else {
        params.set('tab', tab);
      }
      const qs = params.toString();
      router.replace(qs ? `/personal/stats?${qs}` : '/personal/stats', { scroll: false });
    },
    [router, searchParams]
  );

  const loadFootprint = useCallback(async () => {
    try {
      const r3 = await api.personal.getFootprint({});
      if (r3.success) setFootprint(r3.data);
      else setFootprint(null);
    } catch (e) {
      devError('个人足迹加载失败:', e);
      setFootprint(null);
    }
  }, []);

  const loadScopedStats = useCallback(async () => {
    const params = selectedYear ? { year: selectedYear } : {};
    try {
      const [r1, r2] = await Promise.all([
        api.personal.getStatsDashboard(params),
        api.personal.getStats(params),
      ]);
      if (r1.success) setDash(r1.data);
      else setDash(null);
      if (r2.success) setStats(r2.data);
      else setStats(null);
      if (!r1.success && !r2.success) {
        setLoadError(r1?.message || r2?.message || '个人统计加载失败');
      }
    } catch (e) {
      devError('个人统计加载失败:', e);
      setDash(null);
      setStats(null);
      setLoadError(e?.message || '个人统计加载失败');
    }
  }, [selectedYear]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      await Promise.all([loadScopedStats(), loadFootprint()]);
    } finally {
      setLoading(false);
    }
  }, [loadFootprint, loadScopedStats]);

  const loadDataRef = useRef(loadData);
  loadDataRef.current = loadData;
  const loadScopedStatsRef = useRef(loadScopedStats);
  loadScopedStatsRef.current = loadScopedStats;
  const skipYearReloadRef = useRef(true);

  const loadActivityCounts = useCallback(async () => {
    const userId = user?._id || user?.id;
    if (!userId) {
      setActivityCounts({ week: 0, month: 0, year: 0 });
      return;
    }
    try {
      const year = new Date().getFullYear();
      const all = [];
      let page = 1;
      let totalPages = 1;
      while (page <= totalPages && page <= 20) {
        const data = await api.records.getAll({
          page: String(page),
          limit: '100',
          sort: 'date_desc',
          year: String(year),
          observer: String(userId),
        });
        if (!data.success) break;
        const pageRecords = Array.isArray(data.data) ? data.data : [];
        all.push(...pageRecords);
        const parsedPages = Number(data.pagination?.totalPages || 1);
        totalPages = Number.isFinite(parsedPages) && parsedPages > 0 ? parsedPages : 1;
        if (pageRecords.length === 0) break;
        page += 1;
      }

      const published = all.filter((r) => r && r.status !== 'draft');
      const now = new Date();
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);
      const thisYearStart = new Date(now.getFullYear(), 0, 1);
      const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      setActivityCounts({
        week: published.filter((r) => new Date(r.date) >= weekAgo).length,
        month: published.filter((r) => {
          const d = new Date(r.date);
          return d >= thisMonthStart && d.getFullYear() === now.getFullYear();
        }).length,
        year: published.filter((r) => new Date(r.date) >= thisYearStart).length,
      });
    } catch (e) {
      devError('近期活动统计加载失败:', e);
      setActivityCounts({ week: 0, month: 0, year: 0 });
    }
  }, [user]);

  const revisitSuggestions = useMemo(() => {
    const locations = Array.isArray(stats?.locations) ? stats.locations : [];
    const now = Date.now();
    const currentMonth = new Date().getMonth() + 1;
    const withMeta = locations
      .map((loc) => {
        const last = loc.lastVisit ? new Date(loc.lastVisit) : null;
        const daysSince =
          last && !Number.isNaN(last.getTime())
            ? Math.floor((now - last.getTime()) / (24 * 60 * 60 * 1000))
            : null;
        const months = Array.isArray(loc.months) ? loc.months : [];
        return {
          ...loc,
          daysSince,
          inSeason: months.includes(currentMonth),
        };
      })
      .filter((loc) => loc.name && loc.name !== '未知地点');

    const overdue = [...withMeta]
      .filter((loc) => loc.daysSince != null && loc.daysSince >= 60)
      .sort((a, b) => b.daysSince - a.daysSince)
      .slice(0, 5);

    const seasonal = [...withMeta]
      .filter((loc) => loc.inSeason)
      .sort((a, b) => {
        const da = a.daysSince == null ? -1 : a.daysSince;
        const db = b.daysSince == null ? -1 : b.daysSince;
        if (db !== da) return db - da;
        return (b.records || 0) - (a.records || 0);
      })
      .slice(0, 5);

    return { overdue, seasonal, currentMonth };
  }, [stats?.locations]);

  const categoryMaxSpecies = useMemo(() => {
    const list = Array.isArray(stats?.categories) ? stats.categories : [];
    return Math.max(...list.map((c) => Number(c.species) || 0), 1);
  }, [stats?.categories]);

  const locationMaxSpecies = useMemo(() => {
    const list = Array.isArray(stats?.locations) ? stats.locations : [];
    return Math.max(...list.map((l) => Number(l.species) || 0), 1);
  }, [stats?.locations]);

  useEffect(() => {
    if (authLoading) return;

    const hasToken = typeof window !== 'undefined' && localStorage.getItem('token');
    if (!hasToken) {
      if (!hasRedirectedRef.current) {
        hasRedirectedRef.current = true;
        router.push('/login?redirect=/personal/stats');
      }
      setLoading(false);
      return;
    }

    if (!user) {
      const hasCachedUser = typeof window !== 'undefined' && localStorage.getItem('user');
      if (refreshUser) {
        refreshUser().catch(() => null);
      }
      if (!hasCachedUser) {
        setLoading(false);
        if (!hasRedirectedRef.current) {
          hasRedirectedRef.current = true;
          router.push('/login?redirect=/personal/stats');
        }
      }
      return;
    }

    loadDataRef.current();
    loadActivityCounts();
  }, [authLoading, loadActivityCounts, refreshUser, router, user]);

  useEffect(() => {
    if (authLoading || !user) return;
    if (skipYearReloadRef.current) {
      skipYearReloadRef.current = false;
      return;
    }
    loadScopedStatsRef.current();
  }, [authLoading, selectedYear, user]);

  const summary = stats?.summary || dash?.summary || null;
  const isFirstsTab = activeTab === 'bird-firsts' || activeTab === 'location-firsts';
  const showDashLoading = loading && activeTab !== 'records' && !isFirstsTab;
  const yearScopeLabel = selectedYear ? `${selectedYear} 年` : '全部年份';

  const locationCount = Array.isArray(stats?.locations) ? stats.locations.length : 0;

  const yearFilterBar = (
    <div className={styles.dashTopBar}>
      <div className={`${styles.filterGroup} ${styles.dashYearFilter}`}>
        <label htmlFor="dash-year">年份</label>
        <select
          id="dash-year"
          value={selectedYear}
          onChange={(e) => setSelectedYear(e.target.value)}
          className={styles.filterSelect}
        >
          <option value="">全部年份</option>
          {Array.from({ length: 12 }, (_, i) => {
            const y = new Date().getFullYear() - i;
            return (
              <option key={y} value={String(y)}>
                {y}
              </option>
            );
          })}
        </select>
      </div>
    </div>
  );

  return (
    <div className={styles.container}>
      <Navbar />

      <main className={`${styles.main} ${styles.dashboardMain}`}>
        <SimplePageHeader
          title="个人统计"
          description={STATS_CAPTION}
          descriptionVariant="caption"
        />

        <div className="kb-view-bar">
          <div className="kb-view-seg" role="tablist" aria-label="个人统计分区">
            {VALID_TABS.map((tab) => (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={activeTab === tab}
                className={`kb-view-tab${activeTab === tab ? ' is-active' : ''}`}
                onClick={() => setTab(tab)}
              >
                {TAB_LABELS[tab]}
              </button>
            ))}
          </div>
          {TAB_HINTS[activeTab] ? <p className="kb-view-hint">{TAB_HINTS[activeTab]}</p> : null}
          {activeTab === 'location-firsts' ? (
            <div className="kb-view-seg kb-meta-seg" role="group" aria-label="封面风格">
              <span className="kb-meta-label">显示</span>
              {HABITAT_COVER_SETS.map((set) => (
                <button
                  key={set.id}
                  type="button"
                  className={`kb-view-tab kb-meta-tab${placeCoverSet === set.id ? ' is-active' : ''}`}
                  aria-pressed={placeCoverSet === set.id}
                  onClick={() => updatePlaceCoverSet(set.id)}
                >
                  {set.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        {activeTab === 'records' ? (
          <div className={styles.tabContent} role="tabpanel">
            <RecordsTablePanel />
          </div>
        ) : isFirstsTab ? (
          <div className={styles.tabContent} role="tabpanel">
            {yearFilterBar}
            <FirstsPanel
              kind={activeTab === 'location-firsts' ? 'locations' : 'birds'}
              year={selectedYear}
              yearScopeLabel={yearScopeLabel}
              coverSet={placeCoverSet}
            />
          </div>
        ) : showDashLoading ? (
          <div className={styles.tabContent} role="tabpanel">
            <PageState type="loading" title="个人统计加载中..." />
          </div>
        ) : !dash && !stats ? (
          <div className={styles.tabContent} role="tabpanel">
            <PageState
              type="error"
              title="未能加载统计数据"
              message={loadError || '请稍后重试'}
              actionLabel="重试"
              onAction={loadData}
            />
          </div>
        ) : (
          <div className={styles.tabContent} role="tabpanel">
            {activeTab !== 'overview' && activeTab !== 'places' && activeTab !== 'species'
              ? yearFilterBar
              : null}

            {activeTab === 'overview' ? (
              <section className={styles.placePanel} aria-label="总览">
                <div className={styles.placePanelHead}>
                  <div className={styles.placePanelHeadMain}>
                    <h2 className={styles.placePanelTitle}>总览</h2>
                    <p className={styles.placePanelSub}>
                      按年汇总的 7 项指标
                    </p>
                  </div>
                  <div className={`${styles.filterGroup} ${styles.dashYearFilter}`}>
                    <label htmlFor="overview-year">统计范围</label>
                    <select
                      id="overview-year"
                      value={selectedYear}
                      onChange={(e) => setSelectedYear(e.target.value)}
                      className={styles.filterSelect}
                    >
                      <option value="">全部年份</option>
                      {Array.from({ length: 12 }, (_, i) => {
                        const y = new Date().getFullYear() - i;
                        return (
                          <option key={y} value={String(y)}>
                            {y}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                </div>

                <p className={styles.overviewScopeNote}>
                  当前范围：<strong>{yearScopeLabel}</strong>
                </p>

                <div className={styles.dashSummaryRow}>
                  <div className={styles.dashSumCard}>
                    <p className={styles.dashSumTitle}>观察记录</p>
                    <div className={styles.dashSumMain}>{formatCount(summary?.totalRecords)}</div>
                    <div className={styles.dashSumSub}>次出行记录</div>
                  </div>
                  <div className={styles.dashSumCard}>
                    <p className={styles.dashSumTitle}>鸟种数</p>
                    <div className={styles.dashSumMain}>{formatCount(summary?.totalSpecies)}</div>
                    <div className={styles.dashSumSub}>该范围内去重种类</div>
                  </div>
                  <div className={styles.dashSumCard}>
                    <p className={styles.dashSumTitle}>观察个体</p>
                    <div className={styles.dashSumMain}>{formatCount(summary?.totalBirds)}</div>
                    <div className={styles.dashSumSub}>累计只次（含数量）</div>
                  </div>
                  <div className={styles.dashSumCard}>
                    <p className={styles.dashSumTitle}>观察地点</p>
                    <div className={styles.dashSumMain}>{formatCount(locationCount)}</div>
                    <div className={styles.dashSumSub}>有记录的地点数</div>
                  </div>
                </div>
                <div className={styles.dashSummaryRowThree}>
                  <div className={styles.dashSumCard}>
                    <p className={styles.dashSumTitle}>活跃月份</p>
                    <div className={styles.dashSumMain}>{formatCount(summary?.activeMonths)}</div>
                    <div className={styles.dashSumSub}>有记录的月份数</div>
                  </div>
                  <div className={styles.dashSumCard}>
                    <p className={styles.dashSumTitle}>活跃天数</p>
                    <div className={styles.dashSumMain}>{formatCount(summary?.activeDays)}</div>
                    <div className={styles.dashSumSub}>有记录的日期数</div>
                  </div>
                  <div className={styles.dashSumCard}>
                    <p className={styles.dashSumTitle}>照片数</p>
                    <div className={styles.dashSumMain}>{formatCount(summary?.totalPhotos)}</div>
                    <div className={styles.dashSumSub}>记录与鸟种附图合计</div>
                  </div>
                </div>
              </section>
            ) : null}

            {activeTab === 'overview' ? (
              <section className={styles.placePanel} aria-label="近期活动">
                <div className={styles.placePanelHead}>
                  <div className={styles.placePanelHeadMain}>
                    <h2 className={styles.placePanelTitle}>近期活动</h2>
                    <p className={styles.placePanelSub}>按自然周 / 月 / 年统计，点数字可进记录</p>
                  </div>
                </div>
                <div className={styles.activityRowInPanel}>
                  <button type="button" className={styles.activityItem} onClick={() => setTab('records')}>
                    <span className={styles.activityValue}>{activityCounts.week ?? '—'}</span>
                    <span className={styles.activityUnit}>本周记录</span>
                  </button>
                  <button type="button" className={styles.activityItem} onClick={() => setTab('records')}>
                    <span className={styles.activityValue}>{activityCounts.month ?? '—'}</span>
                    <span className={styles.activityUnit}>本月记录</span>
                  </button>
                  <button type="button" className={styles.activityItem} onClick={() => setTab('records')}>
                    <span className={styles.activityValue}>{activityCounts.year ?? '—'}</span>
                    <span className={styles.activityUnit}>今年记录</span>
                  </button>
                </div>
              </section>
            ) : null}

            {activeTab === 'overview' &&
            (revisitSuggestions.overdue.length > 0 || revisitSuggestions.seasonal.length > 0) ? (
              <section className={styles.placePanel} aria-label="再访建议">
                <div className={styles.placePanelHead}>
                  <div className={styles.placePanelHeadMain}>
                    <h2 className={styles.placePanelTitle}>再访建议</h2>
                    <p className={styles.placePanelSub}>
                      久未回访，以及这个月你曾有收获的地点（各列最多 5 条）
                    </p>
                  </div>
                </div>
                <div className={styles.revisitGrid}>
                  <div className={styles.revisitCol}>
                    <h4>久未回访（≥60 天）</h4>
                    {revisitSuggestions.overdue.length === 0 ? (
                      <div className={styles.dashEmpty}>暂无</div>
                    ) : (
                      <ul className={styles.revisitList}>
                        {revisitSuggestions.overdue.slice(0, 5).map((loc) => (
                          <li key={`overdue-${loc.name}`}>
                            <Link
                              href={`/locations?search=${encodeURIComponent(loc.name)}`}
                              className={styles.revisitLink}
                            >
                              <strong>{loc.name}</strong>
                              <span>
                                {loc.daysSince} 天未去 · {loc.species} 种 · {loc.records} 次
                              </span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div className={styles.revisitCol}>
                    <h4>{revisitSuggestions.currentMonth} 月曾经有货</h4>
                    {revisitSuggestions.seasonal.length === 0 ? (
                      <div className={styles.dashEmpty}>暂无</div>
                    ) : (
                      <ul className={styles.revisitList}>
                        {revisitSuggestions.seasonal.slice(0, 5).map((loc) => (
                          <li key={`season-${loc.name}`}>
                            <Link
                              href={`/locations?search=${encodeURIComponent(loc.name)}`}
                              className={styles.revisitLink}
                            >
                              <strong>{loc.name}</strong>
                              <span>
                                历史 {revisitSuggestions.currentMonth} 月有记录 · {loc.species} 种
                                {loc.daysSince != null ? ` · ${loc.daysSince} 天未去` : ''}
                              </span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </section>
            ) : null}

            {activeTab === 'species' ? (
              <>
                <section className={styles.placePanel} aria-label="名录分析">
                  <div className={styles.placePanelHead}>
                    <div className={styles.placePanelHeadMain}>
                      <h2 className={styles.placePanelTitle}>名录分析</h2>
                      <p className={styles.placePanelSub}>
                        年度 / 月份趋势、保护等级与高频鸟种 ·{' '}
                        <Link href="/birds">已见鸟种</Link>
                      </p>
                    </div>
                    <div className={`${styles.filterGroup} ${styles.dashYearFilter}`}>
                      <label htmlFor="species-year">统计范围</label>
                      <select
                        id="species-year"
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(e.target.value)}
                        className={styles.filterSelect}
                      >
                        <option value="">全部年份</option>
                        {Array.from({ length: 12 }, (_, i) => {
                          const y = new Date().getFullYear() - i;
                          return (
                            <option key={y} value={String(y)}>
                              {y}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  </div>

                  {dash ? (
                    <>
                      <div className={styles.placePanelCharts}>
                        <div className={styles.placePanelChart}>
                          <h3 className={styles.placePanelChartTitle}>年度鸟种</h3>
                          <p className={styles.placePanelSub}>柱高为种数；红段为当年新种</p>
                          <div className={styles.dashChartGrow}>
                            {dash.yearlySpecies.length === 0 ? (
                              <div className={styles.dashEmpty}>暂无数据</div>
                            ) : (
                              <VerticalBars
                                items={dash.yearlySpecies.map((y) => ({
                                  label: `${y.year}`,
                                  value: y.species,
                                  newValue: y.newSpecies || 0,
                                }))}
                                barClass={styles.dashVBarBlue}
                                stackClass={styles.dashVBarStackRed}
                                styles={styles}
                                valueInBar
                                showNewBadge
                              />
                            )}
                          </div>
                        </div>
                        <div className={styles.placePanelChart}>
                          <h3 className={styles.placePanelChartTitle}>年度记录</h3>
                          <div className={styles.dashChartGrow}>
                            {dash.yearlySpecies.length === 0 ? (
                              <div className={styles.dashEmpty}>暂无数据</div>
                            ) : (
                              <VerticalBars
                                items={dash.yearlySpecies.map((y) => ({
                                  label: `${y.year}`,
                                  value: y.records || 0,
                                }))}
                                barClass={styles.dashVBarPurple}
                                styles={styles}
                                valueInBar
                              />
                            )}
                          </div>
                        </div>
                      </div>

                      <div className={styles.placePanelCharts}>
                        <div className={styles.placePanelChart}>
                          <h3 className={styles.placePanelChartTitle}>月份鸟种</h3>
                          <p className={styles.placePanelSub}>柱高为种数；红段为当月新种</p>
                          <div className={styles.dashChartGrow}>
                            <VerticalBars
                              items={(dash.monthlySpecies || []).map((v, i) => ({
                                label: MONTH_LABELS[i],
                                value: v,
                                newValue: (dash.monthlyNewSpecies || [])[i] || 0,
                              }))}
                              barClass={styles.dashVBarBlue}
                              stackClass={styles.dashVBarStackRed}
                              styles={styles}
                              valueInBar
                              showNewBadge
                            />
                          </div>
                        </div>
                        <div className={styles.placePanelChart}>
                          <h3 className={styles.placePanelChartTitle}>月份记录</h3>
                          <p className={styles.placePanelSub}>按出行记录条数</p>
                          <div className={styles.dashChartGrow}>
                            <VerticalBars
                              items={(dash.monthlyRecords || []).map((v, i) => ({
                                label: MONTH_LABELS[i],
                                value: v,
                              }))}
                              barClass={styles.dashVBarGreen}
                              styles={styles}
                              valueInBar
                            />
                          </div>
                        </div>
                      </div>

                      <div className={styles.placePanelCharts}>
                        <div className={styles.placePanelChart}>
                          <h3 className={styles.placePanelChartTitle}>中国保护等级</h3>
                          <ProtectionDonutChart
                            breakdown={dash.protectionBreakdown}
                            colorMap={PROTECTION_COLORS}
                            className={styles.protectionDonut}
                          />
                        </div>
                        <div className={styles.placePanelChart}>
                          <h3 className={styles.placePanelChartTitle}>IUCN 受胁等级</h3>
                          <ProtectionDonutChart
                            breakdown={dash.iucnBreakdown}
                            colorMap={IUCN_COLORS}
                            className={styles.protectionDonut}
                          />
                        </div>
                      </div>

                      <div className={styles.placePanelCharts3}>
                        <div className={styles.placePanelChart}>
                          <h3 className={styles.placePanelChartTitle}>
                            高频鸟种 Top 10
                            <span className={styles.placePanelCount}>
                              {(dash.topSpecies || []).length}
                            </span>
                          </h3>
                          <p className={styles.placePanelSub}>按出现记录条数</p>
                          {(dash.topSpecies || []).length === 0 ? (
                            <div className={styles.dashEmpty}>暂无</div>
                          ) : (
                            <ul className={styles.protectedSpeciesList}>
                              {(dash.topSpecies || []).map((b) => (
                                <li key={`top-${b.birdId}`}>
                                  <SpeciesHoverChip
                                    name={b.name}
                                    href={`/birds/${b.birdId}`}
                                    className={styles.protectedSpeciesLink}
                                  >
                                    <strong>{b.name}</strong>
                                    <span>{b.count} 次</span>
                                  </SpeciesHoverChip>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                        <div className={styles.placePanelChart}>
                          <h3 className={styles.placePanelChartTitle}>
                            国家一级
                            <span className={styles.placePanelCount}>
                              {(dash.protectedClass1 || []).length}
                            </span>
                          </h3>
                          <p className={styles.placePanelSub}>已记录的国一保护鸟种</p>
                          {(dash.protectedClass1 || []).length === 0 ? (
                            <div className={styles.dashEmpty}>暂无</div>
                          ) : (
                            <ul className={styles.protectedSpeciesList}>
                              {(dash.protectedClass1 || []).map((b) => (
                                <li key={`c1-${b.birdId}`}>
                                  <SpeciesHoverChip
                                    name={b.name}
                                    href={`/birds/${b.birdId}`}
                                    className={styles.protectedSpeciesLink}
                                  >
                                    <strong>{b.name}</strong>
                                    <span>{b.count} 次</span>
                                  </SpeciesHoverChip>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                        <div className={styles.placePanelChart}>
                          <h3 className={styles.placePanelChartTitle}>
                            国家二级
                            <span className={styles.placePanelCount}>
                              {(dash.protectedClass2 || []).length}
                            </span>
                          </h3>
                          <p className={styles.placePanelSub}>已记录的国二保护鸟种</p>
                          {(dash.protectedClass2 || []).length === 0 ? (
                            <div className={styles.dashEmpty}>暂无</div>
                          ) : (
                            <ul className={styles.protectedSpeciesList}>
                              {(dash.protectedClass2 || []).map((b) => (
                                <li key={`c2-${b.birdId}`}>
                                  <SpeciesHoverChip
                                    name={b.name}
                                    href={`/birds/${b.birdId}`}
                                    className={styles.protectedSpeciesLink}
                                  >
                                    <strong>{b.name}</strong>
                                    <span>{b.count} 次</span>
                                  </SpeciesHoverChip>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className={styles.dashEmpty}>暂无名录数据</div>
                  )}
                </section>

                {stats?.categories?.length ? (
                  <section className={styles.placePanel} aria-label="按目科分类">
                    <div className={styles.placePanelHead}>
                      <div className={styles.placePanelHeadMain}>
                        <h2 className={styles.placePanelTitle}>按目 / 科</h2>
                        <p className={styles.placePanelSub}>点击展开该目；其下按科列出已观察鸟种</p>
                      </div>
                    </div>
                    <div className={styles.orderGrid}>
                      {stats.categories.map((cat) => {
                        const open = expandedCategory === cat.category;
                        const orderLabel = getOrderChineseName(cat.category);
                        const barPct = Math.min(
                          100,
                          Math.round(((Number(cat.species) || 0) / categoryMaxSpecies) * 100)
                        );
                        const families =
                          Array.isArray(cat.families) && cat.families.length > 0
                            ? cat.families
                            : [
                                {
                                  family: '未分类',
                                  species: cat.species,
                                  records: cat.records,
                                  speciesList: cat.speciesList || [],
                                },
                              ];
                        const familyCount = Number(cat.familyCount) || families.length;
                        return (
                          <article
                            key={cat.category}
                            className={`${styles.orderCard} ${open ? styles.orderCardOpen : ''}`}
                          >
                            <button
                              type="button"
                              className={styles.orderCardHeader}
                              onClick={() => setExpandedCategory(open ? null : cat.category)}
                              aria-expanded={open}
                            >
                              <div className={styles.orderTitleBlock}>
                                <span className={styles.orderTitle}>{orderLabel}</span>
                                {orderLabel !== cat.category ? (
                                  <span className={styles.orderLatin}>{cat.category}</span>
                                ) : null}
                              </div>
                              <div className={styles.orderMeta}>
                                <span className={styles.orderCountBadge}>
                                  {familyCount > 0 ? `${familyCount} 科 · ` : ''}
                                  {cat.species} 种
                                </span>
                                <span className={styles.orderChevron} aria-hidden>
                                  {open ? '▾' : '▸'}
                                </span>
                              </div>
                              <div className={styles.orderProgress} aria-hidden>
                                <div
                                  className={styles.orderProgressFill}
                                  style={{ width: `${barPct}%` }}
                                />
                              </div>
                            </button>
                            {open ? (
                              <div className={styles.orderSpeciesPanel}>
                                {families.map((fam) => {
                                  const familyLabel = getFamilyChineseName(fam.family);
                                  const names = fam.speciesList || [];
                                  if (names.length === 0) return null;
                                  return (
                                    <div
                                      key={`${cat.category}-${fam.family}`}
                                      className={styles.familyBlock}
                                    >
                                      <div className={styles.familyHead}>
                                        <div className={styles.familyTitleBlock}>
                                          <span className={styles.familyTitle}>{familyLabel}</span>
                                          {familyLabel !== fam.family ? (
                                            <span className={styles.familyLatin}>{fam.family}</span>
                                          ) : null}
                                        </div>
                                        <span className={styles.familyMeta}>
                                          {fam.species} 种
                                          {fam.records != null ? ` · ${fam.records} 次` : ''}
                                        </span>
                                      </div>
                                      <div className={styles.orderSpeciesGrid}>
                                        {names.map((name, i) => (
                                          <SpeciesHoverChip
                                            key={`${cat.category}-${fam.family}-${name}-${i}`}
                                            name={name}
                                            className={styles.orderSpeciesChip}
                                          />
                                        ))}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : null}
                          </article>
                        );
                      })}
                    </div>
                  </section>
                ) : null}

                {dash?.wordCloud?.length ? (
                  <section className={styles.placePanel} aria-label="鸟种记录热度">
                    <div className={styles.placePanelHead}>
                      <div className={styles.placePanelHeadMain}>
                        <h2 className={styles.placePanelTitle}>鸟种记录热度</h2>
                        <p className={styles.placePanelSub}>
                          字号按出现次数；横竖混排填满矩形，最多 100 种
                        </p>
                      </div>
                    </div>
                    <div className={styles.placePanelInset}>
                      <SpeciesWordCloud items={dash.wordCloud} maxWords={100} />
                    </div>
                  </section>
                ) : null}
              </>
            ) : null}

            {activeTab === 'places' ? (
              <>
                <FootprintAlbum
                  footprint={footprint}
                  dashProvinces={footprint?.provinces || []}
                />

                <section className={styles.placePanel} aria-label="地点统计">
                  <div className={styles.placePanelHead}>
                    <div className={styles.placePanelHeadMain}>
                      <h2 className={styles.placePanelTitle}>地点统计</h2>
                      <p className={styles.placePanelSub}>观鸟点、省份与地点明细</p>
                    </div>
                    <div className={`${styles.filterGroup} ${styles.dashYearFilter}`}>
                      <label htmlFor="places-year">统计范围</label>
                      <select
                        id="places-year"
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(e.target.value)}
                        className={styles.filterSelect}
                      >
                        <option value="">全部年份</option>
                        {Array.from({ length: 12 }, (_, i) => {
                          const y = new Date().getFullYear() - i;
                          return (
                            <option key={y} value={String(y)}>
                              {y}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  </div>

                  {dash ? (
                    <div className={styles.placePanelCharts}>
                      <div className={styles.placePanelChart}>
                        <h3 className={styles.placePanelChartTitle}>观鸟点鸟种 Top 10</h3>
                        <div className={styles.dashChartGrow}>
                          {dash.topLocations.length === 0 ? (
                            <div className={styles.dashEmpty}>暂无</div>
                          ) : (
                            <HorizontalBars
                              items={dash.topLocations.map((l) => ({ name: l.name, value: l.species }))}
                              barClass={styles.dashHFill}
                              styles={styles}
                            />
                          )}
                        </div>
                      </div>
                      <div className={styles.placePanelChart}>
                        <h3 className={styles.placePanelChartTitle}>省份鸟种</h3>
                        <div className={styles.dashChartGrow}>
                          {dash.provinces.length === 0 ? (
                            <div className={styles.dashEmpty}>记录中暂无省份信息</div>
                          ) : (
                            <HorizontalBars
                              items={dash.provinces.slice(0, 12).map((p) => ({ name: p.name, value: p.species }))}
                              barClass={styles.dashHFill}
                              styles={styles}
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {stats?.locations?.length ? (
                    <div className={styles.placePanelBlock}>
                      <div className={styles.placePanelBlockHead}>
                        <div>
                          <h3 className={styles.placePanelBlockTitle}>观察地点明细</h3>
                          <p className={styles.placePanelSub}>生境封面 · 点击展开鸟种 · 悬停看照片</p>
                        </div>
                        <div className="kb-view-seg kb-meta-seg" role="group" aria-label="封面风格">
                          <span className="kb-meta-label">显示</span>
                          {HABITAT_COVER_SETS.map((set) => (
                            <button
                              key={set.id}
                              type="button"
                              className={`kb-view-tab kb-meta-tab${
                                placeCoverSet === set.id ? ' is-active' : ''
                              }`}
                              aria-pressed={placeCoverSet === set.id}
                              onClick={() => updatePlaceCoverSet(set.id)}
                            >
                              {set.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className={styles.placeCoverGrid}>
                        {stats.locations.map((location, index) => {
                          const open = expandedLocation === location.name;
                          const barPct = Math.min(
                            100,
                            Math.round(((Number(location.species) || 0) / locationMaxSpecies) * 100)
                          );
                          const cover = placeLocationCovers.get(location.name);
                          const coverUrl = cover?.url || '';
                          return (
                            <article
                              key={location.name}
                              className={`${styles.placeCoverCard}${
                                open ? ` ${styles.placeCoverCardOpen}` : ''
                              }`}
                            >
                              <button
                                type="button"
                                className={styles.placeCoverHit}
                                onClick={() => setExpandedLocation(open ? null : location.name)}
                                aria-expanded={open}
                              >
                                <div className={styles.placeCoverMedia} aria-hidden="true">
                                  {coverUrl ? (
                                    <Image
                                      src={coverUrl}
                                      alt=""
                                      fill
                                      sizes="(max-width: 640px) 100vw, (max-width: 960px) 50vw, 220px"
                                      unoptimized
                                      className={styles.placeCoverImg}
                                    />
                                  ) : (
                                    <div className={styles.placeCoverFallback}>
                                      {String(location.name || '地').slice(0, 2)}
                                    </div>
                                  )}
                                  <div className={styles.placeCoverShade} />
                                  <span className={styles.placeCoverRank}>#{index + 1}</span>
                                </div>
                                <div className={styles.placeCoverBody}>
                                  <div className={styles.placeCoverTitleRow}>
                                    <h3 className={styles.placeCoverName}>{location.name}</h3>
                                    <span className={styles.orderChevron} aria-hidden>
                                      {open ? '▾' : '▸'}
                                    </span>
                                  </div>
                                  <div className={styles.placeCoverMeta}>
                                    <span>{location.species} 种</span>
                                    <span>{location.records} 次</span>
                                  </div>
                                  <div className={styles.orderProgress} aria-hidden>
                                    <div
                                      className={styles.orderProgressFill}
                                      style={{ width: `${barPct}%` }}
                                    />
                                  </div>
                                </div>
                              </button>
                              {open && location.speciesList?.length > 0 ? (
                                <div className={styles.orderSpeciesPanel}>
                                  <div className={styles.orderSpeciesGrid}>
                                    {location.speciesList.map((name, i) => (
                                      <SpeciesHoverChip
                                        key={`${location.name}-${name}-${i}`}
                                        name={name}
                                        className={styles.orderSpeciesChip}
                                      />
                                    ))}
                                  </div>
                                </div>
                              ) : null}
                            </article>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                </section>

                {stats?.trends?.yearly?.length ? (
                  <section className={styles.placePanel} aria-label="年度地点明细">
                    <div className={styles.placePanelHead}>
                      <div className={styles.placePanelHeadMain}>
                        <h2 className={styles.placePanelTitle}>年度地点明细</h2>
                        <p className={styles.placePanelSub}>点击年份展开「地点 → 鸟种」</p>
                      </div>
                    </div>
                    <div className={styles.orderGrid}>
                      {stats.trends.yearly.map((yearRow) => {
                        const open = expandedYear === yearRow.year;
                        const detail =
                          open && stats.yearlyDetail ? stats.yearlyDetail[yearRow.year] : null;
                        return (
                          <article
                            key={yearRow.year}
                            className={`${styles.orderCard} ${open ? styles.orderCardOpen : ''}`}
                          >
                            <button
                              type="button"
                              className={styles.orderCardHeader}
                              onClick={() => setExpandedYear(open ? null : yearRow.year)}
                              aria-expanded={open}
                            >
                              <div className={styles.orderTitleBlock}>
                                <span className={styles.orderTitle}>{yearRow.year}</span>
                              </div>
                              <div className={styles.orderMeta}>
                                <span className={styles.orderCountBadge}>{yearRow.species} 种</span>
                                <span className={styles.orderRecordsMeta}>{yearRow.records} 次</span>
                                <span className={styles.orderChevron} aria-hidden>
                                  {open ? '▾' : '▸'}
                                </span>
                              </div>
                            </button>
                            {Array.isArray(detail) && detail.length > 0 ? (
                              <div className={styles.orderSpeciesPanel}>
                                {detail.map((item, idx) => (
                                  <div key={`${yearRow.year}-${item.location}-${idx}`} className={styles.yearPlaceBlock}>
                                    <div className={styles.yearPlaceName}>{item.location}</div>
                                    <div className={styles.orderSpeciesGrid}>
                                      {(item.species || []).map((name, i) => (
                                        <SpeciesHoverChip
                                          key={`${item.location}-${name}-${i}`}
                                          name={name}
                                          className={styles.orderSpeciesChip}
                                        />
                                      ))}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : null}
                          </article>
                        );
                      })}
                    </div>
                  </section>
                ) : null}

              </>
            ) : null}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}

export default function PersonalStatsPage() {
  return (
    <Suspense
      fallback={
        <div className={styles.container}>
          <Navbar />
          <main className={`${styles.main} ${styles.dashboardMain}`}>
            <SimplePageHeader
              title="个人统计"
              description={STATS_CAPTION}
              descriptionVariant="caption"
            />
            <PageState type="loading" title="个人统计加载中..." />
          </main>
          <Footer />
        </div>
      }
    >
      <PersonalStatsPageClient />
    </Suspense>
  );
}

function maxOf(items, getVal) {
  let m = 0;
  items.forEach((it) => {
    const v = getVal(it);
    if (v > m) m = v;
  });
  return m || 1;
}

function VerticalBars({
  items,
  barClass,
  stackClass,
  styles: s,
  showNewBadge = false,
  valueInBar = false,
}) {
  const maxV = maxOf(items, (x) => x.value);
  return (
    <div className={`${s.dashVChart}${valueInBar ? ` ${s.dashVChartInBar}` : ''}`}>
      {items.map((it, idx) => {
        const value = Number(it.value) || 0;
        const newValue = Math.min(Number(it.newValue) || 0, value);
        const restValue = Math.max(0, value - newValue);
        const pct = value === 0 ? 0 : Math.max(8, (value / maxV) * 100);
        const newPct = value > 0 ? (newValue / value) * 100 : 0;
        const restPct = value > 0 ? (restValue / value) * 100 : 0;
        const title = showNewBadge
          ? `${it.label}: ${value} 种（新种 ${newValue}）`
          : `${it.label}: ${value}`;
        return (
          <div key={idx} className={s.dashVCol}>
            {!valueInBar ? (
              <div className={s.dashVMeta}>
                <div className={s.dashVVal}>{value}</div>
                {showNewBadge && newValue > 0 ? (
                  <div className={s.dashVNew} title={`${it.label}新种 ${newValue}`}>
                    新{newValue}
                  </div>
                ) : showNewBadge ? (
                  <div className={s.dashVNewPlaceholder} aria-hidden="true" />
                ) : null}
              </div>
            ) : null}
            <div className={s.dashVTrack}>
              <div className={s.dashVBarStack} style={{ height: `${pct}%` }} title={title}>
                {showNewBadge && newValue > 0 && restValue > 0 ? (
                  <>
                    <div
                      className={`${s.dashVBarSeg} ${barClass}`}
                      style={{ flexGrow: Math.max(restPct, 1) }}
                    >
                      {valueInBar && pct >= 22 ? (
                        <span className={s.dashVBarLabel}>{restValue}</span>
                      ) : null}
                    </div>
                    <div
                      className={`${s.dashVBarSeg} ${stackClass || s.dashVBarStackRed}`}
                      style={{ flexGrow: Math.max(newPct, 10) }}
                    >
                      {valueInBar && pct >= 20 ? (
                        <span className={s.dashVBarLabel}>{newValue}</span>
                      ) : null}
                    </div>
                  </>
                ) : (
                  <div
                    className={`${s.dashVBarSeg} ${
                      showNewBadge && newValue > 0 ? stackClass || s.dashVBarStackRed : barClass
                    }`}
                    style={{ flexGrow: 1 }}
                  >
                    {valueInBar && value > 0 && pct >= 16 ? (
                      <span className={s.dashVBarLabel}>{value}</span>
                    ) : null}
                  </div>
                )}
              </div>
            </div>
            <div className={s.dashVLabel}>{it.label}</div>
          </div>
        );
      })}
    </div>
  );
}

function HorizontalBars({ items, barClass, styles: s }) {
  const maxV = maxOf(items, (x) => x.value);
  return (
    <div className={s.dashHList}>
      {items.map((it, idx) => (
        <div key={idx} className={s.dashHRow}>
          <div className={s.dashHName} title={it.name}>
            {it.href ? <Link href={it.href}>{it.name}</Link> : it.name}
          </div>
          <div className={s.dashHTrack}>
            <div
              className={barClass}
              style={{ width: it.value === 0 ? 0 : `${Math.max(3, (it.value / maxV) * 100)}%` }}
            />
          </div>
          <div className={s.dashHNum}>{it.value}</div>
        </div>
      ))}
    </div>
  );
}

