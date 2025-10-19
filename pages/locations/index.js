import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import { provinces, cities, getCitiesByProvince } from '../../data/chinaRegions';
import { getLocationTypeIcon } from '../../components/Icons';
import styles from '../../styles/Locations.module.css';

export default function Locations() {
  const router = useRouter();
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterCity, setFilterCity] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');
  const [pagination, setPagination] = useState({});
  const [currentPage, setCurrentPage] = useState(1);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [searchSuggestions, setSearchSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState(null);
  const [selectedProvince, setSelectedProvince] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [availableCities, setAvailableCities] = useState([]);
  const [newLocation, setNewLocation] = useState({
    name: '',
    description: '',
    coordinates: [0, 0],
    address: {
      province: '',
      city: '',
      district: '',
      street: ''
    },
    type: '其他',
    environment: {
      habitat: [],
      vegetation: [],
      waterSource: '无水源',
      accessibility: '容易到达'
    },
    birding: {
      bestSeason: [],
      commonSpecies: [],
      rareSpecies: [],
      difficulty: '初级'
    },
    facilities: {
      parking: false,
      restroom: false,
      shelter: false,
      observationPlatform: false,
      informationBoard: false
    },
    tags: []
  });

  useEffect(() => {
    let isMounted = true;
    
    const fetchData = async () => {
      if (isMounted) {
        await fetchLocations();
      }
    };
    
    fetchData();
    
    return () => {
      isMounted = false;
    };
  }, [currentPage, searchTerm, filterType, filterCity, sortBy, sortOrder]);

  // 搜索建议功能
  useEffect(() => {
    const getSearchSuggestions = async () => {
      if (searchTerm.length >= 2) {
        setIsSearching(true);
        try {
          const response = await fetch(`/api/locations?suggestions=true&search=${encodeURIComponent(searchTerm)}`);
          if (response.ok) {
            const data = await response.json();
            if (data.success) {
              setSearchSuggestions(data.suggestions || []);
              setShowSuggestions(true);
            }
          }
        } catch (error) {
          console.error('获取搜索建议失败:', error);
        } finally {
          setIsSearching(false);
        }
      } else {
        setSearchSuggestions([]);
        setShowSuggestions(false);
      }
    };

    const timeoutId = setTimeout(getSearchSuggestions, 300);
    return () => clearTimeout(timeoutId);
  }, [searchTerm]);

  const fetchLocations = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: currentPage,
        limit: 20,
        sortBy,
        sortOrder
      });

      if (searchTerm) params.append('search', searchTerm);
      if (filterType) params.append('type', filterType);
      if (filterCity) params.append('city', filterCity);

      const response = await fetch(`/api/locations?${params}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setLocations(data.data);
          setPagination(data.pagination);
        }
      }
    } catch (error) {
      console.error('获取地点列表失败:', error);
      setError('获取地点列表失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setCurrentPage(1);
    setShowSuggestions(false);
    fetchLocations();
  };

  // 处理搜索建议点击
  const handleSuggestionClick = (suggestion) => {
    setSearchTerm(suggestion);
    setShowSuggestions(false);
    setCurrentPage(1);
    fetchLocations();
  };

  // 处理搜索输入变化
  const handleSearchInputChange = (e) => {
    setSearchTerm(e.target.value);
    if (e.target.value.length < 2) {
      setShowSuggestions(false);
    }
  };

  // 点击外部关闭建议
  const handleClickOutside = (e) => {
    if (!e.target.closest('.search-container')) {
      setShowSuggestions(false);
    }
  };

  useEffect(() => {
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // 处理省份选择
  const handleProvinceChange = (e) => {
    const provinceCode = e.target.value;
    const provinceName = provinces.find(p => p.code === provinceCode)?.name || '';
    
    setSelectedProvince(provinceCode);
    setSelectedCity('');
    setAvailableCities(getCitiesByProvince(provinceCode));
    
    setNewLocation(prev => ({
      ...prev,
      address: {
        ...prev.address,
        province: provinceName,
        city: ''
      }
    }));
  };

  // 处理城市选择
  const handleCityChange = (e) => {
    const cityCode = e.target.value;
    const cityName = availableCities.find(c => c.code === cityCode)?.name || '';
    
    setSelectedCity(cityCode);
    
    setNewLocation(prev => ({
      ...prev,
      address: {
        ...prev.address,
        city: cityName
      }
    }));
  };

  const handleCreateLocation = async (e) => {
    e.preventDefault();
    
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        alert('请先登录');
        return;
      }

      const response = await fetch('/api/locations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(newLocation),
      });

      const data = await response.json();
      
      if (data.success) {
        alert('地点创建成功！');
        setShowCreateForm(false);
        setNewLocation({
          name: '',
          description: '',
          coordinates: [0, 0],
          address: { province: '', city: '', district: '', street: '' },
          type: '其他',
          environment: { habitat: [], vegetation: [], waterSource: '无水源', accessibility: '容易到达' },
          birding: { bestSeason: [], commonSpecies: [], rareSpecies: [], difficulty: '初级' },
          facilities: { parking: false, restroom: false, shelter: false, observationPlatform: false, informationBoard: false },
          tags: []
        });
        setSelectedProvince('');
        setSelectedCity('');
        setAvailableCities([]);
        fetchLocations();
      } else {
        alert(data.message || '创建失败');
      }
    } catch (error) {
      alert('创建失败，请重试');
    }
  };

  const locationTypes = [
    '公园', '自然保护区', '湿地', '森林', '山区', 
    '城市', '乡村', '海岸', '湖泊', '河流', '其他'
  ];

  const difficulties = ['初级', '中级', '高级'];

  return (
    <div className={styles.container}>
      <Head>
        <title>地点名录 - KBird</title>
        <meta name="description" content="探索和分享观鸟地点" />
      </Head>

      <Navbar />

      <main className={styles.main}>
        <div className={styles.header}>
          <h1>地点名录</h1>
          <p>发现和分享优质的观鸟地点</p>
        </div>

        {/* 搜索和筛选 */}
        <div className={styles.filters}>
          <form onSubmit={handleSearch} className={styles.searchForm}>
            <div className={`${styles.searchContainer} search-container`}>
              <input
                type="text"
                value={searchTerm}
                onChange={handleSearchInputChange}
                placeholder="搜索地点名称，如：五常、湿地、公园..."
                className={styles.searchInput}
                autoComplete="off"
              />
              {isSearching && (
                <div className={styles.searchLoading}>
                  <div className={styles.spinner}></div>
                </div>
              )}
              {showSuggestions && searchSuggestions.length > 0 && (
                <div className={styles.searchSuggestions}>
                  {searchSuggestions.map((suggestion, index) => (
                    <div
                      key={index}
                      className={styles.suggestionItem}
                      onClick={() => handleSuggestionClick(suggestion)}
                    >
                      <span className={styles.suggestionText}>{suggestion}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className={styles.filterSelect}
            >
              <option value="">所有类型</option>
              {locationTypes.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
            <input
              type="text"
              value={filterCity}
              onChange={(e) => setFilterCity(e.target.value)}
              placeholder="城市"
              className={styles.cityInput}
            />
            <select
              value={`${sortBy}-${sortOrder}`}
              onChange={(e) => {
                const [field, order] = e.target.value.split('-');
                setSortBy(field);
                setSortOrder(order);
              }}
              className={styles.sortSelect}
            >
              <option value="name-asc">名称 A-Z</option>
              <option value="name-desc">名称 Z-A</option>
                <option value="stats.totalRecords-desc">观察次数最多</option>
              <option value="stats.uniqueSpecies-desc">鸟类最多</option>
              <option value="createdAt-desc">最新创建</option>
            </select>
            <button type="submit" className={styles.searchButton}>
              搜索
            </button>
          </form>
          
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className={styles.createButton}
          >
            + 添加新地点
          </button>
        </div>

        {/* 创建地点表单 */}
        {showCreateForm && (
          <div className={styles.createForm}>
            <h2>创建新地点</h2>
            <form onSubmit={handleCreateLocation}>
              <div className={styles.formGrid}>
                <div className={styles.formGroup}>
                  <label>地点名称 *</label>
                  <input
                    type="text"
                    value={newLocation.name}
                    onChange={(e) => setNewLocation(prev => ({ ...prev, name: e.target.value }))}
                    required
                    className={styles.input}
                  />
                </div>
                
                <div className={styles.formGroup}>
                  <label>地点类型</label>
                  <select
                    value={newLocation.type}
                    onChange={(e) => setNewLocation(prev => ({ ...prev, type: e.target.value }))}
                    className={styles.select}
                  >
                    {locationTypes.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>
                
                <div className={styles.formGroup}>
                  <label>省份 *</label>
                  <select
                    value={selectedProvince}
                    onChange={handleProvinceChange}
                    className={styles.input}
                    required
                  >
                    <option value="">请选择省份</option>
                    {provinces.map(province => (
                      <option key={province.code} value={province.code}>
                        {province.name}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div className={styles.formGroup}>
                  <label>城市 *</label>
                  <select
                    value={selectedCity}
                    onChange={handleCityChange}
                    className={styles.input}
                    required
                    disabled={!selectedProvince}
                  >
                    <option value="">请选择城市</option>
                    {availableCities.map(city => (
                      <option key={city.code} value={city.code}>
                        {city.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              
              <div className={styles.formGroup}>
                <label>描述</label>
                <textarea
                  value={newLocation.description}
                  onChange={(e) => setNewLocation(prev => ({ ...prev, description: e.target.value }))}
                  rows="4"
                  className={styles.textarea}
                />
              </div>
              
              <div className={styles.formActions}>
                <button type="button" onClick={() => setShowCreateForm(false)}>
                  取消
                </button>
                <button type="submit">创建地点</button>
              </div>
            </form>
          </div>
        )}

        {/* 地点列表 */}
        <div className={styles.locationsList}>
          {loading ? (
            <div className={styles.loading}>
              <p>加载中...</p>
            </div>
          ) : error ? (
            <div className={styles.errorState}>
              <h3>加载失败</h3>
              <p>{error}</p>
              <button onClick={() => { setError(null); fetchLocations(); }} className={styles.retryButton}>
                重试
              </button>
            </div>
          ) : locations.length > 0 ? (
            <>
              {locations.map((location) => (
                <div key={location._id} className={styles.locationCard}>
                  <div className={styles.locationHeader}>
                    <h3 className={styles.locationName}>{location.name}</h3>
                    <span className={styles.locationType}>
                      {getLocationTypeIcon(location.type, 16, 'white')}
                      <span className={styles.typeText}>{location.type}</span>
                    </span>
                  </div>
                  
                  <div className={styles.locationInfo}>
                    <p className={styles.locationAddress}>
                      {location.address.province && location.address.city 
                        ? `${location.address.province} • ${location.address.city}${location.address.district ? ` • ${location.address.district}` : ''}`
                        : location.address.city || '未知位置'
                      }
                    </p>
                    {location.description && (
                      <p className={styles.locationDescription}>
                        {location.description.length > 150 
                          ? location.description.substring(0, 150) + '...'
                          : location.description
                        }
                      </p>
                    )}
                  </div>
                  
                  <div className={styles.locationStats}>
                    <div className={styles.statItem}>
                      <span className={styles.statNumber}>{location.stats?.totalRecords || 0}</span>
                      <span className={styles.statLabel}>观察次数</span>
                    </div>
                    <div className={styles.statItem}>
                      <span className={styles.statNumber}>{location.stats?.uniqueSpecies || 0}</span>
                      <span className={styles.statLabel}>鸟类种类</span>
                    </div>
                  </div>
                  
                  <div className={styles.locationActions}>
                    <Link href={`/locations/${location._id}`} className={styles.viewButton}>
                      查看详情
                    </Link>
                    <Link href={`/records/add`} className={styles.addSightingButton}>
                      添加观察记录
                    </Link>
                  </div>
                </div>
              ))}
              
              {/* 分页 */}
              {pagination.totalPages > 1 && (
                <div className={styles.pagination}>
                  <button
                    onClick={() => setCurrentPage(currentPage - 1)}
                    disabled={!pagination.hasPrevPage}
                    className={styles.pageButton}
                  >
                    上一页
                  </button>
                  
                  <span className={styles.pageInfo}>
                    第 {pagination.currentPage} 页，共 {pagination.totalPages} 页
                  </span>
                  
                  <button
                    onClick={() => setCurrentPage(currentPage + 1)}
                    disabled={!pagination.hasNextPage}
                    className={styles.pageButton}
                  >
                    下一页
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className={styles.emptyState}>
              <h3>暂无地点数据</h3>
              <p>成为第一个添加观鸟地点的用户吧！</p>
              <button
                onClick={() => setShowCreateForm(true)}
                className={styles.createFirstButton}
              >
                创建第一个地点
              </button>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
