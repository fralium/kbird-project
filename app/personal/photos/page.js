'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import Navbar from '../../../components/Navbar';
import Footer from '../../../components/Footer';
import SimplePageHeader from '../../../components/SimplePageHeader';
import PageState from '../../../components/PageState';
import { useAuth } from '../../../components/AuthProvider';
import ImageViewer from '../../../components/ImageViewer';
import PhotoGalaxy3D from '../../../components/PhotoGalaxy3D';
import { api } from '../../../utils/api';
import styles from '../../../styles/PersonalPhotos.module.css';

const FILTER_PANEL_STORAGE_KEY = 'kbird.photos.filterPanel';

function readPhotosFilterPanelOpen() {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(FILTER_PANEL_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function writePhotosFilterPanelOpen(open) {
  try {
    localStorage.setItem(FILTER_PANEL_STORAGE_KEY, open ? '1' : '0');
  } catch {
    /* ignore */
  }
}

export default function PersonalPhotosPage() {
  const router = useRouter();
  const { user, loading: authLoading, refreshUser } = useAuth();
  const [photos, setPhotos] = useState([]);
  const [stats, setStats] = useState(null);
  const [birds, setBirds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [imageViewerOpen, setImageViewerOpen] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const hasRedirectedRef = useRef(false);

  const [filters, setFilters] = useState({
    birdId: '',
    location: '',
    dateFrom: '',
    dateTo: '',
    search: '',
    organize: '',
  });

  const [pagination, setPagination] = useState({
    page: 1,
    limit: 24,
    total: 0,
    pages: 0,
  });

  const [sortBy, setSortBy] = useState('date');
  const [sortOrder, setSortOrder] = useState('desc');
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [viewMode, setViewMode] = useState('grid');

  useEffect(() => {
    setFilterPanelOpen(readPhotosFilterPanelOpen());
  }, []);

  const fetchPhotos = useCallback(async () => {
    try {
      const params = {
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        sortBy,
        sortOrder,
      };

      if (filters.birdId) params.birdId = filters.birdId;
      if (filters.location) params.location = filters.location;
      if (filters.dateFrom) params.dateFrom = filters.dateFrom;
      if (filters.dateTo) params.dateTo = filters.dateTo;
      if (filters.search) params.search = filters.search;
      if (filters.organize) params.organize = filters.organize;

      const data = await api.personal.getPhotos(params);
      if (data.success) {
        setPhotos(data.data);
        setPagination(data.pagination);
      }
    } catch (error) {
      console.error('获取照片失败:', error);
    } finally {
      setLoading(false);
    }
  }, [filters, pagination.limit, pagination.page, sortBy, sortOrder]);

  const fetchStats = useCallback(async () => {
    try {
      const data = await api.personal.getPhotoStats();
      if (data.success) {
        setStats(data.data);
      }
    } catch (error) {
      console.error('获取统计失败:', error);
    }
  }, []);

  const fetchBirds = useCallback(async () => {
    try {
      const data = await api.personal.getPhotoBirds();
      if (data.success) {
        setBirds(data.data);
      }
    } catch (error) {
      console.error('获取鸟类列表失败:', error);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;

    const hasToken = typeof window !== 'undefined' && localStorage.getItem('token');
    if (!hasToken) {
      if (!hasRedirectedRef.current) {
        hasRedirectedRef.current = true;
        router.push('/login?redirect=/personal/photos');
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
          router.push('/login?redirect=/personal/photos');
        }
      }
      return;
    }

    fetchPhotos();
    fetchStats();
    fetchBirds();
  }, [authLoading, fetchBirds, fetchPhotos, fetchStats, refreshUser, router, user]);

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPagination((prev) => ({ ...prev, page: 1 }));
    if (key === 'organize' && value) {
      setFilterPanelOpen(true);
      writePhotosFilterPanelOpen(true);
    }
  };

  const clearFilters = () => {
    setFilters({
      birdId: '',
      location: '',
      dateFrom: '',
      dateTo: '',
      search: '',
      organize: '',
    });
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const openImageViewer = (index) => {
    setCurrentImageIndex(index);
    setImageViewerOpen(true);
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <Navbar />
        <main className={styles.main}>
          <PageState type="loading" title="照片库加载中..." />
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
          title="照片库"
          description="观察记录里拍下的照片"
          descriptionVariant="caption"
        />

        <div className={styles.foldPanel} aria-label="照片筛选">
          <button
            type="button"
            className={styles.foldToggle}
            onClick={() => {
              setFilterPanelOpen((prev) => {
                const next = !prev;
                writePhotosFilterPanelOpen(next);
                return next;
              });
            }}
            aria-expanded={filterPanelOpen}
          >
            <span className={styles.foldToggleTitle}>筛选</span>
            <span className={styles.foldToggleSummary}>
              {(() => {
                const parts = [];
                if (filters.search.trim()) parts.push(`搜索「${filters.search.trim()}」`);
                if (filters.organize === 'needsSpecies') parts.push('待补种');
                else if (filters.organize === 'unlinked') parts.push('未挂记录');
                else if (filters.organize === 'linked') parts.push('已关联记录');
                if (filters.birdId) {
                  const bird = birds.find((b) => String(b._id) === String(filters.birdId));
                  parts.push(bird?.name || '指定鸟种');
                }
                if (filters.location.trim()) parts.push(filters.location.trim());
                if (filters.dateFrom || filters.dateTo) {
                  parts.push(`${filters.dateFrom || '…'} ~ ${filters.dateTo || '…'}`);
                }
                if (parts.length === 0) return '搜索 · 整理 · 鸟种 · 地点 · 日期';
                return parts.join(' · ');
              })()}
            </span>
            <span className={styles.foldToggleChevron} aria-hidden="true">
              {filterPanelOpen ? '▴' : '▾'}
            </span>
          </button>
          {filterPanelOpen ? (
            <div className={styles.foldBody}>
        <div className={styles.filters}>
          <div className={styles.filterRow}>
            <input
              type="text"
              placeholder="描述、鸟种或地点"
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              className={styles.searchInput}
            />
          </div>

          <div className={styles.filterRow}>
            <select
              value={filters.organize}
              onChange={(e) => handleFilterChange('organize', e.target.value)}
              className={styles.filterSelect}
              aria-label="整理状态"
            >
              <option value="">全部照片</option>
              <option value="needsSpecies">待补种（无鸟种）</option>
              <option value="unlinked">未挂记录</option>
              <option value="linked">已关联记录</option>
            </select>

            <select
              value={filters.birdId}
              onChange={(e) => handleFilterChange('birdId', e.target.value)}
              className={styles.filterSelect}
            >
              <option value="">所有鸟类</option>
              {birds.map((bird) => (
                <option key={bird._id} value={bird._id}>
                  {bird.name}
                </option>
              ))}
            </select>

            <input
              type="text"
              placeholder="地点..."
              value={filters.location}
              onChange={(e) => handleFilterChange('location', e.target.value)}
              className={styles.filterInput}
            />

            <input
              type="date"
              placeholder="开始日期"
              value={filters.dateFrom}
              onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
              className={styles.filterInput}
            />

            <input
              type="date"
              placeholder="结束日期"
              value={filters.dateTo}
              onChange={(e) => handleFilterChange('dateTo', e.target.value)}
              className={styles.filterInput}
            />

            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className={styles.filterSelect}>
              <option value="date">按日期</option>
              <option value="uploadedAt">按上传时间</option>
              <option value="location">按地点</option>
              <option value="birdName">按鸟类</option>
            </select>

            <button onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')} className={styles.sortButton}>
              {sortOrder === 'asc' ? '↑' : '↓'}
            </button>

            <button type="button" onClick={clearFilters} className={styles.clearButton}>
              清除筛选
            </button>
          </div>
        </div>
            </div>
          ) : null}
        </div>

        <div className={styles.listMeta}>
          <div className={styles.listMetaLead}>
            <span className={styles.listMetaCount}>
              {pagination.total > 0 ? `${pagination.total} 张` : '—'}
            </span>
            {pagination.pages > 1 ? (
              <div className="kb-view-seg kb-meta-seg" aria-label="翻页">
                <button
                  type="button"
                  className="kb-view-tab kb-meta-tab"
                  aria-label="上一页"
                  disabled={pagination.page <= 1}
                  onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
                >
                  ←
                </button>
                <span className="kb-meta-index">
                  {pagination.page}/{pagination.pages}
                </span>
                <button
                  type="button"
                  className="kb-view-tab kb-meta-tab"
                  aria-label="下一页"
                  disabled={pagination.page >= pagination.pages}
                  onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
                >
                  →
                </button>
              </div>
            ) : null}
          </div>
          <div className={styles.listMetaTools}>
            <div className="kb-view-seg kb-meta-seg" role="group" aria-label="照片显示">
              <span className="kb-meta-label">显示</span>
              <button
                type="button"
                className={`kb-view-tab kb-meta-tab${viewMode === 'grid' ? ' is-active' : ''}`}
                aria-pressed={viewMode === 'grid'}
                onClick={() => {
                  setViewMode('grid');
                  setPagination((prev) => (prev.limit === 24 ? prev : { ...prev, page: 1, limit: 24 }));
                }}
              >
                卡片
              </button>
              <button
                type="button"
                className={`kb-view-tab kb-meta-tab${viewMode === 'galaxy' ? ' is-active' : ''}`}
                aria-pressed={viewMode === 'galaxy'}
                onClick={() => {
                  setViewMode('galaxy');
                  setPagination((prev) => (prev.limit === 80 ? prev : { ...prev, page: 1, limit: 80 }));
                }}
              >
                3D
              </button>
            </div>
          </div>
        </div>

        {photos.length === 0 ? (
          <PageState
            type="empty"
            title="没有照片"
            message="改筛选，或先在观察记录里加上照片。"
          />
        ) : viewMode === 'galaxy' ? (
          <PhotoGalaxy3D photos={photos} onSelect={openImageViewer} />
        ) : (
        <div className={styles.photosGrid}>
          {photos.map((photo, index) => (
              <div
                key={`${photo.recordId || photo.source || 'photo'}-${photo.url}-${index}`}
                className={styles.photoCard}
              >
                <button
                  type="button"
                  className={styles.photoImageButton}
                  onClick={() => openImageViewer(index)}
                  aria-label="查看大图"
                >
                  <div className={styles.photoImage}>
                    <Image
                      src={photo.url}
                      alt={photo.caption || '观鸟照片'}
                      width={520}
                      height={360}
                      unoptimized
                      onError={(e) => {
                        e.target.src = '/logo.png';
                      }}
                    />
                    {photo.birdName ? (
                      <div className={styles.photoBadge}>{photo.birdName}</div>
                    ) : (
                      <div className={`${styles.photoBadge} ${styles.photoBadgeWarn}`}>待补种</div>
                    )}
                  </div>
                </button>
                <div className={styles.photoInfo}>
                  {photo.caption && <div className={styles.photoCaption}>{photo.caption}</div>}
                  <div className={styles.photoMeta}>
                    <span>{photo.location || '地点未填'}</span>
                    <span>{photo.date ? new Date(photo.date).toLocaleDateString('zh-CN') : '-'}</span>
                  </div>
                  <div className={styles.photoActions}>
                    {photo.recordId ? (
                      <Link href={`/records/${photo.recordId}`} className={styles.photoRecordLink}>
                        打开记录
                      </Link>
                    ) : (
                      <span className={styles.photoUnlinked}>未挂记录 · 来自图鉴</span>
                    )}
                    {!photo.birdId && photo.recordId ? (
                      <Link href={`/records/${photo.recordId}`} className={styles.photoFixLink}>
                        去补种
                      </Link>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
        </div>
        )}

        {stats && (stats.recordsWithoutPhotos > 0 || stats.unlinkedCount > 0) ? (
          <p className={styles.pageNote}>
            {stats.recordsWithoutPhotos > 0 ? (
              <>
                有 {stats.recordsWithoutPhotos} 条记录还没有照片。
                <Link href="/records" className={styles.pageNoteLink}>
                  去观察记录补图
                </Link>
              </>
            ) : null}
            {stats.unlinkedCount > 0 ? (
              <>
                {stats.recordsWithoutPhotos > 0 ? ' · ' : null}
                <button
                  type="button"
                  className={styles.pageNoteLink}
                  onClick={() => handleFilterChange('organize', 'unlinked')}
                >
                  查看 {stats.unlinkedCount} 张未挂记录的照片
                </button>
              </>
            ) : null}
          </p>
        ) : null}

        {imageViewerOpen && (
          <ImageViewer
            images={photos.map((p) => ({ url: p.url, caption: p.caption }))}
            currentIndex={currentImageIndex}
            onClose={() => setImageViewerOpen(false)}
            onNext={() => setCurrentImageIndex((currentImageIndex + 1) % photos.length)}
            onPrev={() => setCurrentImageIndex((currentImageIndex - 1 + photos.length) % photos.length)}
          />
        )}
      </main>

      <Footer />
    </div>
  );
}
