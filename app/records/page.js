'use client';

/* eslint-disable react-hooks/exhaustive-deps */
import { useState, useEffect, useMemo, useRef } from 'react';
import { formatDisplayDate, formatDisplayDateTime } from '@/utils/localDate';
import Image from 'next/image';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import ImageViewer from '@/components/ImageViewer';
import { useAuth } from '@/components/AuthProvider';
import { useErrorHandler } from '@/utils/useErrorHandler';
import ErrorMessage from '@/components/ErrorMessage';
import SimplePageHeader from '@/components/SimplePageHeader';
import PageState from '@/components/PageState';
import FoldFilterPanel from '@/components/FoldFilterPanel';
import { useFoldOpen, writeFoldOpen } from '@/utils/foldPanel';
import { api } from '@/utils/api';
import {
  provinces as chinaProvinces,
  getCitiesByProvince,
  getProvinceByName,
  getProvinceCodeByName,
  normalizeRegionLabel,
  regionNamesMatch,
} from '@/data/chinaRegions';
import { sortRecordBirdsByImportance } from '@/data/protectionLevels';
import { downloadPersonalRecordsExport } from '@/utils/personalExportDownload';
import { getRegionViewCenter } from '@/utils/regionViewCenters';
import habitatFilterData from '@/data/habitatFilters';
import {
  resolveRecordCover,
  readRecordsViewMode,
  writeRecordsViewMode,
  readCardStyle,
  writeCardStyle,
  readRecordsFilterPanelOpen,
  RECORDS_FILTER_PANEL_KEY,
  RECORDS_MAP_TOOLBOX_KEY,
  RECORD_COVER_MODES,
  useRecordCoverSet,
} from '@/utils/habitatCover';
import styles from '@/styles/Records.module.css';

const HABITAT_FILTERS = habitatFilterData.HABITAT_FILTERS || habitatFilterData;

const BirdMapProvider = dynamic(() => import('@/components/BirdMapProvider'), { ssr: false });

/** 与已见鸟种列表一致：宽屏约 6 列 × 3 行 */
const GRID_MIN_CARD_PX = 240;
const GRID_GAP_PX = 16;
const PAGE_CONTENT_MAX_PX = 1720;
const MAIN_PADDING_X_PX = 40;

function computeHabitatPageLimit(viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1200) {
  if (viewportWidth <= 768) return 12;

  const contentWidth = Math.min(Math.max(viewportWidth - MAIN_PADDING_X_PX, GRID_MIN_CARD_PX), PAGE_CONTENT_MAX_PX);
  const columns = Math.max(1, Math.floor((contentWidth + GRID_GAP_PX) / (GRID_MIN_CARD_PX + GRID_GAP_PX)));
  const rows = columns >= 5 ? 3 : columns >= 3 ? 4 : 6;
  return Math.min(30, Math.max(6, columns * rows));
}

function getInitialHabitatPageLimit() {
  if (typeof window === 'undefined') return 18;
  return computeHabitatPageLimit(window.innerWidth);
}

function getDisplayedBirds(allBirds, maxDisplay = 6) {
  const ranked = sortRecordBirdsByImportance(allBirds);
  return ranked.slice(0, maxDisplay);
}

export default function RecordsPage() {
  const { user, loading: authLoading } = useAuth();
  const currentUserId = user?._id || user?.id || '';
  const [records, setRecords] = useState([]);
  const [mapLocations, setMapLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [yearFilter, setYearFilter] = useState('');
  const [locationInput, setLocationInput] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [provinceFilter, setProvinceFilter] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [habitatFilter, setHabitatFilter] = useState('');
  const [sortFilter, setSortFilter] = useState('date_desc');
  // 登录后默认只看自己的记录；可切换「全部」查看本机共享流水
  const [scopeFilter, setScopeFilter] = useState('mine');
  const [viewMode, setViewMode] = useState('habitat');
  const [cardStyle, setCardStyle] = useState('field');
  const [coverSet, updateCoverSet] = useRecordCoverSet();
  const [filterPanelOpen, setFilterPanelOpen] = useFoldOpen(RECORDS_FILTER_PANEL_KEY, false);
  const [mapToolboxOpen, setMapToolboxOpen] = useFoldOpen(RECORDS_MAP_TOOLBOX_KEY, true);
  const [habitatPageLimit, setHabitatPageLimit] = useState(getInitialHabitatPageLimit);
  const [urlReady, setUrlReady] = useState(false);
  const [regionOptions, setRegionOptions] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [errors, setErrors] = useState([]);
  const [imageViewerOpen, setImageViewerOpen] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [currentImages, setCurrentImages] = useState([]);
  const [popularLocations, setPopularLocations] = useState([]);
  const [uniqueSpeciesCount, setUniqueSpeciesCount] = useState(0);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const deleteDialogRef = useRef(null);
  const deleteCancelRef = useRef(null);
  const deletePreviousFocusRef = useRef(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [selectionMode, setSelectionMode] = useState(false);
  const [batchBusy, setBatchBusy] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const { errors: apiErrors, addError, removeError } = useErrorHandler();

  const showingMineOnly = Boolean(currentUserId) && scopeFilter === 'mine';
  const canSelectRecords = showingMineOnly && selectionMode;
  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const allCurrentSelected =
    records.length > 0 && records.every((r) => selectedIdSet.has(String(r._id)));

  const toggleSelectionMode = () => {
    setSelectionMode((prev) => {
      const next = !prev;
      if (!next) setSelectedIds([]);
      return next;
    });
  };

  const activeFilterChips = useMemo(() => {
    const chips = [];
    if (searchTerm.trim()) chips.push({ key: 'search', label: `搜索：${searchTerm.trim()}` });
    if (yearFilter) chips.push({ key: 'year', label: `${yearFilter} 年` });
    else if (dateFilter === 'today') chips.push({ key: 'date', label: '今天' });
    else if (dateFilter === 'thisWeek') chips.push({ key: 'date', label: '本周' });
    else if (dateFilter === 'thisMonth') chips.push({ key: 'date', label: '本月' });
    if (provinceFilter.trim()) chips.push({ key: 'province', label: provinceFilter.trim() });
    if (cityFilter.trim()) chips.push({ key: 'city', label: cityFilter.trim() });
    if (habitatFilter) {
      const habitatLabel = HABITAT_FILTERS.find((item) => item.key === habitatFilter)?.label;
      if (habitatLabel) chips.push({ key: 'habitat', label: `生境：${habitatLabel}` });
    }
    if (locationFilter.trim()) chips.push({ key: 'location', label: `地点：${locationFilter.trim()}` });
    if (sortFilter && sortFilter !== 'date_desc') {
      const sortLabels = {
        date_asc: '日期旧→新',
        birds_desc: '鸟种多→少',
        birds_asc: '鸟种少→多',
      };
      chips.push({ key: 'sort', label: `排序：${sortLabels[sortFilter] || sortFilter}` });
    }
    return chips;
  }, [searchTerm, yearFilter, dateFilter, provinceFilter, cityFilter, habitatFilter, locationFilter, sortFilter]);

  // 生境图每页数量随视口列数变化（与已见鸟种一致）
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    let resizeTimer = null;
    const syncPageLimit = () => {
      const nextLimit = computeHabitatPageLimit(window.innerWidth);
      setHabitatPageLimit((prev) => (prev === nextLimit ? prev : nextLimit));
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

  // 首屏读取 URL 参数 + 视图 / 折叠偏好
  useEffect(() => {
    if (typeof window === 'undefined') return;
    setViewMode(readRecordsViewMode());
    setCardStyle(readCardStyle());
    setFilterPanelOpen(readRecordsFilterPanelOpen());
    const params = new URLSearchParams(window.location.search);
    const nextSearch = params.get('search') || '';
    const nextLocation = params.get('location') || '';
    const nextProvince = params.get('province') || '';
    const nextCity = params.get('city') || '';
    const nextHabitat = params.get('habitat') || '';
    const nextYear = params.get('year') || '';
    const nextDate = params.get('date') || '';
    const nextSort = params.get('sort') || 'date_desc';
    const nextScope = params.get('scope') || '';
    const nextPage = Number.parseInt(params.get('page') || '1', 10);

    if (nextSearch) {
      setSearchInput(nextSearch);
      setSearchTerm(nextSearch);
    }
    if (nextLocation) {
      setLocationInput(nextLocation);
      setLocationFilter(nextLocation);
    }
    if (nextProvince) {
      const meta = getProvinceByName(nextProvince);
      setProvinceFilter(meta?.name || nextProvince);
    }
    if (nextCity) setCityFilter(nextCity);
    if (HABITAT_FILTERS.some((item) => item.key === nextHabitat)) setHabitatFilter(nextHabitat);
    if (nextYear) {
      setYearFilter(nextYear);
      setDateFilter('');
    } else if (nextDate) {
      setDateFilter(nextDate);
      setYearFilter('');
    }
    if (['date_desc', 'date_asc', 'birds_desc', 'birds_asc'].includes(nextSort)) {
      setSortFilter(nextSort);
    }
    if (nextScope === 'all' || nextScope === 'mine') setScopeFilter(nextScope);
    if (Number.isFinite(nextPage) && nextPage > 1) setCurrentPage(nextPage);
    setUrlReady(true);
  }, []);

  // 搜索防抖。地点筛选只来自地图点选，不再单独输入。
  useEffect(() => {
    if (!urlReady) return undefined;
    const timer = setTimeout(() => {
      const next = searchInput.trim();
      setSearchTerm((prev) => {
        if (prev !== next) setCurrentPage(1);
        return next;
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput, urlReady]);

  useEffect(() => {
    if (!urlReady) return undefined;
    const timer = setTimeout(() => {
      const next = locationInput.trim();
      setLocationFilter((prev) => {
        if (prev !== next) setCurrentPage(1);
        return next;
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [locationInput, urlReady]);

  // 写回 URL，便于书签 / 分享
  useEffect(() => {
    if (!urlReady || typeof window === 'undefined') return;
    const params = new URLSearchParams();
    if (searchTerm.trim()) params.set('search', searchTerm.trim());
    if (locationFilter.trim()) params.set('location', locationFilter.trim());
    if (provinceFilter.trim()) params.set('province', provinceFilter.trim());
    if (cityFilter.trim()) params.set('city', cityFilter.trim());
    if (habitatFilter) params.set('habitat', habitatFilter);
    if (yearFilter) params.set('year', yearFilter);
    else if (dateFilter) params.set('date', dateFilter);
    if (sortFilter && sortFilter !== 'date_desc') params.set('sort', sortFilter);
    if (scopeFilter === 'all') params.set('scope', 'all');
    if (currentPage > 1) params.set('page', String(currentPage));
    const qs = params.toString();
    const nextUrl = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
    window.history.replaceState(null, '', nextUrl);
  }, [
    urlReady,
    searchTerm,
    locationFilter,
    provinceFilter,
    cityFilter,
    habitatFilter,
    yearFilter,
    dateFilter,
    sortFilter,
    scopeFilter,
    currentPage,
  ]);

  useEffect(() => {
    if (authLoading || !urlReady) return;
    fetchRecords();
    fetchPopularLocations();
  }, [
    authLoading,
    urlReady,
    currentPage,
    searchTerm,
    dateFilter,
    yearFilter,
    locationFilter,
    provinceFilter,
    cityFilter,
    habitatFilter,
    scopeFilter,
    sortFilter,
    currentUserId,
    viewMode,
    habitatPageLimit,
  ]);

  useEffect(() => {
    fetchRegionOptions();
  }, []);

  const provinceOptions = useMemo(() => (Array.isArray(regionOptions) ? regionOptions : []), [regionOptions]);

  const provinceCountByName = useMemo(() => {
    const map = new Map();
    provinceOptions.forEach((item) => {
      const key = normalizeRegionLabel(item.name);
      if (!key) return;
      map.set(key, Number(item.count) || 0);
    });
    return map;
  }, [provinceOptions]);

  const provinceBrowserItems = useMemo(
    () =>
      chinaProvinces.map((province) => ({
        ...province,
        count: provinceCountByName.get(normalizeRegionLabel(province.name)) || 0,
      })),
    [provinceCountByName]
  );

  const selectedProvinceMeta = useMemo(
    () => getProvinceByName(provinceFilter),
    [provinceFilter]
  );

  const cityOptions = useMemo(() => {
    if (!provinceFilter) return [];
    const code = getProvinceCodeByName(provinceFilter);
    const catalogCities = code ? getCitiesByProvince(code) : [];
    const apiProvince =
      provinceOptions.find((item) => regionNamesMatch(item.name, provinceFilter)) || null;
    const apiCities = Array.isArray(apiProvince?.cities) ? apiProvince.cities : [];

    const byName = new Map();

    const upsert = (cityName, cityCode, count) => {
      const name = String(cityName || '').trim();
      if (!name) return;
      const existing = byName.get(name);
      if (existing) {
        existing.count = Math.max(Number(existing.count) || 0, Number(count) || 0);
        if (!existing.code && cityCode) existing.code = cityCode;
        return;
      }
      byName.set(name, {
        name,
        code: cityCode || '',
        count: Number(count) || 0,
      });
    };

    catalogCities.forEach((city) => {
      const hit = apiCities.find((item) => regionNamesMatch(item.name, city.name));
      upsert(city.name, city.code, hit?.count || 0);
    });

    apiCities.forEach((item) => {
      const matched = [...byName.values()].find((city) => regionNamesMatch(city.name, item.name));
      if (matched) {
        matched.count = Math.max(Number(matched.count) || 0, Number(item.count) || 0);
        return;
      }
      upsert(item.name, '', item.count || 0);
    });

    return Array.from(byName.values());
  }, [provinceOptions, provinceFilter]);

  const mapView = useMemo(
    () => getRegionViewCenter(provinceFilter, cityFilter),
    [provinceFilter, cityFilter]
  );

  const handleProvincePick = (provinceName) => {
    const meta = getProvinceByName(provinceName);
    const next = meta?.name || String(provinceName || '').trim();
    if (!next) return;
    setProvinceFilter(next);
    setCityFilter('');
    setLocationInput('');
    setLocationFilter('');
    setCurrentPage(1);
  };

  const handleCityPick = (cityName) => {
    const next = String(cityName || '').trim();
    if (!next) return;
    setCityFilter(next);
    setLocationInput('');
    setLocationFilter('');
    setCurrentPage(1);
  };

  const clearRegionDrilldown = () => {
    setProvinceFilter('');
    setCityFilter('');
    setLocationInput('');
    setLocationFilter('');
    setCurrentPage(1);
  };

  const handleMapLocationPick = (location) => {
    const name = String(location?.name || '').trim();
    if (!name) return;
    setLocationInput(name);
    setLocationFilter(name);
    if (location?.province) {
      const meta = getProvinceByName(location.province);
      setProvinceFilter(meta?.name || location.province);
      if (location?.city) setCityFilter(location.city);
      else setCityFilter('');
    }
    setCurrentPage(1);
  };

  const removeFilterChip = (key) => {
    if (key === 'search') {
      setSearchInput('');
      setSearchTerm('');
    } else if (key === 'year') {
      setYearFilter('');
    } else if (key === 'date') {
      setDateFilter('');
    } else if (key === 'province') {
      setProvinceFilter('');
      setCityFilter('');
    } else if (key === 'city') {
      setCityFilter('');
    } else if (key === 'habitat') {
      setHabitatFilter('');
    } else if (key === 'location') {
      setLocationInput('');
      setLocationFilter('');
    } else if (key === 'sort') {
      setSortFilter('date_desc');
    }
    setCurrentPage(1);
  };

  const fetchRecords = async () => {
    try {
      setLoading(true);
      setErrors([]);
      const pageLimit = habitatPageLimit;
      const params = { page: currentPage, limit: pageLimit, sort: sortFilter };
      const mapParams = {};

      if (showingMineOnly && currentUserId) {
        params.observer = String(currentUserId);
        mapParams.observer = String(currentUserId);
      }
      if (searchTerm.trim()) {
        params.search = searchTerm.trim();
        mapParams.search = searchTerm.trim();
      }
      if (yearFilter) {
        params.year = yearFilter;
        mapParams.year = yearFilter;
      } else if (dateFilter) {
        params.date = dateFilter;
        mapParams.date = dateFilter;
      }
      if (locationFilter.trim()) {
        params.location = locationFilter.trim();
        mapParams.location = locationFilter.trim();
      }
      if (provinceFilter.trim()) {
        params.province = provinceFilter.trim();
        mapParams.province = provinceFilter.trim();
      }
      if (cityFilter.trim()) {
        params.city = cityFilter.trim();
        mapParams.city = cityFilter.trim();
      }
      if (habitatFilter) {
        params.habitat = habitatFilter;
        mapParams.habitat = habitatFilter;
      }

      const data = await api.records.getAll(params);
      if (data.success) {
        setRecords(Array.isArray(data.data) ? data.data : []);
        setPagination(data.pagination || null);
        const speciesCount = Number(data.uniqueSpecies);
        setUniqueSpeciesCount(Number.isFinite(speciesCount) ? speciesCount : 0);
      } else {
        setErrors([data.message || '获取记录失败']);
      }

      if (viewMode === 'map') {
        try {
          const mapRes = await api.records.getMapPoints(mapParams);
          if (mapRes?.success && Array.isArray(mapRes.data)) {
            setMapLocations(
              mapRes.data.map((p) => ({
                name: p.name,
                lat: Number(p.lat),
                lng: Number(p.lng),
                records: Number(p.records) || 0,
                birds: Number(p.birds) || 0,
                province: p.province || '',
                city: p.city || '',
              }))
            );
          } else {
            setMapLocations([]);
          }
        } catch {
          setMapLocations([]);
        }
      }
    } catch (error) {
      console.error('获取记录失败:', error);
      setErrors([error?.message || '获取记录失败']);
      setMapLocations([]);
    } finally {
      setLoading(false);
    }
  };

  const locationCoverMap = useMemo(() => {
    const map = new Map();
    popularLocations.forEach((loc) => {
      const name = String(loc?.name || '').trim();
      const url = Array.isArray(loc?.images) && loc.images[0]?.url ? loc.images[0].url : '';
      if (name && url) map.set(name, url);
    });
    return map;
  }, [popularLocations]);

  const handleViewModeChange = (mode) => {
    const next = mode === 'map' ? 'map' : 'habitat';
    if (next === viewMode) return;
    setViewMode(next);
    writeRecordsViewMode(next);
    setCurrentPage(1);
    if (next === 'map') {
      writeFoldOpen(RECORDS_MAP_TOOLBOX_KEY, true);
      setMapToolboxOpen(true);
    }
  };

  const handleCardStyleChange = (style) => {
    const next = style === 'scrap' ? 'scrap' : 'field';
    if (next === cardStyle) return;
    setCardStyle(next);
    writeCardStyle(next);
  };

  // 已选省市时自动展开筛选面板，避免城市芯片被藏住
  useEffect(() => {
    if (viewMode === 'map') return;
    if (!provinceFilter && !cityFilter) return;
    setFilterPanelOpen((prev) => {
      if (prev) return prev;
      writeFoldOpen(RECORDS_FILTER_PANEL_KEY, true);
      return true;
    });
  }, [provinceFilter, cityFilter, viewMode, setFilterPanelOpen]);

  // 勾选记录后展开筛选（含批量操作），便于导出/删除
  useEffect(() => {
    if (selectedIds.length === 0) return;
    if (viewMode === 'map') {
      setMapToolboxOpen((prev) => {
        if (prev) return prev;
        writeFoldOpen(RECORDS_MAP_TOOLBOX_KEY, true);
        return true;
      });
      return;
    }
    setFilterPanelOpen((prev) => {
      if (prev) return prev;
      writeFoldOpen(RECORDS_FILTER_PANEL_KEY, true);
      return true;
    });
  }, [selectedIds.length, viewMode, setFilterPanelOpen, setMapToolboxOpen]);

  // 离开「只看我的」时退出勾选模式
  useEffect(() => {
    if (showingMineOnly) return;
    setSelectionMode(false);
    setSelectedIds([]);
  }, [showingMineOnly]);

  const filterPanelSummary = useMemo(() => {
    const parts = [];
    if (selectedIds.length > 0) parts.push(`已选 ${selectedIds.length} 条`);
    if (searchTerm.trim()) parts.push(`搜索「${searchTerm.trim()}」`);
    if (provinceFilter) {
      parts.push(
        `${normalizeRegionLabel(provinceFilter) || provinceFilter}${
          cityFilter ? ` · ${String(cityFilter).replace(/市$/, '')}` : ''
        }`
      );
    }
    if (habitatFilter) {
      const habitatLabel = HABITAT_FILTERS.find((item) => item.key === habitatFilter)?.label;
      if (habitatLabel) parts.push(habitatLabel);
    }
    if (activeFilterChips.length > 0) parts.push(`已设 ${activeFilterChips.length} 项`);
    else if (sortFilter === 'date_desc') parts.push('日期新→旧');
    else parts.push('已调整排序');
    if (showingMineOnly) parts.push('仅我的');
    else if (currentUserId) parts.push('本机全部');
    return parts.join(' · ');
  }, [
    selectedIds.length,
    searchTerm,
    provinceFilter,
    cityFilter,
    habitatFilter,
    activeFilterChips.length,
    sortFilter,
    showingMineOnly,
    currentUserId,
  ]);

  const mapFoldSummary = useMemo(() => {
    const place =
      mapLocations.length > 0 ? `${mapLocations.length} 个地点` : '地图与常用地点';
    return filterPanelSummary ? `${place} · ${filterPanelSummary}` : place;
  }, [mapLocations.length, filterPanelSummary]);

  const fetchPopularLocations = async () => {
    try {
      const data = await api.locations.getPopular(24);
      if (data.success && Array.isArray(data.data)) setPopularLocations(data.data);
      else setPopularLocations([]);
    } catch (error) {
      console.error('获取热门地点失败:', error);
    }
  };

  async function fetchRegionOptions() {
    try {
      const data = await api.records.getLocationOptions();
      if (data.success && Array.isArray(data.data)) setRegionOptions(data.data);
      else setRegionOptions([]);
    } catch (error) {
      console.error('获取省市筛选选项失败:', error);
      setRegionOptions([]);
    }
  }

  const clearFilters = () => {
    setSearchInput('');
    setSearchTerm('');
    setDateFilter('');
    setYearFilter('');
    setLocationInput('');
    setLocationFilter('');
    setProvinceFilter('');
    setCityFilter('');
    setHabitatFilter('');
    setSortFilter('date_desc');
    setCurrentPage(1);
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  useEffect(() => {
    setSelectedIds([]);
  }, [currentPage, searchTerm, dateFilter, yearFilter, locationFilter, provinceFilter, cityFilter, habitatFilter, scopeFilter, sortFilter]);

  const toggleSelectOne = (id) => {
    const key = String(id);
    setSelectedIds((prev) => (prev.includes(key) ? prev.filter((x) => x !== key) : [...prev, key]));
  };

  const toggleSelectAllCurrent = () => {
    if (allCurrentSelected) {
      setSelectedIds([]);
      return;
    }
    setSelectedIds(records.map((r) => String(r._id)));
  };

  const handleBatchExport = () => {
    const picked = records.filter((r) => selectedIdSet.has(String(r._id)));
    if (picked.length === 0) {
      addError('请先勾选要导出的记录');
      return;
    }
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      app: 'KBird',
      source: 'records-batch',
      records: picked,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kbird-records-selected-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleFormatExport = async (format) => {
    if (selectedIds.length === 0) {
      addError('请先勾选要导出的记录');
      return;
    }
    setExportBusy(true);
    try {
      const result = await downloadPersonalRecordsExport(format, { recordIds: selectedIds });
      const label = format === 'cbrc' ? '中国鸟类记录中心 XLSX' : 'eBird CSV';
      addError(
        `已导出 ${label}${result.count ? `（${result.count} 条记录）` : ''}`,
        'success'
      );
    } catch (error) {
      addError(error.message || '导出失败');
    } finally {
      setExportBusy(false);
    }
  };

  const handleBatchDeleteRequest = () => {
    if (selectedIds.length === 0) {
      addError('请先勾选要删除的记录');
      return;
    }
    setDeleteConfirm({
      mode: 'batch',
      recordIds: selectedIds,
      message: `确认删除选中的 ${selectedIds.length} 条记录？此操作不可撤销。`,
    });
  };

  useEffect(() => {
    if (!deleteConfirm) return undefined;

    deletePreviousFocusRef.current =
      typeof document !== 'undefined' ? document.activeElement : null;

    const focusTimer = window.setTimeout(() => {
      deleteCancelRef.current?.focus?.();
    }, 0);

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setDeleteConfirm(null);
        return;
      }
      if (event.key !== 'Tab' || !deleteDialogRef.current) return;

      const focusable = deleteDialogRef.current.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', onKeyDown);
      const prev = deletePreviousFocusRef.current;
      if (prev && typeof prev.focus === 'function') {
        try {
          prev.focus();
        } catch {
          // ignore
        }
      }
    };
  }, [deleteConfirm]);

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm) return;
    const confirmPayload = deleteConfirm;
    setDeleteConfirm(null);

    if (confirmPayload.mode === 'batch') {
      setBatchBusy(true);
      let ok = 0;
      let fail = 0;
      try {
        for (const recordId of confirmPayload.recordIds || []) {
          try {
            const data = await api.records.delete(recordId);
            if (data.success) ok += 1;
            else fail += 1;
          } catch {
            fail += 1;
          }
        }
        addError(`批量删除完成：成功 ${ok}，失败 ${fail}`, fail ? 'error' : 'success');
        setSelectedIds([]);
        fetchRecords();
        fetchPopularLocations();
      } finally {
        setBatchBusy(false);
      }
      return;
    }

    const { recordId } = confirmPayload;
    try {
      const data = await api.records.delete(recordId);
      if (data.success) {
        addError('观鸟记录删除成功', 'success');
        fetchRecords();
        fetchPopularLocations();
      } else {
        addError('删除失败：' + (data.message || '未知错误'));
      }
    } catch (error) {
      console.error('删除观鸟记录失败:', error);
      addError('删除失败，请重试');
    }
  };

  const openImageViewer = (images, index = 0) => {
    setCurrentImages(images);
    setCurrentImageIndex(index);
    setImageViewerOpen(true);
  };

  const closeImageViewer = () => {
    setImageViewerOpen(false);
    setCurrentImages([]);
    setCurrentImageIndex(0);
  };

  return (
    <div className={styles.container}>
      <Navbar />

      {apiErrors.map((error) => (
        <ErrorMessage
          key={error.id}
          error={error.message}
          type={error.type}
          onClose={() => removeError(error.id)}
        />
      ))}

      {deleteConfirm ? (
        <div
          className={styles.modalOverlay}
          onClick={() => setDeleteConfirm(null)}
          role="presentation"
        >
          <div
            ref={deleteDialogRef}
            className={styles.modalContent}
            role="dialog"
            aria-modal="true"
            aria-labelledby="records-delete-dialog-title"
            aria-describedby="records-delete-dialog-desc"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="records-delete-dialog-title">确认删除</h3>
            <p id="records-delete-dialog-desc">{deleteConfirm.message}</p>
            <div className={styles.modalActions}>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                className={styles.confirmButton}
              >
                {deleteConfirm.mode === 'batch' ? '确认批量删除' : '确认删除'}
              </button>
              <button
                ref={deleteCancelRef}
                type="button"
                onClick={() => setDeleteConfirm(null)}
                className={styles.cancelButton}
              >
                取消
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <main className={styles.main}>
        <SimplePageHeader
          title="观察记录"
          description={
            viewMode === 'map'
              ? '左侧地图，右侧省市与常用点；筛选在上方折叠面板。'
              : coverSet === 'photo'
                ? '有照片用照片；没有则用代表性鸟类画风图。'
                : '封面用代表性鸟类画风：猛禽、飞禽、鸣禽、水鸟、涉鸟、林鸟。'
          }
          descriptionVariant="caption"
          actions={
            <div className="kb-view-seg" role="tablist" aria-label="记录浏览方式">
              <button
                type="button"
                role="tab"
                aria-selected={viewMode === 'habitat'}
                className={`kb-view-tab${viewMode === 'habitat' ? ' is-active' : ''}`}
                onClick={() => handleViewModeChange('habitat')}
              >
                生境
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={viewMode === 'map'}
                className={`kb-view-tab${viewMode === 'map' ? ' is-active' : ''}`}
                onClick={() => handleViewModeChange('map')}
              >
                地图
              </button>
            </div>
          }
        />

        <div className={styles.filtersContainer}>
          <FoldFilterPanel
            className={styles.foldPanel}
            storageKey={viewMode === 'map' ? RECORDS_MAP_TOOLBOX_KEY : RECORDS_FILTER_PANEL_KEY}
            open={viewMode === 'map' ? mapToolboxOpen : filterPanelOpen}
            onOpenChange={viewMode === 'map' ? setMapToolboxOpen : setFilterPanelOpen}
            title="筛选"
            summary={viewMode === 'map' ? mapFoldSummary : filterPanelSummary}
          >
                <div className={styles.searchBox}>
                  <input
                    type="text"
                    placeholder="鸟种（中文/拼音/首字母/学名/英文）、地点、标题或备注…"
                    value={searchInput}
                    onChange={(event) => setSearchInput(event.target.value)}
                    className={styles.searchInput}
                    aria-label="搜索记录"
                  />
                </div>

                <p className={styles.filterSectionLabel}>筛选与排序</p>
                <div className={styles.filters}>
                  {currentUserId ? (
                    <select
                      value={scopeFilter}
                      onChange={(event) => {
                        setScopeFilter(event.target.value);
                        setCurrentPage(1);
                      }}
                      className={styles.filterSelect}
                      aria-label="记录范围"
                    >
                      <option value="mine">只看我的</option>
                      <option value="all">本机全部</option>
                    </select>
                  ) : null}
                  <select
                    value={dateFilter}
                    onChange={(event) => {
                      const v = event.target.value;
                      setDateFilter(v);
                      if (v) setYearFilter('');
                      setCurrentPage(1);
                    }}
                    className={styles.filterSelect}
                    disabled={!!yearFilter}
                  >
                    <option value="">全部日期</option>
                    <option value="today">今天</option>
                    <option value="thisWeek">本周</option>
                    <option value="thisMonth">本月</option>
                  </select>

                  <select
                    value={yearFilter}
                    onChange={(event) => {
                      const v = event.target.value;
                      setYearFilter(v);
                      if (v) setDateFilter('');
                      setCurrentPage(1);
                    }}
                    className={styles.filterSelect}
                    disabled={!!dateFilter}
                    aria-label="按年份筛选"
                  >
                    <option value="">全部年份</option>
                    {Array.from({ length: 20 }, (_, i) => {
                      const y = new Date().getFullYear() - i;
                      return (
                        <option key={y} value={String(y)}>
                          {y} 年
                        </option>
                      );
                    })}
                  </select>

                  {viewMode === 'habitat' ? (
                    <select
                      value={habitatFilter}
                      onChange={(event) => {
                        setHabitatFilter(event.target.value);
                        setCurrentPage(1);
                      }}
                      className={styles.filterSelect}
                      aria-label="按生境筛选"
                    >
                      <option value="">全部生境</option>
                      {HABITAT_FILTERS.map((habitat) => (
                        <option key={habitat.key} value={habitat.key}>
                          {habitat.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <>
                      <select
                        value={provinceFilter}
                        onChange={(event) => {
                          const nextProvince = event.target.value;
                          if (!nextProvince) {
                            clearRegionDrilldown();
                            return;
                          }
                          handleProvincePick(nextProvince);
                        }}
                        className={styles.filterSelect}
                        aria-label="按省份筛选"
                      >
                        <option value="">全部省份</option>
                        {provinceBrowserItems.map((province) => (
                          <option key={province.code} value={province.name}>
                            {province.name}
                            {province.count > 0 ? `（${province.count}）` : ''}
                          </option>
                        ))}
                      </select>

                      <select
                        value={cityFilter}
                        onChange={(event) => {
                          const nextCity = event.target.value;
                          if (!nextCity) {
                            setCityFilter('');
                            setLocationInput('');
                            setLocationFilter('');
                            setCurrentPage(1);
                            return;
                          }
                          handleCityPick(nextCity);
                        }}
                        className={styles.filterSelect}
                        disabled={!provinceFilter}
                        aria-label="按城市筛选"
                      >
                        <option value="">{provinceFilter ? '全部城市 / 全省' : '先选择省份'}</option>
                        {cityOptions.map((city, index) => (
                          <option key={`${provinceFilter}-${city.code || city.name}-${index}`} value={city.name}>
                            {city.name}
                            {city.count > 0 ? `（${city.count}）` : ''}
                          </option>
                        ))}
                      </select>
                    </>
                  )}

                  <select
                    value={sortFilter}
                    onChange={(event) => {
                      setSortFilter(event.target.value);
                      setCurrentPage(1);
                    }}
                    className={styles.filterSelect}
                    aria-label="排序"
                  >
                    <option value="date_desc">日期新→旧</option>
                    <option value="date_asc">日期旧→新</option>
                    <option value="birds_desc">鸟种多→少</option>
                    <option value="birds_asc">鸟种少→多</option>
                  </select>

                  <button onClick={clearFilters} className={styles.clearButton} type="button">
                    清除筛选
                  </button>
                </div>

                {activeFilterChips.length > 0 ? (
                  <div className={styles.filterChips} aria-label="当前筛选">
                    {activeFilterChips.map((chip) => (
                      <button
                        key={chip.key}
                        type="button"
                        className={styles.filterChip}
                        onClick={() => removeFilterChip(chip.key)}
                        title="点击清除该项"
                      >
                        <span>{chip.label}</span>
                        <span className={styles.filterChipClose} aria-hidden="true">
                          ×
                        </span>
                      </button>
                    ))}
                  </div>
                ) : null}

                {showingMineOnly ? (
                  <div className={styles.filterSectionBlock} aria-label="记录操作">
                    <p className={styles.filterSectionLabel}>记录操作</p>
                    <div className={styles.batchBarInner}>
                      {selectionMode ? (
                        <label className={styles.batchSelectAll}>
                          <input
                            type="checkbox"
                            checked={allCurrentSelected}
                            onChange={toggleSelectAllCurrent}
                            disabled={batchBusy}
                          />
                          本页全选（已选 {selectedIds.length}）
                        </label>
                      ) : (
                        <span className={styles.batchHint}>点「编辑记录」后可勾选卡片，再导出或删除</span>
                      )}
                      <div className={styles.batchActions}>
                        <button
                          type="button"
                          className={`${styles.batchEditButton} ${selectionMode ? styles.batchEditButtonActive : ''}`}
                          onClick={toggleSelectionMode}
                          disabled={batchBusy}
                          aria-pressed={selectionMode}
                        >
                          {selectionMode ? '完成编辑' : '编辑记录'}
                        </button>
                        <button
                          type="button"
                          className={styles.batchExportButton}
                          onClick={handleBatchExport}
                          disabled={!selectionMode || batchBusy || exportBusy || selectedIds.length === 0}
                        >
                          导出 JSON
                        </button>
                        <button
                          type="button"
                          className={styles.batchExportButton}
                          onClick={() => handleFormatExport('cbrc')}
                          disabled={!selectionMode || batchBusy || exportBusy || selectedIds.length === 0}
                          title="导出为中国鸟类记录中心报告表格式，可再导入或对照填写"
                        >
                          {exportBusy ? '导出中…' : '导出 CBRC'}
                        </button>
                        <button
                          type="button"
                          className={styles.batchExportButton}
                          onClick={() => handleFormatExport('ebird')}
                          disabled={!selectionMode || batchBusy || exportBusy || selectedIds.length === 0}
                          title="导出为 eBird Record Format CSV，便于导入 eBird"
                        >
                          导出 eBird
                        </button>
                        <button
                          type="button"
                          className={styles.batchDeleteButton}
                          onClick={handleBatchDeleteRequest}
                          disabled={!selectionMode || batchBusy || selectedIds.length === 0}
                        >
                          删除选中
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}
          </FoldFilterPanel>
        </div>

        {viewMode === 'map' ? (
          <section className={styles.mapBrowse} aria-label="记录地图与区域">
            <div className={styles.mapBrowseMap}>
              <BirdMapProvider
                key={`records-map-${provinceFilter || 'all'}-${cityFilter || 'all'}`}
                locations={mapLocations}
                center={{ lat: mapView.lat, lng: mapView.lng }}
                zoom={mapView.zoom}
                fitMode={provinceFilter || cityFilter ? 'center' : 'auto'}
                height="100%"
                maxBounds={[
                  [17.5, 73.0],
                  [54.5, 136.0],
                ]}
                onMarkerClick={handleMapLocationPick}
              />
            </div>
            <aside className={styles.mapBrowseSide} aria-label="行政区与常用点">
              <div className={styles.regionBrowser}>
                {provinceFilter ? (
                  <>
                    <div className={styles.regionBrowserToolbar}>
                      <button
                        type="button"
                        className={styles.regionBackButton}
                        onClick={clearRegionDrilldown}
                      >
                        ← 全部省市
                      </button>
                      <span className={styles.regionBrowserTitle}>
                        {selectedProvinceMeta?.name || provinceFilter}
                        <em>
                          {cityOptions.length} 个地级区域
                          {provinceCountByName.get(normalizeRegionLabel(provinceFilter))
                            ? ` · ${provinceCountByName.get(normalizeRegionLabel(provinceFilter))} 条记录`
                            : ''}
                        </em>
                      </span>
                    </div>
                    <div className={styles.regionChipGrid}>
                      <button
                        type="button"
                        className={`${styles.regionChip} ${!cityFilter ? styles.regionChipActive : ''}`}
                        onClick={() => {
                          setCityFilter('');
                          setLocationInput('');
                          setLocationFilter('');
                          setCurrentPage(1);
                        }}
                      >
                        全省
                      </button>
                      {cityOptions.map((city, index) => (
                        <button
                          key={`${provinceFilter}-${city.code || city.name}-${index}`}
                          type="button"
                          className={`${styles.regionChip} ${
                            cityFilter === city.name ? styles.regionChipActive : ''
                          } ${city.count > 0 ? styles.regionChipHasData : ''}`}
                          onClick={() => handleCityPick(city.name)}
                          title={city.count > 0 ? `${city.count} 条记录` : '暂无记录'}
                        >
                          <span>{city.name.replace(/市$/, '')}</span>
                          {city.count > 0 ? (
                            <span className={styles.regionChipCount}>{city.count}</span>
                          ) : null}
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className={styles.regionChipGrid}>
                    {provinceBrowserItems.map((province) => (
                      <button
                        key={province.code}
                        type="button"
                        className={`${styles.regionChip} ${
                          province.count > 0 ? styles.regionChipHasData : ''
                        }`}
                        onClick={() => handleProvincePick(province.name)}
                        title={province.count > 0 ? `${province.count} 条记录` : '暂无记录'}
                      >
                        <span>{normalizeRegionLabel(province.name) || province.name}</span>
                        {province.count > 0 ? (
                          <span className={styles.regionChipCount}>{province.count}</span>
                        ) : null}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className={styles.mapBrowseSpots}>
                <p className={styles.filterSectionLabel}>常用观鸟点</p>
                {popularLocations.length > 0 ? (
                  <div
                    className={`${styles.regionChipGrid} ${styles.spotChipGrid}`}
                    aria-label="常用观鸟点"
                  >
                    {popularLocations.map((location, index) => {
                      const name = String(location.name || '').trim();
                      const key = location._id ? location._id : `popular-${index}-${name}`;
                      const active = locationFilter.trim() === name;
                      const records =
                        location.stats?.totalRecords ?? location.recordCount ?? 0;
                      return (
                        <button
                          key={key}
                          type="button"
                          className={`${styles.regionChip} ${
                            active ? styles.regionChipActive : ''
                          } ${records > 0 ? styles.regionChipHasData : ''}`}
                          onClick={() =>
                            handleMapLocationPick({
                              name,
                              province:
                                location.address?.province || location.province || '',
                              city: location.address?.city || location.city || '',
                            })
                          }
                        >
                          <span>{name}</span>
                          {records > 0 ? (
                            <span className={styles.regionChipCount}>{records}</span>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className={styles.mapToolboxEmpty}>暂无常用地点</p>
                )}
              </div>
            </aside>
          </section>
        ) : null}

        {errors.length > 0 ? (
          <PageState
            type="error"
            title="观察记录加载失败"
            message={errors[0]}
            actionLabel="重试"
            onAction={fetchRecords}
          />
        ) : null}

        <div className={styles.recordsSection}>
          {loading ? (
            <PageState type="loading" title="观察记录加载中..." />
          ) : records.length === 0 ? (
            <PageState
              type="empty"
              title={showingMineOnly ? '还没有你的记录' : '暂无观察记录'}
              message={
                showingMineOnly
                  ? '记一笔，或导入记录中心表格；清单与统计会随之更新。'
                  : '本机还没有观察记录。可记一笔，或导入中国鸟类记录中心表格。'
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
              <div className={styles.listMeta}>
                <div className={styles.listMetaLead}>
                <span className={styles.listMetaCount}>
                  {pagination?.totalItems ?? records.length} 条
                  {uniqueSpeciesCount > 0 ? (
                    <span className={styles.listMetaMuted}> · {uniqueSpeciesCount} 种</span>
                  ) : null}
                  {selectedIds.length > 0 ? (
                    <span className={styles.listMetaMuted}> · 已选 {selectedIds.length}</span>
                  ) : null}
                </span>
                {pagination && pagination.totalPages > 1 ? (
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
                      {currentPage}/{pagination.totalPages}
                    </span>
                    <button
                      type="button"
                      className="kb-view-tab kb-meta-tab"
                      aria-label="下一页"
                      disabled={currentPage >= pagination.totalPages}
                      onClick={() => handlePageChange(currentPage + 1)}
                    >
                      →
                    </button>
                  </div>
                ) : null}
                </div>
                <div className={styles.listMetaTools}>
                <div className="kb-view-seg kb-meta-seg" role="group" aria-label="封面风格">
                  <span className="kb-meta-label">封面</span>
                  {RECORD_COVER_MODES.map((set) => (
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
                </div>
              </div>
              <div className={`${styles.habitatGrid}${cardStyle === 'scrap' ? ` ${styles.habitatGridScrap}` : ''}`}>
                {(() => {
                  const habitatUsedUrls = new Set();
                  return records.map((record) => {
                  const cover = resolveRecordCover(record, locationCoverMap, {
                    usedUrls: habitatUsedUrls,
                    coverSet,
                  });
                  const locationName = String(record.location?.name || '').trim() || '未命名地点';
                  const birdCount = Array.isArray(record.birds) ? record.birds.length : 0;
                  const highlightBirds = getDisplayedBirds(record.birds, 2);
                  const dateText = record.date ? formatDisplayDate(record.date, 'short') : '日期未知';
                  const speciesLine = highlightBirds
                    .map((bird) => bird?.birdId?.name || bird?.birdId || '')
                    .filter(Boolean)
                    .join(' · ');
                  const speciesText = speciesLine
                    ? `${speciesLine}${birdCount > highlightBirds.length ? ` · +${birdCount - highlightBirds.length}` : ''}`
                    : '';
                  const scrap = cardStyle === 'scrap';
                  return (
                    <article
                      key={record._id}
                      className={`${styles.habitatCard}${scrap ? ` ${styles.habitatCardScrap}` : ''}`}
                    >
                      {canSelectRecords ? (
                        <label className={styles.habitatCheck}>
                          <input
                            type="checkbox"
                            checked={selectedIdSet.has(String(record._id))}
                            onChange={() => toggleSelectOne(record._id)}
                            disabled={batchBusy}
                            aria-label={`选择记录 ${record.title || record._id}`}
                          />
                        </label>
                      ) : null}
                      <Link href={`/records/${record._id}`} className={styles.habitatCardLink}>
                        {scrap ? (
                          <div className={styles.scrapSheet}>
                            <div className={styles.scrapPanel}>
                              <span className={styles.scrapTape} aria-hidden="true" />
                              <div className={styles.scrapPhoto}>
                                <Image
                                  src={cover.url}
                                  alt=""
                                  fill
                                  sizes="(max-width: 900px) 100vw, 33vw"
                                  unoptimized
                                  className={styles.habitatImage}
                                />
                              </div>
                            </div>
                            <div className={styles.scrapNote}>
                              <h3 className={styles.scrapTitle}>{locationName}</h3>
                              <p className={styles.scrapMeta}>
                                <span className={styles.scrapStamp}>{dateText}</span>
                                <span>{birdCount} 种</span>
                              </p>
                              {speciesText ? (
                                <div className={styles.scrapBubbleWrap}>
                                  <p className={styles.scrapBubble}>{speciesText}</p>
                                </div>
                              ) : null}
                            </div>
                          </div>
                        ) : (
                          <div className={styles.habitatMedia}>
                            <Image
                              src={cover.url}
                              alt=""
                              fill
                              sizes="(max-width: 900px) 100vw, 33vw"
                              unoptimized
                              className={styles.habitatImage}
                            />
                            <div className={styles.habitatShade} aria-hidden="true" />
                            {!cover.isIllustration && cover.source === 'location' ? (
                              <span className={styles.habitatBadge}>地点封面</span>
                            ) : null}
                            <div className={styles.habitatOverlay}>
                              <h3 className={styles.habitatTitle}>{locationName}</h3>
                              <p className={styles.habitatMeta}>
                                <span>{dateText}</span>
                                <span>·</span>
                                <span>{birdCount} 种</span>
                              </p>
                              {speciesText ? <p className={styles.habitatSpecies}>{speciesText}</p> : null}
                            </div>
                          </div>
                        )}
                      </Link>
                    </article>
                  );
              });
                })()}
            </div>
            </>
          )}
        </div>

      </main>

      <Footer />

      {imageViewerOpen ? (
        <ImageViewer images={currentImages} currentIndex={currentImageIndex} onClose={closeImageViewer} />
      ) : null}
    </div>
  );
}
