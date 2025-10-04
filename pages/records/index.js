import { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import ImageViewer from '../../components/ImageViewer';
import styles from '../../styles/Records.module.css';

export default function Records() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [pagination, setPagination] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [errors, setErrors] = useState([]);
  const [imageViewerOpen, setImageViewerOpen] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [currentImages, setCurrentImages] = useState([]);
  const [popularLocations, setPopularLocations] = useState([]);

  useEffect(() => {
    fetchRecords();
    fetchPopularLocations();
  }, [currentPage, searchTerm, dateFilter, locationFilter]);

  const fetchRecords = async () => {
    try {
      setLoading(true);
      setErrors([]);

      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '10',
        status: 'approved,pending' // 显示已审核和待审核的记录
      });

      if (searchTerm.trim()) {
        params.append('search', searchTerm.trim());
      }
      if (dateFilter) {
        params.append('date', dateFilter);
      }
      if (locationFilter.trim()) {
        params.append('location', locationFilter.trim());
      }

      const response = await fetch(`/api/records?${params}`);
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setRecords(data.data);
          setPagination(data.pagination);
        } else {
          setErrors([data.message || '获取记录失败']);
        }
      } else {
        setErrors(['获取记录失败']);
      }
    } catch (error) {
      console.error('获取记录失败:', error);
      setErrors(['获取记录失败']);
    } finally {
      setLoading(false);
    }
  };

  // 获取热门地点数据
  const fetchPopularLocations = async () => {
    try {
      const response = await fetch('/api/locations');
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          // 按观察次数排序，取前6个
          const sortedLocations = data.data
            .sort((a, b) => (b.stats?.totalRecords || 0) - (a.stats?.totalRecords || 0))
            .slice(0, 6);
          setPopularLocations(sortedLocations);
        }
      }
    } catch (error) {
      console.error('获取热门地点失败:', error);
    }
  };

  const handleSearch = () => {
    setCurrentPage(1);
    fetchRecords();
  };

  const clearFilters = () => {
    setSearchTerm('');
    setDateFilter('');
    setLocationFilter('');
    setCurrentPage(1);
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  const handleDelete = async (recordId) => {
    if (!confirm('确定要删除这条观鸟记录吗？此操作无法撤销。')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        alert('请先登录');
        return;
      }

      const response = await fetch(`/api/records/${recordId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (data.success) {
        alert('观鸟记录删除成功');
        fetchRecords(); // 重新加载数据
      } else {
        alert('删除失败：' + data.message);
      }
    } catch (error) {
      console.error('删除观鸟记录失败:', error);
      alert('删除失败，请重试');
    }
  };

  // 打开图片查看器
  const openImageViewer = (images, index = 0) => {
    setCurrentImages(images);
    setCurrentImageIndex(index);
    setImageViewerOpen(true);
  };

  // 关闭图片查看器
  const closeImageViewer = () => {
    setImageViewerOpen(false);
    setCurrentImages([]);
    setCurrentImageIndex(0);
  };

  return (
    <div className={styles.container}>
      <Head>
        <title>观鸟记录 - KBird</title>
        <meta name="description" content="浏览和搜索观鸟记录" />
      </Head>

      <Navbar />

      <main className={styles.main}>
        {/* 头部 */}
        <div className={styles.header}>
          <h1 className={styles.title}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="#4CAF50">
                <path d="M12 2C8.5 2 5.73 4.11 5.18 7h3.64c.45-1.25 1.63-2 3.18-2s2.73.75 3.18 2h3.64C18.27 4.11 15.5 2 12 2zM5 9h2v4H5V9zm12 0h2v4h-2V9zM9 9h6v4H9V9zm-3 6h12c1.1 0 2 .9 2 2v1c0 1.1-.9 2-2 2H6c-1.1 0-2-.9-2-2v-1c0-1.1.9-2 2-2z"/>
              </svg>
              观鸟记录
            </span>
          </h1>
          <p className={styles.description}>
            浏览和搜索观鸟记录，共 {pagination?.totalItems || 0} 条记录
          </p>
        </div>

        {/* 热门观鸟地点 */}
        <div className={styles.popularLocationsSection}>
          <h2>热门观鸟地点</h2>
          <p>根据观察记录数量统计的热门地点</p>
          
          {popularLocations.length > 0 ? (
            <div className={styles.locationsGrid}>
              {popularLocations.slice(0, 6).map((location, index) => (
                <Link key={location._id} href={`/locations/${location._id}`} className={styles.locationCardLink}>
                  <div className={styles.locationCard}>
                    <div className={styles.locationContent}>
                      <div className={styles.locationMain}>
                        <h3 className={styles.locationName}>{location.name}</h3>
                        <div className={styles.locationStats}>
                          <span className={styles.statItem}>
                            📊 {location.stats?.totalRecords || 0} 次观察
                          </span>
                          <span className={styles.statItem}>
                            🐦 {location.stats?.uniqueSpecies || 0} 种鸟类
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className={styles.noLocations}>
              <p>暂无热门地点数据</p>
            </div>
          )}
        </div>

        {/* 搜索和筛选区域 */}
        <div className={styles.filtersContainer}>
          <div className={styles.searchBox}>
            <input
              type="text"
              placeholder="搜索地点、标题或备注..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleSearch();
                }
              }}
              className={styles.searchInput}
            />
            <button onClick={handleSearch} className={styles.searchButton}>
              🔍
            </button>
          </div>

          <div className={styles.filters}>
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className={styles.filterSelect}
            >
              <option value="">全部日期</option>
              <option value="today">今天</option>
              <option value="thisWeek">本周</option>
              <option value="thisMonth">本月</option>
            </select>

            <input
              type="text"
              placeholder="筛选地点..."
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              className={styles.filterInput}
            />

            <button onClick={clearFilters} className={styles.clearButton}>
              清除筛选
            </button>
          </div>
        </div>

        {/* 错误提示 */}
        {errors.length > 0 && (
          <div className={styles.errorContainer}>
            {errors.map((error, index) => (
              <div key={index} className={styles.errorMessage}>
                ❌ {error}
              </div>
            ))}
          </div>
        )}

        {/* 记录列表 */}
        <div className={styles.recordsSection}>
          {loading ? (
            <div className={styles.loadingContainer}>
              <p>加载中...</p>
            </div>
          ) : records.length === 0 ? (
            <div className={styles.noResults}>
              <div className={styles.noResultsIcon}>🐦</div>
              <h3>暂无观鸟记录</h3>
              <p>成为第一个分享观鸟记录的人吧！</p>
              <Link href="/records/add" className={styles.createButton}>
                📝 创建记录
              </Link>
            </div>
          ) : (
            <div className={styles.recordsList}>
              {records.map((record) => (
                <div key={record._id} className={styles.recordCard}>
                  <div className={styles.recordHeader}>
                    <div className={styles.recordInfo}>
                      <h3 className={styles.recordTitle}>{record.title}</h3>
                      <div className={styles.recordMeta}>
                        <span className={styles.location}>
                          📍 {record.location.name}
                        </span>
                        <span className={styles.date}>
                          📅 {new Date(record.date).toLocaleDateString()}
                        </span>
                        <span className={styles.birdCount}>
                          🐦 {record.birds.length} 种鸟类
                        </span>
                      </div>
                    </div>
                    <div className={styles.recordActions}>
                      <Link 
                        href={`/records/${record._id}`} 
                        className={styles.viewButton}
                      >
                        查看详情
                      </Link>
                      <button 
                        onClick={() => handleDelete(record._id)}
                        className={styles.deleteButton}
                        title="删除记录"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>

                  <div className={styles.recordBody}>
                    {record.description && (
                      <p className={styles.recordDescription}>
                        {record.description}
                      </p>
                    )}

                    <div className={styles.birdsList}>
                      {record.birds.slice(0, 6).map((bird, index) => (
                        <div key={index} className={styles.birdItem}>
                          <span className={styles.birdName}>
                            {bird.birdId.name}
                          </span>
                          {bird.count > 1 && (
                            <span className={styles.birdCount}>
                              ×{bird.count}
                            </span>
                          )}
                        </div>
                      ))}
                      {record.birds.length > 6 && (
                        <div className={styles.moreBirds}>
                          +{record.birds.length - 6} 种
                        </div>
                      )}
                    </div>

                    {/* 图片展示 */}
                    {record.images && record.images.length > 0 && (
                      <div className={styles.recordImages}>
                        <div className={styles.imageGrid}>
                          {record.images.slice(0, 4).map((image, index) => (
                            <div 
                              key={index}
                              className={styles.imageItem}
                              onClick={() => openImageViewer(record.images, index)}
                            >
                              <img 
                                src={image.url} 
                                alt={image.caption || '观鸟照片'}
                                className={styles.thumbnailImage}
                              />
                            </div>
                          ))}
                          {record.images.length > 4 && (
                            <div className={styles.moreImages}>
                              +{record.images.length - 4}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    <div className={styles.recordFooter}>
                      <div className={styles.observer}>
                        {record.observer.avatar ? (
                          <img 
                            src={record.observer.avatar} 
                            alt={record.observer.name}
                            className={styles.observerAvatar}
                          />
                        ) : (
                          <div className={styles.observerInitial}>
                            {record.observer.name.charAt(0)}
                          </div>
                        )}
                        <span className={styles.observerName}>
                          {record.observer.name}
                        </span>
                      </div>
                      <div className={styles.recordStats}>
                        {record.stats.totalImages > 0 && (
                          <span className={styles.imageCount}>
                            📷 {record.stats.totalImages}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 分页 */}
        {pagination && pagination.totalPages > 1 && (
          <div className={styles.pagination}>
            <button 
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage <= 1}
              className={styles.paginationButton}
            >
              上一页
            </button>
            <span className={styles.paginationInfo}>
              第 {currentPage} 页，共 {pagination.totalPages} 页
            </span>
            <button 
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage >= pagination.totalPages}
              className={styles.paginationButton}
            >
              下一页
            </button>
          </div>
        )}
      </main>

      <Footer />

      {/* 图片查看器 */}
      {imageViewerOpen && (
        <ImageViewer
          images={currentImages}
          currentIndex={currentImageIndex}
          onClose={closeImageViewer}
        />
      )}
    </div>
  );
}