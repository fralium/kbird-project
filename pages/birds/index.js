import { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import CategoryDisplay from '../../components/CategoryDisplay';
import { formatCategory } from '../../utils/formatCategory';
import { getOrderChineseName, getFamilyChineseName, formatTaxonomyDisplay } from '../../data/taxonomyTranslation';
import styles from '../../styles/BirdList.module.css';

export default function BirdList() {
  const [birds, setBirds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    order: '', // 目
    family: '', // 科
    iucnProtectionLevel: '', // IUCN保护等级
    chinaProtectionLevel: '' // 中国保护等级
  });
  
  // 可用的过滤选项
  const [filterOptions, setFilterOptions] = useState({
    categories: [],
    families: [],
    allFamilies: [], // 保存所有科用于动态筛选
    categoryToFamilies: {}, // 目到科的映射关系
    iucnLevels: [],
    chinaLevels: []
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 12,
    total: 0,
    pages: 0,
  });
  const [favoriteLoading, setFavoriteLoading] = useState(false);
  const [userFavorites, setUserFavorites] = useState([]);

  // 获取鸟类数据
  useEffect(() => {
    const fetchBirds = async () => {
      try {
        setLoading(true);
        // 构建查询参数
        const queryParams = new URLSearchParams({
          page: pagination.page.toString(),
          limit: pagination.limit.toString(),
        });
        
        // 添加搜索参数
        if (searchTerm.trim()) {
          queryParams.append('search', searchTerm.trim());
        }
        
        // 添加筛选参数
        if (filters.order) {
          queryParams.append('order', filters.order);
        }
        if (filters.family) {
          queryParams.append('family', filters.family);
        }
        if (filters.iucnProtectionLevel) {
          queryParams.append('iucnProtectionLevel', filters.iucnProtectionLevel);
        }
        if (filters.chinaProtectionLevel) {
          queryParams.append('chinaProtectionLevel', filters.chinaProtectionLevel);
        }
        
        const response = await fetch(`/api/birds?${queryParams.toString()}`);
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            setBirds(data.data);
            setPagination(prev => ({
              ...prev,
              total: data.total || data.data.length,
              pages: data.pages || Math.ceil((data.total || data.data.length) / prev.limit)
            }));
            
            // 提取可用的分类和保护状态选项（只从第一页提取，避免重复）
            if (pagination.page === 1) {
              // 这里暂时不提取，将在单独的useEffect中处理
            }
          } else {
            console.error('获取鸟类数据失败:', data.message);
          }
        } else {
          console.error('获取鸟类数据失败');
        }
      } catch (error) {
        console.error('获取鸟类数据失败:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchBirds();
  }, [pagination.page, searchTerm, filters]);
  
  // 获取过滤选项
  useEffect(() => {
    const fetchFilterOptions = async () => {
      try {
        // 获取所有鸟类数据来提取过滤选项
        const response = await fetch('/api/birds?page=1&limit=2000'); // 获取大量数据来提取选项
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            const birds = data.data;
            
            // 提取分类（目）- 使用新的order字段
            const categories = [...new Set(birds.map(bird => bird.order).filter(Boolean))].sort();
            
            // 提取科（所有科，用于初始化和清除过滤时使用）- 使用新的family字段
            const allFamilies = [...new Set(birds.map(bird => bird.family).filter(Boolean))].sort();
            
            // 建立目到科的映射关系 - 使用新的order和family字段
            const categoryToFamilies = {};
            birds.forEach(bird => {
              if (bird.order && bird.family) {
                if (!categoryToFamilies[bird.order]) {
                  categoryToFamilies[bird.order] = [];
                }
                if (!categoryToFamilies[bird.order].includes(bird.family)) {
                  categoryToFamilies[bird.order].push(bird.family);
                }
              }
            });
            
            // 对每个目下的科进行排序
            Object.keys(categoryToFamilies).forEach(category => {
              categoryToFamilies[category].sort();
            });
            
            // 提取IUCN保护等级
            const iucnLevels = [...new Set(birds.map(bird => bird.iucnProtectionLevel).filter(Boolean))].sort();
            
            // 提取中国保护等级
            const chinaLevels = [...new Set(birds.map(bird => bird.chinaProtectionLevel).filter(Boolean))].sort();
            
            setFilterOptions({
              categories,
              families: allFamilies,
              allFamilies, // 保存所有科用于动态筛选
              categoryToFamilies, // 目到科的映射关系
              iucnLevels,
              chinaLevels
            });
          }
        }
      } catch (error) {
        console.error('获取过滤选项失败:', error);
      }
    };
    
    fetchFilterOptions();
  }, []);

  // 获取用户收藏（只在组件挂载时获取一次）
  useEffect(() => {
    const fetchUserFavorites = async () => {
      const token = localStorage.getItem('token');
      if (token) {
        try {
          const response = await fetch('/api/users/favorites', {
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          });
          if (response.ok) {
            const data = await response.json();
            if (data.success) {
              setUserFavorites(data.data.map(bird => bird._id));
            }
          } else if (response.status === 401) {
            // Token无效，清除本地存储
            localStorage.removeItem('token');
            setUserFavorites([]);
          }
        } catch (error) {
          console.error('获取收藏失败:', error);
        }
      }
    };
    
    fetchUserFavorites();
  }, []); // 只在组件挂载时执行一次

  // 后端已经处理了搜索和筛选，直接使用返回的数据
  const paginatedBirds = birds.map(bird => ({
    ...bird,
    isFavorited: userFavorites.includes(bird._id)
  }));
  const totalPages = pagination.pages;

  // 处理搜索
  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
    setPagination(prev => ({ ...prev, page: 1 })); // 搜索时重置到第一页
  };

  // 处理筛选
  const handleFilterChange = (filterType, value) => {
    setFilters(prev => {
      const newFilters = {
        ...prev,
        [filterType]: value
      };
      
      // 如果选择了目，需要根据目来筛选科的选项
      if (filterType === 'order') {
        // 清除科的过滤，因为目已经改变了
        newFilters.family = '';
        
        // 根据选择的目来更新科的选项
        if (value && filterOptions.categoryToFamilies && filterOptions.categoryToFamilies[value]) {
          // 使用预建立的映射关系来获取该目下的科
          const familiesForCategory = filterOptions.categoryToFamilies[value];
          console.log(`选择目 "${value}" 对应的科:`, familiesForCategory);
          setFilterOptions(prevOptions => ({
            ...prevOptions,
            families: familiesForCategory
          }));
        } else {
          // 如果没有选择目或该目没有科，恢复所有科的选项
          console.log('恢复所有科的选项');
          setFilterOptions(prevOptions => ({
            ...prevOptions,
            families: prevOptions.allFamilies || []
          }));
        }
      }
      
      return newFilters;
    });
    setPagination(prev => ({ ...prev, page: 1 })); // 重置到第一页
  };

  // 清除筛选
  const clearFilters = () => {
    setSearchTerm('');
    setFilters({
      order: '',
      family: '',
      iucnProtectionLevel: '',
      chinaProtectionLevel: ''
    });
    // 恢复所有科的选项
    setFilterOptions(prevOptions => ({
      ...prevOptions,
      families: prevOptions.allFamilies || []
    }));
    setPagination(prev => ({ ...prev, page: 1 })); // 重置到第一页
  };

  // 处理分页
  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setLoading(true);
      setPagination(prev => ({ ...prev, page: newPage }));
      // 滚动到顶部
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };


  // 处理收藏功能
  const handleFavorite = async (e, birdId) => {
    e.preventDefault();
    e.stopPropagation();
    
    const token = localStorage.getItem('token');
    if (!token) {
      alert('请先登录');
      return;
    }

    setFavoriteLoading(true);
    try {
      const isFavorited = userFavorites.includes(birdId);
      const method = isFavorited ? 'DELETE' : 'POST';
      
      const response = await fetch(`/api/users/favorites/${birdId}`, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (data.success) {
        if (isFavorited) {
          setUserFavorites(prev => prev.filter(id => id !== birdId));
        } else {
          setUserFavorites(prev => [...prev, birdId]);
        }
        // 简单的成功提示
        console.log(isFavorited ? '🪶 已从收藏中移除' : '🪶 已添加到收藏');
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
      <Head>
        <title>鸟类图鉴 - KBird</title>
        <meta name="description" content="浏览和搜索鸟类信息、图片和观察记录" />
      </Head>

      <Navbar />

      <main className={styles.main}>
        <div className={styles.header}>
          <h1 className={styles.title}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="#4CAF50">
                <path d="M12 2C8.5 2 5.73 4.11 5.18 7h3.64c.45-1.25 1.63-2 3.18-2s2.73.75 3.18 2h3.64C18.27 4.11 15.5 2 12 2zM5 9h2v4H5V9zm12 0h2v4h-2V9zM9 9h6v4H9V9zm-3 6h12c1.1 0 2 .9 2 2v1c0 1.1-.9 2-2 2H6c-1.1 0-2-.9-2-2v-1c0-1.1.9-2 2-2z"/>
              </svg>
              鸟类图鉴
            </span>
          </h1>
          <p className={styles.description}>
            浏览和搜索鸟类信息、图片和观察记录，共 {pagination.total} 种鸟类
          </p>
        </div>

        <div className={styles.filtersContainer}>
          <div className={styles.searchBox}>
            <div className={styles.searchWrapper}>
              <input
                type="text"
                placeholder="🔍 搜索鸟类名称、学名或描述..."
                value={searchTerm}
                onChange={handleSearch}
                className={styles.searchInput}
              />
              {searchTerm && (
                <button 
                  onClick={() => setSearchTerm('')}
                  className={styles.clearSearchButton}
                  title="清除搜索"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          <div className={styles.filters}>
            <div className={styles.filterGroup}>
              <label htmlFor="order">分类（目）：</label>
              <select
                id="order"
                value={filters.order}
                onChange={(e) => handleFilterChange('order', e.target.value)}
                className={styles.filterSelect}
              >
                <option value="">全部分类</option>
                {filterOptions.categories.map(category => (
                  <option key={category} value={category}>
                    {formatTaxonomyDisplay(getOrderChineseName(category), category)}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.filterGroup}>
              <label htmlFor="family">科：</label>
              <select
                id="family"
                value={filters.family}
                onChange={(e) => handleFilterChange('family', e.target.value)}
                className={styles.filterSelect}
              >
                <option value="">全部科</option>
                {filterOptions.families.map(family => (
                  <option key={family} value={family}>
                    {formatTaxonomyDisplay(getFamilyChineseName(family), family)}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.filterGroup}>
              <label htmlFor="iucnProtectionLevel">IUCN保护等级：</label>
              <select
                id="iucnProtectionLevel"
                value={filters.iucnProtectionLevel}
                onChange={(e) => handleFilterChange('iucnProtectionLevel', e.target.value)}
                className={styles.filterSelect}
              >
                <option value="">全部等级</option>
                {filterOptions.iucnLevels.map(level => (
                  <option key={level} value={level}>{level}</option>
                ))}
              </select>
            </div>

            <div className={styles.filterGroup}>
              <label htmlFor="chinaProtectionLevel">中国保护等级：</label>
              <select
                id="chinaProtectionLevel"
                value={filters.chinaProtectionLevel}
                onChange={(e) => handleFilterChange('chinaProtectionLevel', e.target.value)}
                className={styles.filterSelect}
              >
                <option value="">全部等级</option>
                {filterOptions.chinaLevels.map(level => (
                  <option key={level} value={level}>{level}</option>
                ))}
              </select>
            </div>

            <button onClick={clearFilters} className={styles.clearButton}>
              🗑️ 清除筛选
            </button>
          </div>
        </div>

        {loading ? (
          <div className={styles.loadingContainer}>
            <div className={styles.loadingSpinner}></div>
            <p>正在加载鸟类数据...</p>
          </div>
        ) : paginatedBirds.length === 0 ? (
          <div className={styles.noResults}>
            <div className={styles.noResultsIcon}>🐦</div>
            <h3>没有找到匹配的鸟类记录</h3>
            <p>尝试调整搜索条件或筛选器</p>
            <button onClick={clearFilters} className={styles.clearButton}>
              🗑️ 清除筛选条件
            </button>
          </div>
        ) : (
          <>
            <div className={styles.resultsInfo}>
              <span className={styles.resultsCount}>找到 {pagination.total} 条记录</span>
              {totalPages > 1 && (
                <span className={styles.pageInfo}>
                  第 {pagination.page} 页，共 {totalPages} 页
                </span>
              )}
            </div>

            <div className={styles.birdGrid}>
              {paginatedBirds.map((bird) => (
                <div key={bird._id} className={styles.birdCard}>
                  <Link href={`/birds/${bird._id}`} className={styles.birdCardLink}>
                    <div className={styles.birdImageContainer}>
                      {bird.images && bird.images.length > 0 ? (
                        <img 
                          src={bird.images[0].url.startsWith('http') ? bird.images[0].url : `${typeof window !== 'undefined' ? window.location.origin : ''}${bird.images[0].url}`} 
                          alt={bird.name}
                          className={styles.birdImage}
                          loading="lazy"
                          onError={(e) => {
                            e.target.style.display = 'none';
                            const placeholder = e.target.nextElementSibling;
                            if (placeholder) {
                              placeholder.style.display = 'flex';
                            }
                          }}
                        />
                      ) : null}
                      <div 
                        className={styles.birdImagePlaceholder}
                        style={{ display: bird.images && bird.images.length > 0 ? 'none' : 'flex' }}
                      >
                        <div className={styles.placeholderText}>{bird.name}</div>
                      </div>
                    </div>
                    <div className={styles.birdInfo}>
                      <div className={styles.birdHeader}>
                        <h3>{bird.name}</h3>
                        <div className={styles.birdIndicators}>
                          {/* 照片指示器 */}
                          {bird.images && bird.images.length > 0 && (
                            <span className={styles.indicator} title="有照片">
                              📸
                              {bird.images.some(img => img.url && img.url.includes('_birdfans_')) && (
                                <span className={styles.birdfansBadge} title="爱鸟网高质量照片">⭐</span>
                              )}
                            </span>
                          )}
                          
                          {/* 记录指示器 */}
                          {bird.lastObserved && (
                            <span className={styles.indicator} title={`有观察记录 (${bird.recordCount || 0}次)`}>
                              📝
                            </span>
                          )}
                          
                          {/* 保护等级指示器 */}
                          {bird.chinaProtectionLevel === '国家一级' && (
                            <span className={styles.indicator} title="国家一级保护">
                              🔴
                            </span>
                          )}
                          {bird.chinaProtectionLevel === '国家二级' && (
                            <span className={styles.indicator} title="国家二级保护">
                              🟡
                            </span>
                          )}
                        </div>
                      </div>
                      
                      <p className={styles.scientificName}>{bird.scientificName}</p>
                      <div className={styles.birdMeta}>
                        <div className={styles.categoryContainer}>
                          <CategoryDisplay category={bird.category} variant="compact" bird={bird} />
                        </div>
                        <div className={styles.protectionStatus}>
                          {bird.iucnProtectionLevel && (
                            <span className={`${styles.status} ${styles.iucn}`}>
                              IUCN: {bird.iucnProtectionLevel}
                            </span>
                          )}
                          {bird.chinaProtectionLevel && bird.chinaProtectionLevel !== '未列入' && (
                            <span className={`${styles.status} ${styles.china}`}>
                              中国: {bird.chinaProtectionLevel}
                            </span>
                          )}
                          {!bird.iucnProtectionLevel && (!bird.chinaProtectionLevel || bird.chinaProtectionLevel === '未列入') && (
                            <span className={`${styles.status} ${styles.default}`}>
                              未评估
                            </span>
                          )}
                        </div>
                      </div>
                      {/* 最近观察信息 */}
                      {bird.lastObserved && (
                        <div className={styles.recentObservation}>
                          <span className={styles.observationLabel}>最近观察</span>
                          <span className={styles.observationDate}>
                            {new Date(bird.lastObserved).toLocaleDateString('zh-CN', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric'
                            })}
                          </span>
                          {bird.recordCount > 0 && (
                            <span className={styles.recordCount}>
                              ({bird.recordCount}次记录)
                            </span>
                          )}
                        </div>
                      )}
                      
                      {bird.createdBy && (
                        <div className={styles.userInfo}>
                          <span className={styles.userLabel}>用户上传</span>
                          <span className={styles.userName}>{bird.createdBy.name}</span>
                        </div>
                      )}
                    </div>
                  </Link>
                  <div className={styles.birdActions}>
                    <button 
                      className={`${styles.favoriteButton} ${bird.isFavorited ? styles.favorited : ''}`}
                      onClick={(e) => handleFavorite(e, bird._id)}
                      disabled={favoriteLoading}
                    >
                      {favoriteLoading ? '...' : (bird.isFavorited ? '🪶' : '🪶')}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {totalPages > 1 && (
              <div className={styles.pagination}>
                <button
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={pagination.page === 1}
                  className={styles.pageButton}
                >
                  ← 上一页
                </button>
                
                <div className={styles.pageNumbers}>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (pagination.page <= 3) {
                      pageNum = i + 1;
                    } else if (pagination.page >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = pagination.page - 2 + i;
                    }
                    
                    return (
                      <button
                        key={pageNum}
                        onClick={() => handlePageChange(pageNum)}
                        className={`${styles.pageNumber} ${pagination.page === pageNum ? styles.active : ''}`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>
                
                <button
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={pagination.page === totalPages}
                  className={styles.pageButton}
                >
                  下一页 →
                </button>
              </div>
            )}
          </>
        )}
      </main>

      <Footer />
    </div>
  );
}