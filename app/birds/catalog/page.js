'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import Navbar from '../../../components/Navbar';
import Footer from '../../../components/Footer';
import HTMLPDFExporter from '../../../components/HTMLPDFExporter';
import SimplePageHeader, {
  HeaderPrimaryLink,
  HeaderTextButton,
} from '../../../components/SimplePageHeader';
import { getOrderChineseName, getFamilyChineseName, formatTaxonomyDisplay } from '../../../data/taxonomyTranslation';
import { api } from '../../../utils/api';
import styles from '../../../styles/BirdCatalog.module.css';

const FILTER_PANEL_STORAGE_KEY = 'kbird.catalog.filterPanel';
const VIEW_MODE_STORAGE_KEY = 'kbird.catalog.viewMode';

function readCatalogFilterPanelOpen() {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(FILTER_PANEL_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function writeCatalogFilterPanelOpen(open) {
  try {
    localStorage.setItem(FILTER_PANEL_STORAGE_KEY, open ? '1' : '0');
  } catch {
    /* ignore */
  }
}

function readCatalogViewMode() {
  if (typeof window === 'undefined') return 'card';
  try {
    const raw = localStorage.getItem(VIEW_MODE_STORAGE_KEY);
    if (raw === 'card' || raw === 'table') return raw;
  } catch {
    /* ignore */
  }
  return 'card';
}

function writeCatalogViewMode(mode) {
  try {
    localStorage.setItem(VIEW_MODE_STORAGE_KEY, mode === 'card' ? 'card' : 'table');
  } catch {
    /* ignore */
  }
}

function firstBirdImageUrl(images) {
  if (!Array.isArray(images) || images.length === 0) return '';
  const first = images.find((img) => img && (img.url || typeof img === 'string'));
  if (!first) return '';
  return typeof first === 'string' ? first : String(first.url || '').trim();
}

export default function BirdCatalog() {
  const [birds, setBirds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeSearchTerm, setActiveSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState('asc');
  const [showPDFExporter, setShowPDFExporter] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [retryNonce, setRetryNonce] = useState(0);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const pageSizeOptions = [25, 50, 100];
  const [pagination, setPagination] = useState({
    total: 0,
    pages: 0,
  });

  const [filters, setFilters] = useState({
    order: '',
    family: '',
    iucnProtectionLevel: '',
    chinaProtectionLevel: '',
  });
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [viewMode, setViewMode] = useState('card');

  const [filterOptions, setFilterOptions] = useState({
    categories: [],
    families: [],
    allFamilies: [],
    categoryToFamilies: {},
    iucnLevels: [],
    chinaLevels: [],
  });

  const handleSearch = () => {
    setActiveSearchTerm(searchTerm);
    setCurrentPage(1);
  };

  useEffect(() => {
    setFilterPanelOpen(readCatalogFilterPanelOpen());
    setViewMode(readCatalogViewMode());
  }, []);

  const handleClearSearch = () => {
    setSearchTerm('');
    setActiveSearchTerm('');
    setCurrentPage(1);
  };

  useEffect(() => {
    const fetchBirds = async () => {
      try {
        setLoading(true);
        const queryParams = new URLSearchParams({
          page: currentPage.toString(),
          limit: itemsPerPage.toString(),
        });

        if (activeSearchTerm.trim()) {
          queryParams.append('search', activeSearchTerm.trim());
        }
        if (filters.order) queryParams.append('order', filters.order);
        if (filters.family) queryParams.append('family', filters.family);
        if (filters.iucnProtectionLevel) queryParams.append('iucnProtectionLevel', filters.iucnProtectionLevel);
        if (filters.chinaProtectionLevel) queryParams.append('chinaProtectionLevel', filters.chinaProtectionLevel);

        queryParams.append('sortBy', 'name');
        queryParams.append('sortOrder', sortOrder === 'desc' ? 'desc' : 'asc');

        const data = await api.birds.getAll(Object.fromEntries(queryParams.entries()));
        if (data.success) {
          setBirds(data.data);
          setPagination({
            total: data.total || 0,
            pages: data.pages || 0,
          });
        } else {
          setError(data.message || '获取鸟类数据失败');
        }
      } catch {
        setError('网络错误');
      } finally {
        setLoading(false);
      }
    };

    fetchBirds();
  }, [currentPage, activeSearchTerm, sortOrder, itemsPerPage, filters, retryNonce]);

  useEffect(() => {
    const fetchAllBirdsForFilterOptions = async () => {
      const pageSize = 100;
      let page = 1;
      let totalPages = 1;
      const allBirds = [];

      while (page <= totalPages && page <= 100) {
        const data = await api.birds.getAll({
          page: String(page),
          limit: String(pageSize),
        });
        if (!data.success) {
          throw new Error(data.message || '获取鸟类筛选数据失败');
        }

        const pageBirds = Array.isArray(data.data) ? data.data : [];
        allBirds.push(...pageBirds);
        const parsedPages = Number(data.pages || data.pagination?.totalPages || 1);
        totalPages = Number.isFinite(parsedPages) && parsedPages > 0 ? parsedPages : totalPages;
        if (pageBirds.length === 0) break;
        page += 1;
      }

      return allBirds;
    };

    const fetchFilterOptions = async () => {
      try {
        const allBirds = await fetchAllBirdsForFilterOptions();
        const categories = [...new Set(allBirds.map((bird) => bird.order).filter(Boolean))].sort();
        const allFamilies = [...new Set(allBirds.map((bird) => bird.family).filter(Boolean))].sort();
        const categoryToFamilies = {};
        allBirds.forEach((bird) => {
          if (bird.order && bird.family) {
            if (!categoryToFamilies[bird.order]) {
              categoryToFamilies[bird.order] = [];
            }
            if (!categoryToFamilies[bird.order].includes(bird.family)) {
              categoryToFamilies[bird.order].push(bird.family);
            }
          }
        });
        Object.keys(categoryToFamilies).forEach((category) => {
          categoryToFamilies[category].sort();
        });

        const iucnLevels = [...new Set(allBirds.map((bird) => bird.iucnProtectionLevel).filter(Boolean))].sort();
        const chinaLevels = [...new Set(allBirds.map((bird) => bird.chinaProtectionLevel).filter(Boolean))].sort();

        setFilterOptions({
          categories,
          families: allFamilies,
          allFamilies,
          categoryToFamilies,
          iucnLevels,
          chinaLevels,
        });
      } catch (fetchError) {
        console.error('获取过滤选项失败:', fetchError);
      }
    };

    fetchFilterOptions();
  }, []);

  const totalPages = pagination.pages;
  const currentBirds = birds;
  const startIndex = (currentPage - 1) * itemsPerPage;

  const handleSearchChange = useCallback((event) => {
    setSearchTerm(event.target.value);
  }, []);

  const handleSortChange = (event) => {
    setSortOrder(event.target.value);
    setCurrentPage(1);
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
    setCurrentPage(1);
  };

  const clearFilters = () => {
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
    setCurrentPage(1);
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  const handlePageSizeChange = (event) => {
    const nextSize = Number(event.target.value);
    if (!pageSizeOptions.includes(nextSize)) return;
    setItemsPerPage(nextSize);
    setCurrentPage(1);
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <Navbar />
        <main className={styles.main}>
          <div className={styles.loadingContainer}>
            <div className={styles.loadingSpinner}></div>
            <p>正在加载鸟类数据...</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <Navbar />
        <main className={styles.main}>
          <div className={styles.errorContainer}>
            <h2>加载失败</h2>
            <p>{error}</p>
            <button onClick={() => setRetryNonce((prev) => prev + 1)} className={styles.retryButton}>
              重新加载
            </button>
          </div>
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
          title="鸟种名录"
          description={`${pagination.total} 种 · 本机共用`}
          descriptionVariant="caption"
          actions={
            <>
              <HeaderTextButton onClick={() => setShowPDFExporter(!showPDFExporter)}>
                {showPDFExporter ? '收起导出' : '导出名录'}
              </HeaderTextButton>
              <HeaderPrimaryLink href="/birds">已见鸟种</HeaderPrimaryLink>
            </>
          }
        />

        <div className={styles.foldPanel} aria-label="名录筛选">
          <button
            type="button"
            className={styles.foldToggle}
            onClick={() => {
              setFilterPanelOpen((prev) => {
                const next = !prev;
                writeCatalogFilterPanelOpen(next);
                return next;
              });
            }}
            aria-expanded={filterPanelOpen}
          >
            <span className={styles.foldToggleTitle}>筛选</span>
            <span className={styles.foldToggleSummary}>
              {(() => {
                const parts = [];
                if (activeSearchTerm.trim()) parts.push(`搜索「${activeSearchTerm.trim()}」`);
                if (filters.order) {
                  parts.push(formatTaxonomyDisplay(getOrderChineseName(filters.order), filters.order));
                }
                if (filters.family) {
                  parts.push(formatTaxonomyDisplay(getFamilyChineseName(filters.family), filters.family));
                }
                if (filters.iucnProtectionLevel) parts.push(`IUCN ${filters.iucnProtectionLevel}`);
                if (filters.chinaProtectionLevel) parts.push(filters.chinaProtectionLevel);
                if (parts.length === 0) return '搜索 · 排序 · 目科 · 保护等级';
                return parts.join(' · ');
              })()}
            </span>
            <span className={styles.foldToggleChevron} aria-hidden="true">
              {filterPanelOpen ? '▴' : '▾'}
            </span>
          </button>
          {filterPanelOpen ? (
            <div className={styles.foldBody}>
        <div className={styles.searchSection}>
          <div className={styles.searchContainer}>
            <div className={styles.searchInputWrapper}>
              <input
                type="text"
                placeholder="名称、学名或拼音（如 hongque、hq）"
                value={searchTerm}
                onChange={handleSearchChange}
                className={styles.searchInput}
                onKeyPress={(event) => {
                  if (event.key === 'Enter') {
                    handleSearch();
                  }
                }}
              />
              <div className={styles.searchButtons}>
                <button onClick={handleSearch} className={styles.searchButton} disabled={loading}>
                  搜索
                </button>
                {activeSearchTerm ? (
                  <button onClick={handleClearSearch} className={styles.clearButton}>
                    清空
                  </button>
                ) : null}
              </div>
            </div>
            {activeSearchTerm ? (
              <div className={styles.searchTips}>
                💡 当前搜索：&quot;{activeSearchTerm}&quot; | 支持中文、拼音、拼音首字母搜索
              </div>
            ) : null}
          </div>

          <div className={styles.sortContainer}>
            <label htmlFor="sortOrder">排序方式：</label>
            <select id="sortOrder" value={sortOrder} onChange={handleSortChange} className={styles.sortSelect}>
              <option value="asc">中文名 A-Z</option>
              <option value="desc">中文名 Z-A</option>
            </select>
          </div>
        </div>

        <div className={styles.filterSection}>
          <div className={styles.filterGrid}>
            <div className={styles.filterGroup}>
              <label htmlFor="orderFilter">目：</label>
              <select
                id="orderFilter"
                value={filters.order}
                onChange={(event) => handleFilterChange('order', event.target.value)}
                className={styles.filterSelect}
              >
                <option value="">全部分类</option>
                {filterOptions.categories.map((category) => (
                  <option key={category} value={category}>
                    {formatTaxonomyDisplay(getOrderChineseName(category), category)}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.filterGroup}>
              <label htmlFor="familyFilter">科：</label>
              <select
                id="familyFilter"
                value={filters.family}
                onChange={(event) => handleFilterChange('family', event.target.value)}
                className={styles.filterSelect}
              >
                <option value="">全部科</option>
                {filterOptions.families.map((family) => (
                  <option key={family} value={family}>
                    {formatTaxonomyDisplay(getFamilyChineseName(family), family)}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.filterGroup}>
              <label htmlFor="iucnFilter">IUCN：</label>
              <select
                id="iucnFilter"
                value={filters.iucnProtectionLevel}
                onChange={(event) => handleFilterChange('iucnProtectionLevel', event.target.value)}
                className={styles.filterSelect}
              >
                <option value="">全部等级</option>
                {filterOptions.iucnLevels.map((level) => (
                  <option key={level} value={level}>
                    {level}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.filterGroup}>
              <label htmlFor="chinaFilter">中国保护：</label>
              <select
                id="chinaFilter"
                value={filters.chinaProtectionLevel}
                onChange={(event) => handleFilterChange('chinaProtectionLevel', event.target.value)}
                className={styles.filterSelect}
              >
                <option value="">全部等级</option>
                {filterOptions.chinaLevels.map((level) => (
                  <option key={level} value={level}>
                    {level}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.filterClearSlot}>
              <button
                type="button"
                onClick={clearFilters}
                className={styles.clearFiltersButton}
                disabled={!filters.order && !filters.family && !filters.iucnProtectionLevel && !filters.chinaProtectionLevel}
              >
                清除
              </button>
            </div>
          </div>

          {filters.order || filters.family || filters.iucnProtectionLevel || filters.chinaProtectionLevel ? (
            <div className={styles.activeFilters}>
              <span>当前过滤：</span>
              {filters.order ? (
                <span className={styles.activeFilter}>
                  {formatTaxonomyDisplay(getOrderChineseName(filters.order), filters.order)}
                </span>
              ) : null}
              {filters.family ? (
                <span className={styles.activeFilter}>
                  {formatTaxonomyDisplay(getFamilyChineseName(filters.family), filters.family)}
                </span>
              ) : null}
              {filters.iucnProtectionLevel ? (
                <span className={styles.activeFilter}>IUCN: {filters.iucnProtectionLevel}</span>
              ) : null}
              {filters.chinaProtectionLevel ? (
                <span className={styles.activeFilter}>中国: {filters.chinaProtectionLevel}</span>
              ) : null}
            </div>
          ) : null}
        </div>
            </div>
          ) : null}
        </div>
        {showPDFExporter ? (
          <div className={styles.exportSection}>
            <HTMLPDFExporter birds={birds} selectedBirds={birds} filters={filters} searchTerm={activeSearchTerm} />
          </div>
        ) : null}

        <div className={styles.listMeta}>
          <div className={styles.listMetaLead}>
            <span className={styles.listMetaCount}>
              {pagination.total > 0 ? `${pagination.total} 种` : '—'}
            </span>
            {totalPages > 1 ? (
              <div className="kb-view-seg kb-meta-seg" aria-label="翻页">
                <button
                  type="button"
                  className="kb-view-tab kb-meta-tab"
                  aria-label="上一页"
                  disabled={currentPage <= 1}
                  onClick={() => handlePageChange(currentPage - 1)}
                >
                  ←
                </button>
                <span className="kb-meta-index">
                  {currentPage}/{totalPages}
                </span>
                <button
                  type="button"
                  className="kb-view-tab kb-meta-tab"
                  aria-label="下一页"
                  disabled={currentPage >= totalPages}
                  onClick={() => handlePageChange(currentPage + 1)}
                >
                  →
                </button>
              </div>
            ) : null}
          </div>
          <div className={styles.listMetaTools}>
            <label className={styles.pageSizeControl} htmlFor="catalogPageSize">
              <span className="kb-meta-label">每页</span>
              <select
                id="catalogPageSize"
                value={itemsPerPage}
                onChange={handlePageSizeChange}
                className={styles.pageSizeSelect}
              >
                {pageSizeOptions.map((size) => (
                  <option key={size} value={size}>
                    {size} 种
                  </option>
                ))}
              </select>
            </label>
            <div className="kb-view-seg kb-meta-seg" role="group" aria-label="名录显示模式">
              <button
                type="button"
                className={`kb-view-tab kb-meta-tab${viewMode === 'table' ? ' is-active' : ''}`}
                aria-pressed={viewMode === 'table'}
                onClick={() => {
                  setViewMode('table');
                  writeCatalogViewMode('table');
                }}
              >
                表格
              </button>
              <button
                type="button"
                className={`kb-view-tab kb-meta-tab${viewMode === 'card' ? ' is-active' : ''}`}
                aria-pressed={viewMode === 'card'}
                onClick={() => {
                  setViewMode('card');
                  writeCatalogViewMode('card');
                }}
              >
                卡片
              </button>
            </div>
          </div>
        </div>

        {viewMode === 'card' ? (
          <div className={styles.birdGrid}>
            {currentBirds.map((bird) => {
              const primaryImage = firstBirdImageUrl(bird.images);
              const shouldOptimizeImage = primaryImage.startsWith('/');
              return (
                <Link key={bird._id} href={`/birds/${bird._id}`} className={styles.birdCard}>
                  <div className={styles.birdImageContainer}>
                    {primaryImage ? (
                      <Image
                        src={primaryImage}
                        alt={bird.name}
                        width={420}
                        height={280}
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
                  </div>
                  <div className={styles.birdInfo}>
                    <h3 className={styles.birdCardTitle}>{bird.name}</h3>
                    {bird.scientificName ? (
                      <p className={styles.cardScientific}>
                        <em>{bird.scientificName}</em>
                      </p>
                    ) : null}
                    <p className={styles.cardTaxonomy}>
                      {[
                        bird.order ? getOrderChineseName(bird.order) || bird.order : '',
                        bird.family ? getFamilyChineseName(bird.family) || bird.family : '',
                      ]
                        .filter(Boolean)
                        .join(' · ') || bird.category || '分类未填'}
                    </p>
                    <div className={styles.cardBadges}>
                      {bird.iucnProtectionLevel ? (
                        <span className={`${styles.status} ${styles.iucn}`}>IUCN {bird.iucnProtectionLevel}</span>
                      ) : null}
                      {bird.chinaProtectionLevel && bird.chinaProtectionLevel !== '未列入' ? (
                        <span className={`${styles.status} ${styles.china}`}>{bird.chinaProtectionLevel}</span>
                      ) : null}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
        <div className={styles.catalogContainer}>
          <div className={styles.catalogHeader}>
            <div className={styles.headerCell}>编号</div>
            <div className={styles.headerCell}>中文名</div>
            <div className={styles.headerCell}>英文名</div>
            <div className={styles.headerCell}>拉丁学名</div>
            <div className={styles.headerCell}>分类</div>
            <div className={styles.headerCell}>保护状态</div>
          </div>

          {currentBirds.map((bird, index) => (
            <div key={bird._id} className={styles.catalogRow}>
              <div className={styles.cell}>
                <span className={styles.number}>{startIndex + index + 1}</span>
              </div>
              <div className={styles.cell}>
                <Link href={`/birds/${bird._id}`} className={styles.birdLink}>
                  {bird.name}
                </Link>
              </div>
              <div className={styles.cell}>
                <span className={styles.englishName}>{bird.englishName || '—'}</span>
              </div>
              <div className={styles.cell}>
                <span className={styles.scientificName}>
                  <em>{bird.scientificName}</em>
                </span>
              </div>
              <div className={styles.cell}>
                <div className={styles.taxonomy}>
                  {bird.order ? (
                    <div className={styles.taxonomyItem}>
                      <span className={styles.taxonomyLabel}>目:</span>
                      <span className={styles.taxonomyValue}>
                        {getOrderChineseName(bird.order)}
                        <span className={styles.latinName}>/{bird.order}</span>
                      </span>
                    </div>
                  ) : null}
                  {bird.family ? (
                    <div className={styles.taxonomyItem}>
                      <span className={styles.taxonomyLabel}>科:</span>
                      <span className={styles.taxonomyValue}>
                        {getFamilyChineseName(bird.family)}
                        <span className={styles.latinName}>/{bird.family}</span>
                      </span>
                    </div>
                  ) : null}
                  {!bird.order && !bird.family && bird.category ? (
                    <div className={styles.taxonomyItem}>
                      <span className={styles.taxonomyValue}>{bird.category}</span>
                    </div>
                  ) : null}
                </div>
              </div>
              <div className={styles.cell}>
                <div className={styles.protectionStatus}>
                  {bird.iucnProtectionLevel ? (
                    <span className={`${styles.status} ${styles.iucn}`}>IUCN: {bird.iucnProtectionLevel}</span>
                  ) : null}
                  {bird.chinaProtectionLevel && bird.chinaProtectionLevel !== '未列入' ? (
                    <span className={`${styles.status} ${styles.china}`}>中国: {bird.chinaProtectionLevel}</span>
                  ) : null}
                  {!bird.iucnProtectionLevel && (!bird.chinaProtectionLevel || bird.chinaProtectionLevel === '未列入') ? (
                    <span className={`${styles.status} ${styles.default}`}>未评估</span>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
        </div>
        )}

        {totalPages > 1 ? (
          <div className={styles.pagination}>
            <div className={styles.paginationInfo}>
              显示第 {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, pagination.total)} 条，共 {pagination.total} 条记录
            </div>

            <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1} className={styles.pageButton}>
              ← 上一页
            </button>

            <div className={styles.pageNumbers}>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum;
                if (totalPages <= 5) pageNum = i + 1;
                else if (currentPage <= 3) pageNum = i + 1;
                else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                else pageNum = currentPage - 2 + i;

                return (
                  <button
                    key={pageNum}
                    onClick={() => handlePageChange(pageNum)}
                    className={`${styles.pageNumber} ${currentPage === pageNum ? styles.active : ''}`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>

            <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages} className={styles.pageButton}>
              下一页 →
            </button>
          </div>
        ) : null}

        {!loading && currentBirds.length === 0 ? (
          <div className={styles.noResults}>
            <div className={styles.noResultsIcon}>🐦</div>
            <h3>没有找到匹配的鸟类</h3>
            <p>尝试调整搜索条件</p>
          </div>
        ) : null}
      </main>

      <Footer />
    </div>
  );
}
