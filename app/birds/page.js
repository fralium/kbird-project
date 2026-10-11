'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import CategoryDisplay from '@/components/CategoryDisplay';
import { getOrderChineseName, getFamilyChineseName, formatTaxonomyDisplay } from '@/data/taxonomyTranslation';
import PageState from '@/components/PageState';
import SimplePageHeader, {
  HeaderPrimaryLink,
  HeaderTextButton,
} from '@/components/SimplePageHeader';
import HTMLPDFExporter from '@/components/HTMLPDFExporter';
import { useAuth } from '@/components/AuthProvider';
import BirdSearchField from '@/components/BirdSearchField';
import FoldFilterPanel from '@/components/FoldFilterPanel';
import { api } from '@/utils/api';
import { BIRD_SEARCH_PLACEHOLDER } from '@/utils/birdSearchUi';
import { readCardStyle, writeCardStyle } from '@/utils/habitatCover';
import { formatDisplayDate } from '@/utils/localDate';
import styles from '@/styles/BirdList.module.css';

const VIEW_MODE_STORAGE_KEY = 'kbird-bird-list-view-mode';
const CURRENT_YEAR = new Date().getFullYear();

const GRID_MIN_CARD_PX = 240;
const GRID_GAP_PX = 16;
const PAGE_CONTENT_MAX_PX = 1720;
const MAIN_PADDING_X_PX = 64;

function formatObservedDate(value) {
  if (!value) return '';
  return formatDisplayDate(value, 'medium');
}

function parsePageParam(value) {
  const page = Number.parseInt(String(value || '1'), 10);
  return Number.isFinite(page) && page >= 1 ? page : 1;
}

/** 按当前视口估算网格列数，使每页数量为整行倍数，避免末行空缺 */
function computeBirdPageLimit(viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1200) {
  if (viewportWidth <= 768) return 12;

  const contentWidth = Math.min(Math.max(viewportWidth - MAIN_PADDING_X_PX, GRID_MIN_CARD_PX), PAGE_CONTENT_MAX_PX);
  const columns = Math.max(1, Math.floor((contentWidth + GRID_GAP_PX) / (GRID_MIN_CARD_PX + GRID_GAP_PX)));
  // 宽屏约 3 行铺满；窄桌面列少时多给几行，避免一页太短
  const rows = columns >= 5 ? 3 : columns >= 3 ? 4 : 6;
  return Math.min(30, Math.max(6, columns * rows));
}

function getInitialBirdPageLimit() {
  if (typeof window === 'undefined') return 15;
  return computeBirdPageLimit(window.innerWidth);
}

export default function BirdListPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { token, loading: authLoading } = useAuth();
  const [birds, setBirds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [yearFilter, setYearFilter] = useState('');
  const [summary, setSummary] = useState({ speciesCount: 0, locationCount: 0 });
  const [filters, setFilters] = useState({
    order: '',
    family: '',
    iucnProtectionLevel: '',
    chinaProtectionLevel: '',
  });

  const [filterOptions, setFilterOptions] = useState({
    categories: [],
    families: [],
    allFamilies: [],
    categoryToFamilies: {},
    iucnLevels: [],
    chinaLevels: [],
  });
  const [pagination, setPagination] = useState(() => ({
    page: parsePageParam(searchParams.get('page')),
    limit: getInitialBirdPageLimit(),
    total: 0,
    pages: 0,
  }));
  const [favoriteLoading, setFavoriteLoading] = useState(false);
  const [userFavorites, setUserFavorites] = useState([]);
  const [sortValue, setSortValue] = useState('lastObserved-desc');
  const [viewMode, setViewMode] = useState('simple');
  const [cardStyle, setCardStyle] = useState('field');
  const [showPDFExporter, setShowPDFExporter] = useState(false);

  useEffect(() => {
    setCardStyle(readCardStyle());
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    let resizeTimer = null;
    const syncPageLimit = () => {
      const nextLimit = computeBirdPageLimit(window.innerWidth);
      setPagination((prev) => {
        if (prev.limit === nextLimit) return prev;
        // 仅更新每页数量，保留当前页；超出总页数时由拉取结果再钳制
        return {
          ...prev,
          limit: nextLimit,
        };
      });
    };

    syncPageLimit();
    const onResize = () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(syncPageLimit, 150);
    };
    window.addEventListener('resize', onResize);
    return () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  // 页码写入 URL，刷新后可回到当前页
  useEffect(() => {
    const urlPageRaw = searchParams.get('page');
    const urlPage = parsePageParam(urlPageRaw);
    const shouldOmitPage = pagination.page <= 1;

    if (shouldOmitPage && (urlPageRaw === null || urlPageRaw === '')) return;
    if (!shouldOmitPage && urlPage === pagination.page) return;

    const params = new URLSearchParams(searchParams.toString());
    if (shouldOmitPage) {
      params.delete('page');
    } else {
      params.set('page', String(pagination.page));
    }
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [pagination.page, pathname, router, searchParams]);
  useEffect(() => {
    let cancelled = false;

    const fetchBirds = async () => {
      try {
        setLoading(true);
        const queryParams = new URLSearchParams({
          page: pagination.page.toString(),
          limit: pagination.limit.toString(),
          hasRecordsOnly: 'true',
        });

        const [sortBy, sortOrder] = sortValue.split('-');
        if (sortBy && sortOrder) {
          queryParams.append('sortBy', sortBy);
          queryParams.append('sortOrder', sortOrder);
        }

        if (searchTerm.trim()) {
          queryParams.append('search', searchTerm.trim());
        }
        if (yearFilter) queryParams.append('year', yearFilter);
        if (filters.order) queryParams.append('order', filters.order);
        if (filters.family) queryParams.append('family', filters.family);
        if (filters.iucnProtectionLevel) queryParams.append('iucnProtectionLevel', filters.iucnProtectionLevel);
        if (filters.chinaProtectionLevel) queryParams.append('chinaProtectionLevel', filters.chinaProtectionLevel);

        const data = await api.birds.getAll(Object.fromEntries(queryParams.entries()));
        if (cancelled) return;

        if (data.success) {
          setBirds(data.data);
          setPagination((prev) => {
            const total = data.total || data.data.length;
            const pages = data.pages || Math.ceil(total / prev.limit) || 0;
            const page = pages > 0 ? Math.min(prev.page, pages) : 1;
            return {
              ...prev,
              total,
              pages,
              page,
            };
          });
          setSummary({
            speciesCount: Number(data.summary?.speciesCount ?? data.total ?? 0),
            locationCount: Number(data.summary?.locationCount ?? 0),
          });
        } else {
          console.error('获取鸟类数据失败:', data.message);
        }
      } catch (error) {
        if (cancelled) return;
        console.error('获取鸟类数据失败:', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchBirds();
    return () => {
      cancelled = true;
    };
  }, [pagination.limit, pagination.page, searchTerm, filters, sortValue, yearFilter]);

  useEffect(() => {
    const fetchFilterOptions = async () => {
      try {
        const params = { hasRecordsOnly: 'true' };
        if (yearFilter) params.year = yearFilter;
        const data = await api.birds.getFilterOptions(params);
        if (!data.success || !data.data) {
          throw new Error(data.message || '获取鸟类筛选数据失败');
        }

        const next = data.data;
        setFilterOptions({
          categories: Array.isArray(next.categories) ? next.categories : [],
          families: Array.isArray(next.allFamilies) ? next.allFamilies : [],
          allFamilies: Array.isArray(next.allFamilies) ? next.allFamilies : [],
          categoryToFamilies: next.categoryToFamilies || {},
          iucnLevels: Array.isArray(next.iucnLevels) ? next.iucnLevels : [],
          chinaLevels: Array.isArray(next.chinaLevels) ? next.chinaLevels : [],
        });

        setFilters((prev) => {
          const nextOrder = prev.order && (next.categories || []).includes(prev.order) ? prev.order : '';
          const familiesForOrder =
            nextOrder && next.categoryToFamilies?.[nextOrder]
              ? next.categoryToFamilies[nextOrder]
              : next.allFamilies || [];
          const nextFamily = prev.family && familiesForOrder.includes(prev.family) ? prev.family : '';
          return {
            ...prev,
            order: nextOrder,
            family: nextFamily,
            iucnProtectionLevel:
              prev.iucnProtectionLevel && (next.iucnLevels || []).includes(prev.iucnProtectionLevel)
                ? prev.iucnProtectionLevel
                : '',
            chinaProtectionLevel:
              prev.chinaProtectionLevel && (next.chinaLevels || []).includes(prev.chinaProtectionLevel)
                ? prev.chinaProtectionLevel
                : '',
          };
        });
      } catch (error) {
        console.error('获取过滤选项失败:', error);
      }
    };

    fetchFilterOptions();
  }, [yearFilter]);

  useEffect(() => {
    if (authLoading) return;
    const fetchUserFavorites = async () => {
      if (!token) {
        setUserFavorites([]);
        return;
      }
      try {
        const data = await api.users.getFavorites();
        if (data.success) {
          setUserFavorites((data.data || []).map((bird) => bird._id).filter(Boolean));
        }
      } catch (error) {
        // 后端短暂不可用时不影响鸟种列表；收藏心形稍后刷新即可
        if (
          error.status === 401 ||
          error.status === 502 ||
          error.status === 503 ||
          error.status === 504 ||
          error.status === 0
        ) {
          setUserFavorites([]);
          return;
        }
        console.error('获取收藏失败:', error);
      }
    };
    fetchUserFavorites();
  }, [authLoading, token]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const viewParam = searchParams.get('view');
    if (viewParam === 'simple' || viewParam === 'place' || viewParam === 'detailed') {
      setViewMode(viewParam);
      window.localStorage.setItem(VIEW_MODE_STORAGE_KEY, viewParam);
      return;
    }
    const savedMode = window.localStorage.getItem(VIEW_MODE_STORAGE_KEY);
    if (savedMode === 'simple' || savedMode === 'place' || savedMode === 'detailed') {
      setViewMode(savedMode);
    }
  }, [searchParams]);

  const handleViewModeChange = (mode) => {
    setViewMode(mode);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(VIEW_MODE_STORAGE_KEY, mode);
    }
  };

  const handleCardStyleChange = (style) => {
    const next = style === 'scrap' ? 'scrap' : 'field';
    setCardStyle(next);
    writeCardStyle(next);
  };

  const paginatedBirds = birds.map((bird) => ({
    ...bird,
    isFavorited: userFavorites.includes(bird._id),
  }));
  const totalPages = pagination.pages;

  const handleSearch = (next) => {
    setSearchTerm(typeof next === 'string' ? next : next?.target?.value || '');
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const handleFilterChange = (filterType, value) => {
    setFilters((prev) => {
      const newFilters = {
        ...prev,
        [filterType]: value,
      };

      if (filterType === 'order') {
        newFilters.family = '';
        if (value && filterOptions.categoryToFamilies?.[value]) {
          setFilterOptions((prevOptions) => ({
            ...prevOptions,
            families: filterOptions.categoryToFamilies[value],
          }));
        } else {
          setFilterOptions((prevOptions) => ({
            ...prevOptions,
            families: prevOptions.allFamilies || [],
          }));
        }
      }

      return newFilters;
    });
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const clearFilters = () => {
    setSearchTerm('');
    setYearFilter('');
    setFilters({
      order: '',
      family: '',
      iucnProtectionLevel: '',
      chinaProtectionLevel: '',
    });
    setFilterOptions((prevOptions) => ({
      ...prevOptions,
      families: prevOptions.allFamilies || [],
    }));
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const hasActiveFilters = Boolean(
    searchTerm ||
      yearFilter ||
      filters.order ||
      filters.family ||
      filters.iucnProtectionLevel ||
      filters.chinaProtectionLevel
  );

  const filterPanelSummary = (() => {
    const parts = [];
    if (searchTerm.trim()) parts.push(`搜索「${searchTerm.trim()}」`);
    if (yearFilter) parts.push(`${yearFilter} 年`);
    if (filters.order) {
      parts.push(formatTaxonomyDisplay(getOrderChineseName(filters.order), filters.order));
    }
    if (filters.family) {
      parts.push(formatTaxonomyDisplay(getFamilyChineseName(filters.family), filters.family));
    }
    if (filters.iucnProtectionLevel) parts.push(`IUCN ${filters.iucnProtectionLevel}`);
    if (filters.chinaProtectionLevel) parts.push(filters.chinaProtectionLevel);
    if (parts.length === 0) return '搜索 · 年份 · 目科 · 保护等级';
    return parts.join(' · ');
  })();

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setLoading(true);
      setPagination((prev) => ({ ...prev, page: newPage }));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleFavorite = async (event, birdId) => {
    event.preventDefault();
    event.stopPropagation();

    const token = localStorage.getItem('token');
    if (!token) {
      if (typeof window !== 'undefined' && window.showToast) {
        window.showToast('请先登录', 'warning', 2500);
      }
      return;
    }

    setFavoriteLoading(true);
    try {
      const isFavorited = userFavorites.includes(birdId);
      const data = isFavorited ? await api.users.removeFavorite(birdId) : await api.users.addFavorite(birdId);

      if (data.success) {
        if (isFavorited) {
          setUserFavorites((prev) => prev.filter((id) => id !== birdId));
        } else {
          setUserFavorites((prev) => [...prev, birdId]);
        }
        if (typeof window !== 'undefined' && window.showToast) {
          window.showToast(isFavorited ? '🪶 已从收藏中移除' : '🪶 已添加到收藏', 'success', 2200);
        }
      } else {
        console.error(data.message || '操作失败');
      }
    } catch (error) {
      console.error('操作失败，请重试', error);
    } finally {
      setFavoriteLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <Navbar />

      <main className={styles.main}>
        <SimplePageHeader
          title="已见鸟种"
          description="名录里已经记下的种"
          descriptionVariant="caption"
          actions={
            <>
              <HeaderTextButton onClick={() => setShowPDFExporter((prev) => !prev)}>
                {showPDFExporter ? '收起导出' : '导出名录'}
              </HeaderTextButton>
              <HeaderPrimaryLink href="/records/quick">记一笔</HeaderPrimaryLink>
            </>
          }
        />

        {showPDFExporter ? (
          <div className={styles.exportSection}>
            <HTMLPDFExporter
              birds={birds}
              selectedBirds={birds}
              filters={{
                category: filters.order,
                family: filters.family,
                iucnProtectionLevel: filters.iucnProtectionLevel,
                chinaProtectionLevel: filters.chinaProtectionLevel,
              }}
              searchTerm={[searchTerm.trim(), yearFilter ? `${yearFilter}年` : ''].filter(Boolean).join(' ')}
            />
          </div>
        ) : null}

        <div className={styles.filtersContainer}>
          <FoldFilterPanel
            storageKey="kbird.birds.filterPanel"
            title="筛选"
            summary={filterPanelSummary}
            className={styles.foldPanel}
          >
                <div className={styles.toolbarSearch}>
                  <BirdSearchField
                    className={styles.searchInput}
                    placeholder={BIRD_SEARCH_PLACEHOLDER}
                    value={searchTerm}
                    onChange={handleSearch}
                    ariaLabel="搜索已见鸟种"
                    size="sm"
                    roundedRect
                  />
                </div>

                <div className={styles.toolbarFilters}>
                  <label className={styles.filterField}>
                    <span className={styles.filterLabel}>年份</span>
                    <select
                      value={yearFilter}
                      onChange={(event) => {
                        setYearFilter(event.target.value);
                        setPagination((prev) => ({ ...prev, page: 1 }));
                      }}
                      className={styles.filterSelect}
                    >
                      <option value="">全部</option>
                      {Array.from({ length: 15 }, (_, i) => CURRENT_YEAR - i).map((y) => (
                        <option key={y} value={String(y)}>
                          {y} 年
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className={styles.filterField}>
                    <span className={styles.filterLabel}>目</span>
                    <select
                      value={filters.order}
                      onChange={(event) => handleFilterChange('order', event.target.value)}
                      className={styles.filterSelect}
                    >
                      <option value="">全部</option>
                      {filterOptions.categories.map((category) => (
                        <option key={category} value={category}>
                          {formatTaxonomyDisplay(getOrderChineseName(category), category)}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className={styles.filterField}>
                    <span className={styles.filterLabel}>科</span>
                    <select
                      value={filters.family}
                      onChange={(event) => handleFilterChange('family', event.target.value)}
                      className={styles.filterSelect}
                    >
                      <option value="">全部</option>
                      {(filters.order && filterOptions.categoryToFamilies?.[filters.order]
                        ? filterOptions.categoryToFamilies[filters.order]
                        : filterOptions.families
                      ).map((family) => (
                        <option key={family} value={family}>
                          {formatTaxonomyDisplay(getFamilyChineseName(family), family)}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className={styles.filterField}>
                    <span className={styles.filterLabel}>IUCN</span>
                    <select
                      value={filters.iucnProtectionLevel}
                      onChange={(event) => handleFilterChange('iucnProtectionLevel', event.target.value)}
                      className={styles.filterSelect}
                    >
                      <option value="">全部</option>
                      {filterOptions.iucnLevels.map((level) => (
                        <option key={level} value={level}>
                          {level}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className={styles.filterField}>
                    <span className={styles.filterLabel}>国内保护</span>
                    <select
                      value={filters.chinaProtectionLevel}
                      onChange={(event) => handleFilterChange('chinaProtectionLevel', event.target.value)}
                      className={styles.filterSelect}
                    >
                      <option value="">全部</option>
                      {filterOptions.chinaLevels.map((level) => (
                        <option key={level} value={level}>
                          {level}
                        </option>
                      ))}
                    </select>
                  </label>

                  {hasActiveFilters ? (
                    <div className={styles.filterField}>
                      <span className={styles.filterLabel} aria-hidden="true">
                        &nbsp;
                      </span>
                      <button onClick={clearFilters} className={styles.clearButton} type="button">
                        清除
                      </button>
                    </div>
                  ) : null}
                </div>
          </FoldFilterPanel>

          {!loading ? (
            <div className={styles.toolbarMeta}>
              <div className={styles.toolbarMetaLeft}>
                <span className={styles.resultsCount}>
                  {pagination.total} 种
                  {summary.locationCount > 0 ? (
                    <span className={styles.resultsCountMuted}> · {summary.locationCount} 观测点</span>
                  ) : null}
                </span>
                {totalPages > 1 ? (
                  <div className="kb-view-seg kb-meta-seg" aria-label="快速翻页">
                    <button
                      type="button"
                      className="kb-view-tab kb-meta-tab"
                      onClick={() => handlePageChange(pagination.page - 1)}
                      disabled={pagination.page === 1}
                      aria-label="上一页"
                    >
                      ←
                    </button>
                    <span className="kb-meta-index">
                      {pagination.page}/{totalPages}
                    </span>
                    <button
                      type="button"
                      className="kb-view-tab kb-meta-tab"
                      onClick={() => handlePageChange(pagination.page + 1)}
                      disabled={pagination.page === totalPages}
                      aria-label="下一页"
                    >
                      →
                    </button>
                  </div>
                ) : null}
              </div>

              <div className={styles.toolbarMetaRight}>
                <div className="kb-view-seg kb-meta-seg" role="group" aria-label="页面显示">
                  <span className="kb-meta-label">显示</span>
                  <button
                    type="button"
                    className={`kb-view-tab kb-meta-tab${cardStyle === 'field' ? ' is-active' : ''}`}
                    aria-pressed={cardStyle === 'field'}
                    onClick={() => handleCardStyleChange('field')}
                  >
                    实地
                  </button>
                  <button
                    type="button"
                    className={`kb-view-tab kb-meta-tab${cardStyle === 'scrap' ? ' is-active' : ''}`}
                    aria-pressed={cardStyle === 'scrap'}
                    onClick={() => handleCardStyleChange('scrap')}
                  >
                    手账
                  </button>
                </div>
                <div className="kb-view-seg kb-meta-seg" role="group" aria-label="卡片显示模式">
                  <button
                    type="button"
                    className={`kb-view-tab kb-meta-tab${viewMode === 'simple' ? ' is-active' : ''}`}
                    onClick={() => handleViewModeChange('simple')}
                  >
                    简版
                  </button>
                  <button
                    type="button"
                    className={`kb-view-tab kb-meta-tab${viewMode === 'place' ? ' is-active' : ''}`}
                    onClick={() => handleViewModeChange('place')}
                  >
                    地点
                  </button>
                  <button
                    type="button"
                    className={`kb-view-tab kb-meta-tab${viewMode === 'detailed' ? ' is-active' : ''}`}
                    onClick={() => handleViewModeChange('detailed')}
                  >
                    详细
                  </button>
                </div>
                <label className={styles.sortField}>
                  <span className={styles.srOnly}>排序</span>
                  <select
                    value={sortValue}
                    onChange={(event) => {
                      setSortValue(event.target.value);
                      setPagination((prev) => ({ ...prev, page: 1 }));
                    }}
                    className={styles.sortSelect}
                    aria-label="排序"
                  >
                    <option value="lastObserved-desc">最近观察（新→旧）</option>
                    <option value="lastObserved-asc">最近观察（旧→新）</option>
                    <option value="firstObserved-asc">首次观察（旧→新）</option>
                    <option value="firstObserved-desc">首次观察（新→旧）</option>
                    <option value="recordCount-desc">观测次数（多→少）</option>
                    <option value="recordCount-asc">观测次数（少→多）</option>
                    <option value="name-asc">名称（A→Z）</option>
                    <option value="name-desc">名称（Z→A）</option>
                    <option value="protection-desc">保护等级（高→低）</option>
                    <option value="protection-asc">保护等级（低→高）</option>
                    <option value="priority-desc">综合推荐</option>
                  </select>
                </label>
              </div>
            </div>
          ) : null}
        </div>

        {loading ? (
          <PageState type="loading" title="正在加载已见鸟种..." />
        ) : paginatedBirds.length === 0 ? (
          <PageState
            type="empty"
            title={yearFilter ? `${yearFilter} 年还没有观察记录` : '还没有已见鸟种'}
            message={
              yearFilter
                ? '换一年份试试，或记一笔 / 导入记录中心表格。'
                : '记一笔观察，或导入中国鸟类记录中心表格，这里会列出你见过的种。'
            }
            actionLabel="记一笔"
            onAction={() => {
              if (typeof window !== 'undefined') {
                window.location.assign('/records/add');
              }
            }}
            secondaryActionLabel="导入"
            onSecondaryAction={() => {
              if (typeof window !== 'undefined') {
                window.location.assign('/personal/manage?tab=import');
              }
            }}
          />
        ) : (
          <>
            <div className={`${styles.birdGrid}${cardStyle === 'scrap' ? ` ${styles.birdGridScrap}` : ''}`}>
              {paginatedBirds.map((bird) => {
                const primaryImage =
                  bird.images && bird.images.length > 0
                    ? (typeof bird.images[0] === 'string' ? bird.images[0] : bird.images[0]?.url)
                    : '';
                const shouldOptimizeImage = typeof primaryImage === 'string' && primaryImage.startsWith('/');
                const recordCount = Number(bird.recordCount || 0);
                const lastObservedLabel = bird.lastObserved ? formatObservedDate(bird.lastObserved) : '';
                const firstObservedLabel = bird.firstObserved ? formatObservedDate(bird.firstObserved) : '';
                const firstSeenLocation = String(bird.firstSeenLocation || '').trim();
                const showFirstObserved = sortValue.startsWith('firstObserved') || viewMode === 'place';
                const dateLabel = showFirstObserved
                  ? (firstObservedLabel ? `首次 ${firstObservedLabel}` : '首次日期未知')
                  : (lastObservedLabel ? `最近 ${lastObservedLabel}` : '日期未知');

                const scrap = cardStyle === 'scrap';
                const photo = (
                  <>
                    {primaryImage ? (
                      <Image
                        src={primaryImage}
                        alt={bird.name}
                        {...(scrap
                          ? { fill: true, sizes: '(max-width: 900px) 100vw, 240px' }
                          : { width: 420, height: 280 })}
                        unoptimized={!shouldOptimizeImage}
                        className={styles.birdImage}
                        onError={(event) => {
                          event.target.style.display = 'none';
                          const placeholder = event.target.nextElementSibling;
                          if (placeholder) placeholder.style.display = 'flex';
                        }}
                      />
                    ) : null}
                    <div
                      className={styles.birdImagePlaceholder}
                      style={{ display: primaryImage ? 'none' : 'flex' }}
                    >
                      <div className={styles.placeholderText}>{bird.name}</div>
                    </div>
                  </>
                );

                return (
                  <div key={bird._id} className={`${styles.birdCard}${scrap ? ` ${styles.birdCardScrap}` : ''}`}>
                    <Link href={`/birds/${bird._id}`} className={styles.birdCardLink}>
                      {scrap ? (
                        <div className={styles.scrapSheet}>
                          <div className={styles.scrapPanel}>
                            <span className={styles.scrapTape} aria-hidden="true" />
                            <div className={styles.scrapPhoto}>{photo}</div>
                          </div>
                        </div>
                      ) : (
                        <div className={styles.birdImageContainer}>{photo}</div>
                      )}
                    </Link>
                    <div className={`${styles.birdInfo}${scrap ? ` ${styles.scrapNote}` : ''}`}>
                      <div className={styles.birdHeader}>
                        <Link href={`/birds/${bird._id}`} className={styles.birdNameLink}>
                          <h3 className={scrap ? styles.scrapName : undefined}>{bird.name}</h3>
                        </Link>
                        <button
                          type="button"
                          className={`${styles.favoriteButton} ${bird.isFavorited ? styles.favorited : ''}`}
                          onClick={(event) => handleFavorite(event, bird._id)}
                          disabled={favoriteLoading}
                          aria-label={bird.isFavorited ? '取消收藏' : '收藏'}
                          title={bird.isFavorited ? '取消收藏' : '收藏'}
                        >
                          {favoriteLoading ? '…' : (bird.isFavorited ? '★' : '☆')}
                        </button>
                      </div>

                      <Link href={`/birds/${bird._id}`} className={styles.birdInfoLink}>
                        <div className={styles.lifeListStats}>
                          <span className={styles.lifeListCount}>{recordCount} 次</span>
                          <span className={scrap ? styles.scrapStamp : styles.lifeListDate}>{dateLabel}</span>
                        </div>

                        {viewMode === 'place' ? (
                          <p className={styles.lifeListPlace}>
                            {firstSeenLocation ? `首次地点 · ${firstSeenLocation}` : '首次地点未知'}
                          </p>
                        ) : null}

                        {viewMode === 'detailed' ? <p className={styles.scientificName}>{bird.scientificName}</p> : null}
                        {viewMode === 'detailed' ? (
                          <div className={styles.birdMeta}>
                            <div className={styles.categoryContainer}>
                              <CategoryDisplay category={bird.category} variant="compact" bird={bird} />
                            </div>
                            <div className={styles.protectionStatus}>
                              {bird.iucnProtectionLevel ? (
                                <span className={`${styles.status} ${styles.iucn}`}>IUCN: {bird.iucnProtectionLevel}</span>
                              ) : (
                                <span className={`${styles.status} ${styles.default}`}>未评估</span>
                              )}

                              {bird.chinaProtectionLevel && bird.chinaProtectionLevel !== '未列入' ? (
                                <span className={`${styles.status} ${styles.china}`}>中国: {bird.chinaProtectionLevel}</span>
                              ) : (
                                <span className={`${styles.status} ${styles.placeholder}`}>中国: 未列入</span>
                              )}
                            </div>
                          </div>
                        ) : null}
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>

          </>
        )}
      </main>

      <Footer />
    </div>
  );
}
