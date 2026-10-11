'use client';
import { useState, useEffect } from 'react';
/* eslint-disable react-hooks/exhaustive-deps */
import Image from 'next/image';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { provinces, getCitiesByProvince } from '@/data/chinaRegions';
import { getLocationTypeIcon } from '@/components/Icons';
import PageState from '@/components/PageState';
import SimplePageHeader, {
  HeaderPrimaryButton,
} from '@/components/SimplePageHeader';
import { api } from '@/utils/api';
import { formatAddressRegion } from '@/utils/formatAddressRegion';
import { HABITAT_COVER_SETS, resolveLocationCover, useHabitatCoverSet } from '@/utils/habitatCover';
import LocationMapPicker from '@/components/LocationMapPicker';
import FoldFilterPanel from '@/components/FoldFilterPanel';
import styles from '@/styles/Locations.module.css';

const SYNC_COOLDOWN_MS = 10 * 1000;

function locationCardAddress(location) {
  const name = String(location?.name || '').trim();
  const label = formatAddressRegion(location?.address);
  const parts = label
    ? label.split(' · ').filter((part) => part !== name)
    : [];
  return parts.length ? parts.join(' · ') : '地址未完善';
}

export default function LocationsPage() {
  const [coverSet, updateCoverSet] = useHabitatCoverSet();
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterCity, setFilterCity] = useState('');
  const [filterProvince, setFilterProvince] = useState('');
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
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncMessage, setSyncMessage] = useState(null);
  const [syncCooldownUntil, setSyncCooldownUntil] = useState(0);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const [summary, setSummary] = useState(null);
  const [newLocation, setNewLocation] = useState({
    name: '',
    description: '',
    coordinates: {
      latitude: '',
      longitude: '',
    },
    address: {
      province: '',
      city: '',
      district: '',
      street: '',
    },
    type: '其他',
    environment: {
      habitat: [],
      vegetation: [],
      waterSource: '无水源',
      accessibility: '容易到达',
    },
    birding: {
      bestSeason: [],
      commonSpecies: [],
      rareSpecies: [],
      difficulty: '初级',
    },
    facilities: {
      parking: false,
      restroom: false,
      shelter: false,
      observationPlatform: false,
      informationBoard: false,
    },
    tags: [],
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const rawQuery = new URLSearchParams(window.location.search).get('search') || '';
    const initialSearch = String(rawQuery).trim();
    if (initialSearch) {
      setSearchTerm(initialSearch);
      setCurrentPage(1);
      setShowSuggestions(false);
    }
  }, []);

  const syncSearchToUrl = (term) => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    const trimmed = String(term || '').trim();
    if (trimmed) url.searchParams.set('search', trimmed);
    else url.searchParams.delete('search');
    const next = `${url.pathname}${url.search}${url.hash}`;
    window.history.replaceState({}, '', next);
  };

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
  }, [currentPage, searchTerm, filterType, filterCity, filterProvince, sortBy, sortOrder]);

  useEffect(() => {
    const fetchSummary = async () => {
      try {
        const data = await api.locations.getSummary();
        if (data.success && data.data) setSummary(data.data);
      } catch (err) {
        console.error('获取地点小结失败:', err);
      }
    };
    fetchSummary();
  }, [syncMessage]);

  useEffect(() => {
    const getSearchSuggestions = async () => {
      if (searchTerm.length >= 2) {
        setIsSearching(true);
        try {
          const data = await api.locations.getAll({
            suggestions: 'true',
            search: searchTerm,
          });
          if (data.success) {
            setSearchSuggestions(data.suggestions || []);
            setShowSuggestions(true);
          }
        } catch (searchError) {
          console.error('获取搜索建议失败:', searchError);
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

  const fetchLocations = async (opts) => {
    setLoading(true);
    try {
      const page = opts?.page != null ? opts.page : currentPage;
      const term = opts?.search !== undefined ? opts.search : searchTerm;

      const params = new URLSearchParams({
        page: String(page),
        limit: '20',
        sortBy,
        sortOrder,
      });

      if (term && String(term).trim()) params.append('search', String(term).trim());
      if (filterType) params.append('type', filterType);
      if (filterCity) params.append('city', filterCity);
      if (filterProvince) params.append('province', filterProvince);

      const data = await api.locations.getAll(Object.fromEntries(params.entries()));
      if (data.success) {
        setLocations(data.data);
        setPagination(data.pagination);
      }
    } catch (fetchError) {
      console.error('获取地点列表失败:', fetchError);
      setError('获取地点列表失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setShowSuggestions(false);
    setCurrentPage(1);
    syncSearchToUrl(searchTerm);
    fetchLocations({ page: 1, search: searchTerm });
  };

  const handleClearSearch = () => {
    setSearchTerm('');
    setShowSuggestions(false);
    setCurrentPage(1);
    syncSearchToUrl('');
    fetchLocations({ page: 1, search: '' });
  };

  const handleSuggestionClick = (suggestion) => {
    setSearchTerm(suggestion);
    setShowSuggestions(false);
    setCurrentPage(1);
    syncSearchToUrl(suggestion);
    fetchLocations({ page: 1, search: suggestion });
  };

  const handleSearchInputChange = (e) => {
    const next = e.target.value;
    setSearchTerm(next);
    if (next.length < 2) {
      setShowSuggestions(false);
    }
    // 清空输入时同步去掉 URL 参数，避免刷新后又回来
    if (!String(next).trim()) {
      syncSearchToUrl('');
    }
  };

  const handleClickOutside = (e) => {
    if (!e.target.closest('.search-container')) {
      setShowSuggestions(false);
    }
  };

  useEffect(() => {
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!syncCooldownUntil) {
      setCooldownRemaining(0);
      return undefined;
    }
    const tick = () => {
      const remain = Math.max(0, Math.ceil((syncCooldownUntil - Date.now()) / 1000));
      setCooldownRemaining(remain);
      if (remain <= 0) {
        setSyncCooldownUntil(0);
      }
    };
    tick();
    const timer = setInterval(tick, 500);
    return () => clearInterval(timer);
  }, [syncCooldownUntil]);

  const handleProvinceChange = (e) => {
    const provinceCode = e.target.value;
    const provinceName = provinces.find((p) => p.code === provinceCode)?.name || '';

    setSelectedProvince(provinceCode);
    setSelectedCity('');
    setAvailableCities(getCitiesByProvince(provinceCode));

    setNewLocation((prev) => ({
      ...prev,
      address: {
        ...prev.address,
        province: provinceName,
        city: '',
      },
    }));
  };

  const handleCityChange = (e) => {
    const cityCode = e.target.value;
    const cityName = availableCities.find((c) => c.code === cityCode)?.name || '';

    setSelectedCity(cityCode);

    setNewLocation((prev) => ({
      ...prev,
      address: {
        ...prev.address,
        city: cityName,
      },
    }));
  };

  const handleSyncLocations = async () => {
    if (cooldownRemaining > 0) {
      setSyncMessage({ type: 'error', text: `操作过快，请 ${cooldownRemaining} 秒后再试` });
      return;
    }
    const token = localStorage.getItem('token');
    if (!token) {
      setSyncMessage({ type: 'error', text: '请先登录再同步地点' });
      return;
    }
    setSyncLoading(true);
    setSyncMessage(null);
    try {
      const data = await api.locations.syncFromRecords();
      if (data.success) {
        setSyncCooldownUntil(Date.now() + SYNC_COOLDOWN_MS);
        setSyncMessage({
          type: 'success',
          text: data.message,
          created: data.data?.created,
          createdNames: Array.isArray(data.data?.createdNames) ? data.data.createdNames : [],
        });
        fetchLocations();
      } else {
        setSyncMessage({ type: 'error', text: data.message || '地点同步失败' });
      }
    } catch (err) {
      setSyncMessage({ type: 'error', text: err?.message || '地点同步请求失败，请重试' });
    } finally {
      setSyncLoading(false);
    }
  };

  const handleCreateLocation = async (e) => {
    e.preventDefault();

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('请先登录');
        return;
      }

      const lng = parseFloat(newLocation.coordinates.longitude);
      const lat = parseFloat(newLocation.coordinates.latitude);
      if (!Number.isFinite(lng) || !Number.isFinite(lat) || (lng === 0 && lat === 0)) {
        setError('请先在地图上选点或填写有效经纬度，避免创建无坐标地点');
        return;
      }

      const payload = {
        ...newLocation,
        coordinates: [lng, lat],
      };

      const data = await api.locations.create(payload);

      if (data.success) {
        setSyncMessage({ type: 'success', text: '地点创建成功' });
        setShowCreateForm(false);
        setError(null);
        setNewLocation({
          name: '',
          description: '',
          coordinates: { latitude: '', longitude: '' },
          address: { province: '', city: '', district: '', street: '' },
          type: '其他',
          environment: { habitat: [], vegetation: [], waterSource: '无水源', accessibility: '容易到达' },
          birding: { bestSeason: [], commonSpecies: [], rareSpecies: [], difficulty: '初级' },
          facilities: { parking: false, restroom: false, shelter: false, observationPlatform: false, informationBoard: false },
          tags: [],
        });
        setSelectedProvince('');
        setSelectedCity('');
        setAvailableCities([]);
        fetchLocations();
      } else {
        setError(data.message || '创建失败');
      }
    } catch {
      setError('创建失败，请重试');
    }
  };

  const locationTypes = ['公园', '自然保护区', '湿地', '森林', '山区', '城市', '乡村', '海岸', '湖泊', '河流', '其他'];

  const filterPanelSummary = (() => {
    const parts = [];
    if (summary?.total != null) parts.push(`共 ${summary.total} 个地点`);
    if (filterProvince) parts.push(filterProvince);
    if (searchTerm.trim()) parts.push(`搜索「${searchTerm.trim()}」`);
    if (filterType) parts.push(filterType);
    if (filterCity.trim()) parts.push(filterCity.trim());
    if (parts.length <= 1) return parts.concat(['搜索 · 类型 · 省市']).join(' · ');
    return parts.join(' · ');
  })();

  return (
    <div className={styles.container}>
      <Navbar />

      <main className={styles.main}>
        <SimplePageHeader
          title="地点词典"
          description="常用点、坐标和生境"
          descriptionVariant="caption"
          actions={
            <HeaderPrimaryButton onClick={() => setShowCreateForm(!showCreateForm)}>
              {showCreateForm ? '收起表单' : '添加地点'}
            </HeaderPrimaryButton>
          }
        />

        <FoldFilterPanel
          storageKey="kbird.locations.filterPanel"
          title="筛选"
          summary={filterPanelSummary}
          className={styles.foldPanel}
        >
        {summary && (
          <div className={styles.summaryBar}>
            <span className={styles.summaryTotal}>共 {summary.total} 个地点</span>
            {Array.isArray(summary.list) && summary.list.length > 0 && (
              <span className={styles.summaryByProvince}>
                {summary.list.map((item) => (
                  <button
                    key={item._id}
                    type="button"
                    className={`${styles.summaryItem} ${filterProvince === item._id ? styles.summaryItemActive : ''}`}
                    onClick={() => {
                      setFilterProvince(filterProvince === item._id ? '' : item._id);
                      setCurrentPage(1);
                    }}
                    title={
                      item._id === '未标注'
                        ? `查看省份为空的 ${item.count} 个地点，可进入后补全省份`
                        : `查看${item._id}的${item.count}个地点`
                    }
                  >
                    {item._id} {item.count}个
                  </button>
                ))}
              </span>
            )}
          </div>
        )}

        <div className={styles.filtersSection}>
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
              {searchTerm ? (
                <button
                  type="button"
                  className={styles.clearSearchButton}
                  onClick={handleClearSearch}
                  title="清除搜索"
                  aria-label="清除搜索"
                >
                  ✕
                </button>
              ) : null}
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
              {locationTypes.map((type) => (
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
            <button
              type="button"
              onClick={handleSyncLocations}
              disabled={syncLoading || cooldownRemaining > 0}
              className={styles.syncButton}
              title={cooldownRemaining > 0 ? `请 ${cooldownRemaining} 秒后重试` : '将观察记录中出现的地点自动添加到地点词典'}
            >
              {syncLoading ? '同步中...' : cooldownRemaining > 0 ? `冷却中(${cooldownRemaining}s)` : '地点同步'}
            </button>
          </form>
        </div>
        </FoldFilterPanel>

        {syncMessage && (
          <div className={syncMessage.type === 'success' ? styles.syncSuccess : styles.syncError}>
            <p className={styles.syncMessageText}>{syncMessage.text}</p>
            {syncMessage.type === 'success' && syncMessage.createdNames?.length > 0 && (
              <div className={styles.syncCreatedList}>
                <span className={styles.syncCreatedLabel}>新增地点：</span>
                <ul className={styles.syncCreatedNames}>
                  {syncMessage.createdNames.map((name, i) => (
                    <li key={i}>{name}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

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
                    onChange={(e) => setNewLocation((prev) => ({ ...prev, name: e.target.value }))}
                    required
                    className={styles.input}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label>地点类型</label>
                  <select
                    value={newLocation.type}
                    onChange={(e) => setNewLocation((prev) => ({ ...prev, type: e.target.value }))}
                    className={styles.select}
                  >
                    {locationTypes.map((type) => (
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
                    {provinces.map((province) => (
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
                    {availableCities.map((city) => (
                      <option key={city.code} value={city.code}>
                        {city.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className={styles.formGroup}>
                  <label>区县</label>
                  <input
                    type="text"
                    value={newLocation.address.district}
                    onChange={(e) =>
                      setNewLocation((prev) => ({
                        ...prev,
                        address: { ...prev.address, district: e.target.value },
                      }))
                    }
                    className={styles.input}
                    placeholder="例如：西湖区"
                  />
                </div>

                <div className={styles.formGroup}>
                  <label>详细地址</label>
                  <input
                    type="text"
                    value={newLocation.address.street}
                    onChange={(e) =>
                      setNewLocation((prev) => ({
                        ...prev,
                        address: { ...prev.address, street: e.target.value },
                      }))
                    }
                    className={styles.input}
                    placeholder="例如：某公园东门"
                  />
                </div>
              </div>

              <div className={styles.formGroup}>
                <label>地图选点 *</label>
                <p className={styles.formHint}>
                  请搜索或在地图上点击设置坐标；无有效坐标的地点无法可靠显示在地图上。
                </p>
                <LocationMapPicker
                  latitude={newLocation.coordinates.latitude}
                  longitude={newLocation.coordinates.longitude}
                  onCoordinatesChange={({ latitude, longitude }) => {
                    setNewLocation((prev) => ({
                      ...prev,
                      coordinates: {
                        latitude:
                          latitude !== undefined && latitude !== ''
                            ? String(latitude)
                            : prev.coordinates.latitude,
                        longitude:
                          longitude !== undefined && longitude !== ''
                            ? String(longitude)
                            : prev.coordinates.longitude,
                      },
                    }));
                  }}
                  height="280px"
                />
                <div className={styles.formGrid} style={{ marginTop: 12 }}>
                  <div className={styles.formGroup}>
                    <label>纬度</label>
                    <input
                      type="number"
                      step="any"
                      value={newLocation.coordinates.latitude}
                      onChange={(e) =>
                        setNewLocation((prev) => ({
                          ...prev,
                          coordinates: { ...prev.coordinates, latitude: e.target.value },
                        }))
                      }
                      className={styles.input}
                      placeholder="例如：30.2741"
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label>经度</label>
                    <input
                      type="number"
                      step="any"
                      value={newLocation.coordinates.longitude}
                      onChange={(e) =>
                        setNewLocation((prev) => ({
                          ...prev,
                          coordinates: { ...prev.coordinates, longitude: e.target.value },
                        }))
                      }
                      className={styles.input}
                      placeholder="例如：120.1551"
                    />
                  </div>
                </div>
              </div>

              <div className={styles.formGroup}>
                <label>描述</label>
                <textarea
                  value={newLocation.description}
                  onChange={(e) => setNewLocation((prev) => ({ ...prev, description: e.target.value }))}
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

        {!loading && !error ? (
          <div className={styles.listMeta}>
            <div className={styles.listMetaLead}>
              <span className={styles.listMetaCount}>
                {pagination.totalItems ?? locations.length} 个
              </span>
              {pagination.totalPages > 1 ? (
                <div className="kb-view-seg kb-meta-seg" aria-label="翻页">
                  <button
                    type="button"
                    className="kb-view-tab kb-meta-tab"
                    aria-label="上一页"
                    disabled={!pagination.hasPrevPage}
                    onClick={() => setCurrentPage(currentPage - 1)}
                  >
                    ←
                  </button>
                  <span className="kb-meta-index">
                    {pagination.currentPage}/{pagination.totalPages}
                  </span>
                  <button
                    type="button"
                    className="kb-view-tab kb-meta-tab"
                    aria-label="下一页"
                    disabled={!pagination.hasNextPage}
                    onClick={() => setCurrentPage(currentPage + 1)}
                  >
                    →
                  </button>
                </div>
              ) : null}
            </div>
            <div className={styles.listMetaTools}>
              <div className="kb-view-seg kb-meta-seg" role="group" aria-label="封面风格">
                <span className="kb-meta-label">封面</span>
                {HABITAT_COVER_SETS.map((set) => (
                  <button
                    key={set.id}
                    type="button"
                    className={`kb-view-tab kb-meta-tab${coverSet === set.id ? ' is-active' : ''}`}
                    aria-pressed={coverSet === set.id}
                    onClick={() => updateCoverSet(set.id)}
                  >
                    {set.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        <div className={styles.locationsList}>
          {loading ? (
            <PageState type="loading" title="地点加载中..." />
          ) : error ? (
            <PageState
              type="error"
              title="地点列表加载失败"
              message={error}
              actionLabel="重试"
              onAction={() => {
                setError(null);
                fetchLocations();
              }}
            />
          ) : locations.length > 0 ? (
            <>
              <div className={styles.locationsGrid}>
                {(() => {
                  const usedCoverUrls = new Set();
                  return locations.map((location) => {
                    const addressText = locationCardAddress(location);
                    const cover = resolveLocationCover(location, usedCoverUrls, coverSet);

                    return (
                      <article key={location._id} className={styles.locationCard}>
                        <div className={styles.locationCover} aria-hidden="true">
                          <Image
                            src={cover.url}
                            alt=""
                            fill
                            sizes="(max-width: 640px) 100vw, (max-width: 960px) 50vw, 25vw"
                            unoptimized
                            className={styles.locationCoverImage}
                          />
                          <div className={styles.locationCoverShade} />
                        </div>
                        <Link href={`/locations/${location._id}`} className={styles.locationMain}>
                          <div className={styles.locationTitleRow}>
                            <h3 className={styles.locationName}>{location.name}</h3>
                            {location.type ? (
                              <span className={styles.locationType}>
                                {getLocationTypeIcon(location.type, 12, 'currentColor')}
                                <span className={styles.typeText}>{location.type}</span>
                              </span>
                            ) : null}
                          </div>
                          <p className={styles.locationAddress}>{addressText}</p>
                        </Link>

                        <div className={styles.locationFooter}>
                          <p className={styles.locationMeta}>
                            <span>
                              <strong>{location.stats?.totalRecords || 0}</strong> 观察
                            </span>
                            <span className={styles.metaSep} aria-hidden>
                              ·
                            </span>
                            <span>
                              <strong>{location.stats?.uniqueSpecies || 0}</strong> 鸟种
                            </span>
                          </p>
                        </div>
                      </article>
                    );
                  });
                })()}
              </div>

            </>
          ) : (
            <PageState
              type="empty"
              title="暂无地点数据"
              message="还没有地点。先添加一个，记录就能挂上坐标。"
              actionLabel="添加地点"
              onAction={() => setShowCreateForm(true)}
            />
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
