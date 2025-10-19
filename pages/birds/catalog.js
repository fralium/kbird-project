import { useState, useEffect, useCallback, useRef } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import HTMLPDFExporter from '../../components/HTMLPDFExporter';
import { getOrderChineseName, getFamilyChineseName, formatTaxonomyDisplay } from '../../data/taxonomyTranslation';
import styles from '../../styles/BirdCatalog.module.css';

export default function BirdCatalog() {
  const [birds, setBirds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeSearchTerm, setActiveSearchTerm] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [sortOrder, setSortOrder] = useState('asc');
  const [showPDFExporter, setShowPDFExporter] = useState(false); // PDF导出器显示状态
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(50);
  const [pagination, setPagination] = useState({
    total: 0,
    pages: 0
  });
  
  // 过滤器状态
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

  // 手动搜索功能
  const handleSearch = () => {
    setActiveSearchTerm(searchTerm);
    setCurrentPage(1); // 搜索时重置到第一页
  };

  // 清空搜索功能
  const handleClearSearch = () => {
    setSearchTerm('');
    setActiveSearchTerm('');
    setCurrentPage(1);
  };

  // 使用后端API进行搜索，支持智能拼音搜索
  useEffect(() => {
    const fetchBirds = async () => {
      try {
        setLoading(true);
        
        // 构建查询参数
        const queryParams = new URLSearchParams({
          page: currentPage.toString(),
          limit: itemsPerPage.toString(),
        });
        
        // 添加搜索参数（支持智能拼音搜索）
        if (activeSearchTerm.trim()) {
          queryParams.append('search', activeSearchTerm.trim());
        }
        
        // 添加过滤器参数
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
        
        // 添加排序参数
        if (sortOrder === 'desc') {
          queryParams.append('sort', '-name');
        } else {
          queryParams.append('sort', 'name');
        }
        
        const response = await fetch(`/api/birds?${queryParams.toString()}`);
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            setBirds(data.data);
            setPagination({
              total: data.total || 0,
              pages: data.pages || 0
            });
          } else {
            setError(data.message || '获取鸟类数据失败');
          }
        } else {
          setError('获取鸟类数据失败');
        }
      } catch (err) {
        setError('网络错误');
      } finally {
        setLoading(false);
      }
    };

    fetchBirds();
  }, [currentPage, activeSearchTerm, sortOrder, itemsPerPage, filters]);
  
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
            
            console.log('提取的分类选项:', categories);
            console.log('鸟类数据示例:', birds.slice(0, 3).map(b => ({ 
              name: b.name, 
              order: b.order, 
              family: b.family,
              category: b.category 
            })));
            
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

  // 分页逻辑
  const totalPages = pagination.pages;
  const currentBirds = birds; // 数据已经分页
  const startIndex = (currentPage - 1) * itemsPerPage; // 计算起始索引

  const handleSearchChange = useCallback((e) => {
    const newValue = e.target.value;
    setSearchTerm(newValue);
  }, []);

  const handleSortChange = (e) => {
    setSortOrder(e.target.value);
    setCurrentPage(1);
  };

  const handleFilterChange = (filterType, value) => {
    console.log('过滤器变化:', filterType, value);
    setFilters(prev => {
      const newFilters = {
        ...prev,
        [filterType]: value
      };
      console.log('新过滤器状态:', newFilters);
      
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
    setCurrentPage(1); // 重置到第一页
  };

  const clearFilters = () => {
    console.log('清除过滤器');
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
    setCurrentPage(1);
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };


  if (loading) {
    return (
      <div className={styles.container}>
        <Head>
          <title>鸟类名录 - KBird</title>
          <meta name="description" content="查看所有鸟类的中文名和拉丁名，按编号排序" />
        </Head>
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
        <Head>
          <title>鸟类名录 - KBird</title>
          <meta name="description" content="查看所有鸟类的中文名和拉丁名，按编号排序" />
        </Head>
        <Navbar />
        <main className={styles.main}>
          <div className={styles.errorContainer}>
            <h2>加载失败</h2>
            <p>{error}</p>
            <button onClick={() => window.location.reload()} className={styles.retryButton}>
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
      <Head>
        <title>鸟类名录 - KBird</title>
        <meta name="description" content="查看所有鸟类的中文名和拉丁名，按编号排序" />
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
              鸟类名录
            </span>
          </h1>
          <p className={styles.description}>
            展示所有鸟类的中文名和拉丁学名，共 {pagination.total} 种鸟类
          </p>
        </div>

        {/* 搜索区域 */}
        <div className={styles.searchSection}>
          <div className={styles.searchContainer}>
            <div className={styles.searchInputWrapper}>
              <input
                type="text"
                placeholder="搜索鸟类名称、学名或分类... (支持拼音搜索，如：'hongque' 或 'hq')"
                value={searchTerm}
                onChange={handleSearchChange}
                className={styles.searchInput}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleSearch();
                  }
                }}
              />
              <div className={styles.searchButtons}>
                <button
                  onClick={handleSearch}
                  className={styles.searchButton}
                  disabled={loading}
                >
                  搜索
                </button>
                {activeSearchTerm && (
                  <button
                    onClick={handleClearSearch}
                    className={styles.clearButton}
                  >
                    清空
                  </button>
                )}
              </div>
            </div>
            {activeSearchTerm && (
              <div className={styles.searchTips}>
                💡 当前搜索："{activeSearchTerm}" | 支持中文、拼音、拼音首字母搜索
              </div>
            )}
          </div>
          
          <div className={styles.sortContainer}>
            <label htmlFor="sortOrder">排序方式：</label>
            <select
              id="sortOrder"
              value={sortOrder}
              onChange={handleSortChange}
              className={styles.sortSelect}
            >
              <option value="asc">中文名 A-Z</option>
              <option value="desc">中文名 Z-A</option>
            </select>
          </div>
        </div>

        {/* 过滤器区域 */}
        <div className={styles.filterSection}>
          <div className={styles.filterGrid}>
            <div className={styles.filterGroup}>
              <label htmlFor="orderFilter">分类（目）：</label>
              <select
                id="orderFilter"
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
              <label htmlFor="familyFilter">科：</label>
              <select
                id="familyFilter"
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
              <label htmlFor="iucnFilter">IUCN保护等级：</label>
              <select
                id="iucnFilter"
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
              <label htmlFor="chinaFilter">中国保护等级：</label>
              <select
                id="chinaFilter"
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
          </div>
          
          <div className={styles.filterActions}>
            <div className={styles.actionButtons}>
              <button 
                onClick={clearFilters}
                className={styles.clearFiltersButton}
                disabled={!filters.order && !filters.family && !filters.iucnProtectionLevel && !filters.chinaProtectionLevel}
              >
                清除过滤器
              </button>
              <button 
                onClick={() => setShowPDFExporter(!showPDFExporter)}
                className={styles.exportButton}
                style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
              >
                {showPDFExporter ? '隐藏导出功能' : '导出详细信息'}
              </button>
            </div>
            {(filters.order || filters.family || filters.iucnProtectionLevel || filters.chinaProtectionLevel) && (
              <div className={styles.activeFilters}>
                <span>当前过滤：</span>
                {filters.order && <span className={styles.activeFilter}>
                  {formatTaxonomyDisplay(getOrderChineseName(filters.order), filters.order)}
                </span>}
                {filters.family && <span className={styles.activeFilter}>
                  {formatTaxonomyDisplay(getFamilyChineseName(filters.family), filters.family)}
                </span>}
                {filters.iucnProtectionLevel && <span className={styles.activeFilter}>IUCN: {filters.iucnProtectionLevel}</span>}
                {filters.chinaProtectionLevel && <span className={styles.activeFilter}>中国: {filters.chinaProtectionLevel}</span>}
              </div>
            )}
          </div>
        </div>

        {/* 导出功能区域 */}
        {showPDFExporter && (
          <div className={styles.exportSection}>
            <HTMLPDFExporter 
              birds={birds}
              selectedBirds={birds}
              filters={filters}
              searchTerm={activeSearchTerm}
            />
          </div>
        )}

        {/* 统计信息 */}
        <div className={styles.stats}>
          <span className={styles.statItem}>
            总计: {pagination.total} 种鸟类
          </span>
          <span className={styles.statItem}>
            显示: {currentBirds.length} 种鸟类
          </span>
          <span className={styles.statItem}>
            第 {currentPage} 页，共 {totalPages} 页
          </span>
        </div>

        {/* 表格列表 */}
        <div className={styles.catalogContainer}>
          <div className={styles.catalogHeader}>
            <div className={styles.headerCell}>编号</div>
            <div className={styles.headerCell}>中文名</div>
            <div className={styles.headerCell}>拉丁学名</div>
            <div className={styles.headerCell}>分类</div>
            <div className={styles.headerCell}>保护状态</div>
          </div>

          {currentBirds.map((bird, index) => (
            <div key={bird._id} className={styles.catalogRow}>
              <div className={styles.cell}>
                <span className={styles.number}>
                  {startIndex + index + 1}
                </span>
              </div>
              <div className={styles.cell}>
                <Link href={`/birds/${bird._id}`} className={styles.birdLink}>
                  {bird.name}
                </Link>
              </div>
              <div className={styles.cell}>
                <span className={styles.scientificName}>
                  <em>{bird.scientificName}</em>
                </span>
              </div>
              <div className={styles.cell}>
                <div className={styles.taxonomy}>
                  {bird.category ? (
                    // 解析category字段，按层级分行显示，只显示目和科
                    (() => {
                      const parts = bird.category.split(' > ');
                      return parts.slice(0, 2).map((part, index) => {
                        const labels = ['目', '科'];
                        const latinFields = [bird.order, bird.family];
                        
                        return (
                          <div key={index} className={styles.taxonomyItem}>
                            <span className={styles.taxonomyLabel}>{labels[index]}:</span>
                            <span className={styles.taxonomyValue}>
                              {part}
                              {latinFields[index] && latinFields[index] !== part && (
                                <span className={styles.latinName}>/{latinFields[index]}</span>
                              )}
                            </span>
                          </div>
                        );
                      });
                    })()
                  ) : (
                    <>
                      {bird.order && (
                        <div className={styles.taxonomyItem}>
                          <span className={styles.taxonomyLabel}>目:</span>
                          <span className={styles.taxonomyValue}>{bird.order}</span>
                        </div>
                      )}
                      {bird.family && (
                        <div className={styles.taxonomyItem}>
                          <span className={styles.taxonomyLabel}>科:</span>
                          <span className={styles.taxonomyValue}>{bird.family}</span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
              <div className={styles.cell}>
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
            </div>
          ))}
        </div>

        {/* 分页 */}
        {totalPages > 1 && (
          <div className={styles.pagination}>
            <div className={styles.paginationInfo}>
              显示第 {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, pagination.total)} 条，共 {pagination.total} 条记录
            </div>
            
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className={styles.pageButton}
            >
              ← 上一页
            </button>
            
            <div className={styles.pageNumbers}>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }
                
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
            
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className={styles.pageButton}
            >
              下一页 →
            </button>
          </div>
        )}

        {/* 空状态 */}
        {!loading && currentBirds.length === 0 && (
          <div className={styles.noResults}>
            <div className={styles.noResultsIcon}>🐦</div>
            <h3>没有找到匹配的鸟类</h3>
            <p>尝试调整搜索条件</p>
          </div>
        )}
      </main>


      <Footer />
    </div>
  );
}