'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import SimplePageHeader, {
  HeaderPrimaryButton,
  HeaderSecondaryButton,
  HeaderSecondaryLink,
} from '@/components/SimplePageHeader';
import PageState from '@/components/PageState';
import FormModal from '@/components/FormModal';
import { useConfirmDialog } from '@/components/ConfirmDialog';
import { useAuth } from '@/components/AuthProvider';
import { api } from '@/utils/api';
import {
  orderDisplayName,
  orderGroupKey,
  orderLatinSubtitle,
} from '@/utils/taxonomyOrderUi';
import {
  provinces,
  getCitiesByProvince,
  getProvinceCodeByName,
  getCityCodeByName,
} from '@/data/chinaRegions';
import {
  MAX_SPECIES_LIST_UPLOAD_FILES,
  mergeSpeciesLists,
  parseSpeciesListFile,
} from '@/utils/cbrcSpeciesListParser';
import LocationAutocomplete from '@/components/LocationAutocomplete';
import SpeciesHoverChip from '@/components/SpeciesHoverChip';
import BirdSearchField from '@/components/BirdSearchField';
import SpeciesLedgerBrowse from '@/components/SpeciesLedgerBrowse';
import { speciesMatchesSearch } from '@/utils/clientPinyinMatch';
import { canonicalizeBirdName } from '@/utils/canonicalizeBirdName';
import { BIRD_SEARCH_PLACEHOLDER_TAXON } from '@/utils/birdSearchUi';
import styles from '@/styles/RegionBirdLists.module.css';

function formatVersionLabel(year, month) {
  const y = Number(year);
  const m = Number(month);
  if (Number.isFinite(y) && Number.isFinite(m) && m >= 1 && m <= 12) {
    return `${y}年${m}月版本`;
  }
  if (Number.isFinite(y)) return `${y}年版本`;
  return '';
}

function normalizeNameKey(value) {
  return canonicalizeBirdName(String(value || '').trim()).replace(/\s+/g, '');
}

function normalizeSciKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function sciBinomialKey(value) {
  const parts = normalizeSciKey(value).split(' ').filter(Boolean);
  if (parts.length >= 2) return `${parts[0]} ${parts[1]}`;
  return parts[0] || '';
}

export default function RegionBirdListDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params?.id;
  const { user } = useAuth();
  const { ask, dialog: confirmDialog } = useConfirmDialog();
  const publishFileRef = useRef(null);
  const [data, setData] = useState(null);
  const [allSpecies, setAllSpecies] = useState([]);
  const [observedKeys, setObservedKeys] = useState(() => new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [order, setOrder] = useState('');
  const [family, setFamily] = useState('');
  const [sortBy, setSortBy] = useState('recordCount');
  const [sortOrder, setSortOrder] = useState('desc');
  const [summaryFilter, setSummaryFilter] = useState('all'); // all | unseen | seen
  const [summarySearch, setSummarySearch] = useState('');
  const [showEdit, setShowEdit] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [showPublish, setShowPublish] = useState(false);
  const [publishBusy, setPublishBusy] = useState(false);
  const [publishError, setPublishError] = useState('');
  const [publishPreview, setPublishPreview] = useState(null);
  const [expandedHistoryId, setExpandedHistoryId] = useState('');
  const [catalogBusy, setCatalogBusy] = useState(false);
  const [catalogError, setCatalogError] = useState('');
  const [showCatalogModal, setShowCatalogModal] = useState(false);
  const [catalogForm, setCatalogForm] = useState({
    speciesIndex: -1,
    name: '',
    scientificName: '',
    englishName: '',
    order: '',
    family: '',
    description: '',
    habitat: '',
    distribution: '',
  });
  const [publishForm, setPublishForm] = useState({
    year: String(new Date().getFullYear()),
    versionMonth: String(new Date().getMonth() + 1),
    filename: '',
    species: [],
    fileEntries: [],
    mergeHits: 0,
  });
  const [editForm, setEditForm] = useState({
    regionName: '',
    title: '',
    provinceCode: '',
    cityCode: '',
    district: '',
    spot: '',
    locationId: '',
    year: '',
    versionMonth: '',
  });

  const editCityOptions = useMemo(
    () => getCitiesByProvince(editForm.provinceCode),
    [editForm.provinceCode]
  );

  const versionHistory = useMemo(
    () => (Array.isArray(data?.versionHistory) ? data.versionHistory : []),
    [data?.versionHistory]
  );

  const canEdit = Boolean(
    user &&
      data &&
      (user.role === 'admin' ||
        String(data.uploadedBy?._id || data.uploadedBy) === String(user._id))
  );

  const fetchDetail = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const result = await api.regionLists.getById(id, {
        sortBy: 'recordCount',
        sortOrder: 'desc',
      });
      if (result.success) {
        setData(result.data);
        setAllSpecies(Array.isArray(result.data?.species) ? result.data.species : []);
      } else {
        setError(result.message || '加载失败');
      }
    } catch (err) {
      setError(err?.message || '加载失败');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  useEffect(() => {
    if (searchParams?.get('publish') !== '1' || !canEdit || !data) return;
    openPublish();
    // 仅在带 ?publish=1 进入时自动打开一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, canEdit, data?._id]);

  const resetPublish = () => {
    setPublishPreview(null);
    setPublishError('');
    setPublishForm({
      year: String(new Date().getFullYear()),
      versionMonth: String(new Date().getMonth() + 1),
      filename: '',
      species: [],
      fileEntries: [],
      mergeHits: 0,
    });
    if (publishFileRef.current) publishFileRef.current.value = '';
  };

  const openPublish = () => {
    resetPublish();
    const nextMonth = Number(data?.versionMonth) >= 12 ? 1 : Number(data?.versionMonth || 0) + 1;
    const nextYear =
      Number(data?.versionMonth) >= 12
        ? Number(data?.year || new Date().getFullYear()) + 1
        : Number(data?.year || new Date().getFullYear());
    setPublishForm((prev) => ({
      ...prev,
      year: String(Number.isFinite(nextYear) ? nextYear : new Date().getFullYear()),
      versionMonth: String(
        Number.isFinite(nextMonth) && nextMonth >= 1 ? nextMonth : new Date().getMonth() + 1
      ),
    }));
    setShowPublish(true);
  };

  const handlePublishFiles = async (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    setPublishError('');
    setPublishPreview(null);
    try {
      const parsed = [];
      for (const file of files) {
        parsed.push(await parseSpeciesListFile(file));
      }
      setPublishForm((prev) => {
        const nextEntries = [...(prev.fileEntries || [])];
        parsed.forEach((item) => {
          if (nextEntries.length >= MAX_SPECIES_LIST_UPLOAD_FILES) return;
          const idx = nextEntries.findIndex((f) => f.filename === item.filename);
          if (idx >= 0) nextEntries[idx] = item;
          else nextEntries.push(item);
        });
        const capped = nextEntries.slice(0, MAX_SPECIES_LIST_UPLOAD_FILES);
        const { species, mergeHits } = mergeSpeciesLists(capped.map((f) => f.species));
        return {
          ...prev,
          fileEntries: capped,
          species,
          mergeHits,
          filename: capped.map((f) => f.filename).join(' + '),
        };
      });
    } catch (err) {
      setPublishError(err?.message || '解析失败');
    } finally {
      if (publishFileRef.current) publishFileRef.current.value = '';
    }
  };

  const removePublishFile = (filename) => {
    setPublishPreview(null);
    setPublishForm((prev) => {
      const nextEntries = (prev.fileEntries || []).filter((f) => f.filename !== filename);
      const { species, mergeHits } = mergeSpeciesLists(nextEntries.map((f) => f.species));
      return {
        ...prev,
        fileEntries: nextEntries,
        species,
        mergeHits,
        filename: nextEntries.map((f) => f.filename).join(' + '),
      };
    });
  };

  const handlePreviewVersion = async () => {
    if (!id) return;
    if (!publishForm.species.length) {
      setPublishError('请先选择清单文件');
      return;
    }
    if (!publishForm.year.trim() || !publishForm.versionMonth.trim()) {
      setPublishError('请指定新版本年月');
      return;
    }
    setPublishBusy(true);
    setPublishError('');
    try {
      const result = await api.regionLists.previewVersion(id, {
        species: publishForm.species,
        year: publishForm.year.trim(),
        versionMonth: publishForm.versionMonth.trim(),
        originalFilename: publishForm.filename,
      });
      if (!result.success) throw new Error(result.message || '对比失败');
      setPublishPreview(result.data);
    } catch (err) {
      setPublishError(err?.message || '对比失败');
      setPublishPreview(null);
    } finally {
      setPublishBusy(false);
    }
  };

  const handlePublishVersion = async () => {
    if (!id || !publishPreview) return;
    setPublishBusy(true);
    setPublishError('');
    try {
      const result = await api.regionLists.publishVersion(id, {
        species: publishForm.species,
        year: publishForm.year.trim(),
        versionMonth: publishForm.versionMonth.trim(),
        originalFilename: publishForm.filename,
      });
      if (!result.success) throw new Error(result.message || '发布失败');
      setShowPublish(false);
      resetPublish();
      await fetchDetail();
      if (typeof window !== 'undefined' && window.showToast) {
        window.showToast(result.message || '已发布新版本', 'success', 2800);
      }
    } catch (err) {
      setPublishError(err?.message || '发布失败');
    } finally {
      setPublishBusy(false);
    }
  };

  const buildCatalogDefaults = (row) => {
    const regionLabel =
      [data?.province, data?.city, data?.district, data?.spot, data?.regionName]
        .filter(Boolean)
        .join(' · ') ||
      data?.regionName ||
      '地区清单';
    const sci = String(row.scientificName || '').trim() || '待定 sp.';
    return {
      speciesIndex: row.storageIndex ?? row.speciesIndex,
      storageIndex: row.storageIndex ?? row.speciesIndex,
      /** 清单原名：关联校验用，不受弹窗改名影响 */
      listName: String(row.name || '').trim(),
      name: String(row.name || '').trim(),
      scientificName: sci,
      englishName: String(row.englishName || '').trim(),
      order: String(row.order || '').trim(),
      family: String(row.family || '').trim(),
      description: `由「${regionLabel}」鸟种清单入库，资料待补全。`,
      habitat: '待补充',
      distribution: regionLabel,
    };
  };

  const openCatalogEditor = (row) => {
    setCatalogForm(buildCatalogDefaults(row));
    setCatalogError('');
    setShowCatalogModal(true);
  };

  const createAndLinkBird = async (payload, { openEditAfter = false } = {}) => {
    if (!id || !user) {
      throw new Error('请先登录');
    }
    if (!canEdit) {
      throw new Error('无权修改此清单');
    }
    const name = String(payload.name || '').trim();
    const scientificName = String(payload.scientificName || '').trim();
    if (!name || !scientificName) {
      throw new Error('中文名与学名为必填');
    }

    // 普通用户无 admin 的 POST /api/birds，走 request-new（临时档案，可立即关联）
    const created = await api.birds.requestNew({
      name,
      scientificName,
      category: String(payload.order || payload.family || '未分类').trim() || '未分类',
      description: String(payload.description || '').trim() || '待补充',
      habitat: String(payload.habitat || '').trim() || '待补充',
      distribution: String(payload.distribution || '').trim() || '待补充',
      conservationStatus: '未评估',
      chinaProtectionLevel: '未列入',
    });
    const birdId =
      created?.data?.birdId || created?.data?.bird?._id || created?.data?._id;
    if (!created?.success || !birdId) {
      throw new Error(created?.message || '创建鸟种失败');
    }

    const linked = await api.regionLists.linkSpecies(id, {
      speciesIndex: payload.storageIndex ?? payload.speciesIndex,
      storageIndex: payload.storageIndex ?? payload.speciesIndex,
      // 用清单原名校验下标，允许弹窗里改成新鸟种库名称
      name: String(payload.listName || payload.name || '').trim(),
      birdId,
    });
    if (!linked?.success) {
      throw new Error(linked?.message || '创建成功但关联清单失败，请刷新后重试');
    }

    await fetchDetail();
    if (typeof window !== 'undefined' && window.showToast) {
      window.showToast(`已入库「${name}」`, 'success', 2200);
    }
    if (openEditAfter && birdId) {
      window.open(`/birds/edit/${birdId}`, '_blank', 'noopener,noreferrer');
    }
    return created.data?.bird || { _id: birdId, name };
  };

  const handleQuickCreateUnmatched = async () => {
    if (!unmatchedSpecies.length) return;
    const nameList = unmatchedSpecies
      .map((row) => row.name || row.scientificName || '未命名')
      .join('、');
    const ok = await ask({
      title: '批量入库',
      message: `将为以下 ${unmatchedSpecies.length} 种「库中暂无」鸟种创建基础档案并关联到本清单：\n\n${nameList}\n\n之后可在鸟种页补全。继续？`,
      confirmLabel: '继续入库',
      cancelLabel: '取消',
    });
    if (!ok) return;
    setCatalogBusy(true);
    setCatalogError('');
    try {
      let ok = 0;
      for (const row of unmatchedSpecies) {
        await createAndLinkBird(buildCatalogDefaults(row));
        ok += 1;
      }
      if (typeof window !== 'undefined' && window.showToast) {
        window.showToast(`已入库 ${ok} 种`, 'success', 2500);
      }
    } catch (err) {
      const msg = err?.message || '批量入库失败';
      setCatalogError(msg);
      if (typeof window !== 'undefined' && window.showToast) {
        window.showToast(msg, 'error', 4000);
      }
    } finally {
      setCatalogBusy(false);
    }
  };

  const handleSaveCatalogForm = async (event) => {
    event.preventDefault();
    setCatalogBusy(true);
    setCatalogError('');
    try {
      await createAndLinkBird(catalogForm, { openEditAfter: false });
      setShowCatalogModal(false);
    } catch (err) {
      const msg = err?.message || '入库失败';
      setCatalogError(msg);
      if (typeof window !== 'undefined' && window.showToast) {
        window.showToast(msg, 'error', 4000);
      }
    } finally {
      setCatalogBusy(false);
    }
  };

  const handleSaveCatalogAndEdit = async () => {
    setCatalogBusy(true);
    setCatalogError('');
    try {
      await createAndLinkBird(catalogForm, { openEditAfter: true });
      setShowCatalogModal(false);
    } catch (err) {
      const msg = err?.message || '入库失败';
      setCatalogError(msg);
      if (typeof window !== 'undefined' && window.showToast) {
        window.showToast(msg, 'error', 4000);
      }
    } finally {
      setCatalogBusy(false);
    }
  };

  useEffect(() => {
    if (!user) {
      setObservedKeys(new Set());
      return undefined;
    }
    let cancelled = false;
    (async () => {
      try {
        const tax = await api.personal.getChecklistTaxonomy();
        if (cancelled || !tax?.success) return;
        const keys = new Set();
        (tax.data?.species || []).forEach((bird) => {
          if (!bird?.observed) return;
          const bid = bird._id != null ? String(bird._id) : '';
          if (bid) keys.add(`id:${bid}`);
          const name = normalizeNameKey(bird.name);
          if (name) keys.add(`name:${name}`);
          const sci = normalizeSciKey(bird.scientificName);
          if (sci) keys.add(`sci:${sci}`);
          const bin = sciBinomialKey(bird.scientificName);
          if (bin) keys.add(`sci:${bin}`);
        });
        setObservedKeys(keys);
      } catch {
        if (!cancelled) setObservedKeys(new Set());
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const isObserved = useCallback(
    (row) => {
      const rawId = row?.birdId?._id || row?.birdId;
      if (rawId != null && observedKeys.has(`id:${String(rawId)}`)) return true;
      const name = normalizeNameKey(row?.name);
      if (name && observedKeys.has(`name:${name}`)) return true;
      const sci = normalizeSciKey(row?.scientificName);
      if (sci && observedKeys.has(`sci:${sci}`)) return true;
      const bin = sciBinomialKey(row?.scientificName);
      if (bin && observedKeys.has(`sci:${bin}`)) return true;
      return false;
    },
    [observedKeys]
  );

  const annotatedSpecies = useMemo(
    () =>
      allSpecies.map((row, speciesIndex) => ({
        ...row,
        speciesIndex,
        storageIndex: row.storageIndex != null ? row.storageIndex : speciesIndex,
        observed: isObserved(row),
        inCatalog: Boolean(row?.birdId?._id || row?.birdId),
      })),
    [allSpecies, isObserved]
  );

  const unmatchedSpecies = useMemo(
    () => annotatedSpecies.filter((row) => !row.inCatalog),
    [annotatedSpecies]
  );

  const matchesSummaryQuery = useCallback((row, q) => {
    if (!q) return true;
    return speciesMatchesSearch(row, q, {
      orderLabel: orderDisplayName(row.order || '未分类'),
    });
  }, []);

  const passesSummaryFilter = useCallback(
    (row) => {
      if (summaryFilter === 'seen' && !row.observed) return false;
      if (summaryFilter === 'unseen' && row.observed) return false;
      return true;
    },
    [summaryFilter]
  );

  const summaryStats = useMemo(() => {
    const total = annotatedSpecies.length;
    const seen = annotatedSpecies.filter((row) => row.observed).length;
    const pct = total ? Math.round((seen / total) * 100) : 0;
    return { total, seen, pct };
  }, [annotatedSpecies]);

  const orderCards = useMemo(() => {
    const q = summarySearch.trim().toLowerCase();

    // 全量按目统计（别名归一，如 啄木鸟目 / Piciformes / 鴷形目）
    const fullMap = new Map();
    annotatedSpecies.forEach((row) => {
      const key = orderGroupKey(row.order);
      if (!fullMap.has(key)) fullMap.set(key, { key, total: 0, seen: 0 });
      const node = fullMap.get(key);
      node.total += 1;
      if (row.observed) node.seen += 1;
    });

    // 当前筛选下，哪些目还有可展示鸟种
    const visibleKeys = new Set();
    annotatedSpecies.forEach((row) => {
      if (!passesSummaryFilter(row)) return;
      if (!matchesSummaryQuery(row, q)) return;
      visibleKeys.add(orderGroupKey(row.order));
    });

    return Array.from(fullMap.values())
      .filter((node) => visibleKeys.has(node.key))
      .map((node) => {
        const unseen = Math.max(0, node.total - node.seen);
        const focus = summaryFilter === 'unseen' ? unseen : node.seen;
        return {
          ...node,
          unseen,
          focus,
          pct: node.total ? Math.round((focus / node.total) * 100) : 0,
          label: orderDisplayName(node.key),
          latin: orderLatinSubtitle(node.key),
        };
      })
      .sort((a, b) => a.label.localeCompare(b.label, 'zh'));
  }, [annotatedSpecies, summaryFilter, summarySearch, passesSummaryFilter, matchesSummaryQuery]);

  const tableSpecies = useMemo(() => {
    const q = search.trim().toLowerCase();
    const summaryQ = summarySearch.trim().toLowerCase();
    let rows = annotatedSpecies.filter(
      (row) => passesSummaryFilter(row) && matchesSummaryQuery(row, summaryQ)
    );
    if (order) {
      const orderKey = orderGroupKey(order);
      rows = rows.filter((row) => orderGroupKey(row.order) === orderKey);
    }
    if (family) rows = rows.filter((row) => row.family === family);
    if (q) {
      rows = rows.filter((row) =>
        speciesMatchesSearch(row, q, {
          orderLabel: orderDisplayName(row.order || '未分类'),
        })
      );
    }
    const dir = sortOrder === 'asc' ? 1 : -1;
    rows.sort((a, b) => {
      const av = a[sortBy];
      const bv = b[sortBy];
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
      return String(av || '').localeCompare(String(bv || ''), 'zh') * dir;
    });
    return rows;
  }, [
    annotatedSpecies,
    search,
    summarySearch,
    order,
    family,
    sortBy,
    sortOrder,
    passesSummaryFilter,
    matchesSummaryQuery,
  ]);

  const filterOptions = useMemo(() => {
    const orderKeys = [
      ...new Set(
        allSpecies
          .map((s) => orderGroupKey(s.order))
          .filter((k) => k && k !== '未分类')
      ),
    ].sort((a, b) => orderDisplayName(a).localeCompare(orderDisplayName(b), 'zh'));
    const families = [...new Set(allSpecies.map((s) => s.family).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b, 'zh')
    );
    return { orders: orderKeys, families };
  }, [allSpecies]);

  const versionLabel = formatVersionLabel(data?.year, data?.versionMonth);

  const openEdit = () => {
    const provinceCode = getProvinceCodeByName(data?.province) || '';
    const cityCode = provinceCode
      ? getCityCodeByName(data?.city, provinceCode) || ''
      : '';
    setEditForm({
      regionName: data?.regionName || '',
      title: data?.title || '',
      provinceCode,
      cityCode,
      district: data?.district || '',
      spot: data?.spot || '',
      locationId: data?.locationId ? String(data.locationId) : '',
      year: data?.year != null ? String(data.year) : '',
      versionMonth: data?.versionMonth != null ? String(data.versionMonth) : '',
    });
    setShowEdit(true);
  };

  const handleSaveEdit = async (event) => {
    event.preventDefault();
    if (!id) return;
    setSavingEdit(true);
    setError('');
    try {
      const provinceName =
        provinces.find((p) => p.code === editForm.provinceCode)?.name || '';
      const cityName =
        getCitiesByProvince(editForm.provinceCode).find(
          (c) => c.code === editForm.cityCode
        )?.name || '';
      if (!provinceName) {
        throw new Error('请选择省份');
      }
      const result = await api.regionLists.update(id, {
        regionName: editForm.regionName.trim(),
        title: editForm.title.trim(),
        province: provinceName,
        city: cityName,
        district: editForm.district.trim(),
        spot: editForm.spot.trim(),
        locationId: editForm.locationId || null,
        year: editForm.year.trim() || null,
        versionMonth: editForm.versionMonth.trim() || null,
      });
      if (!result.success) throw new Error(result.message || '保存失败');
      setData((prev) => ({
        ...prev,
        ...result.data,
      }));
      setShowEdit(false);
      if (typeof window !== 'undefined' && window.showToast) {
        window.showToast(result.message || '已更新', 'success', 2200);
      }
    } catch (err) {
      setError(err?.message || '保存失败');
    } finally {
      setSavingEdit(false);
    }
  };

  if (loading && !data) {
    return (
      <div className={styles.container}>
        <Navbar />
        <main className={styles.main}>
          <PageState type="loading" title="加载清单…" />
        </main>
        <Footer />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className={styles.container}>
        <Navbar />
        <main className={styles.main}>
          <PageState type="error" title="无法打开清单" message={error} />
          <div className={styles.backRow}>
            <Link href="/birds/regions">← 各地鸟种</Link>
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
          title={data.regionName}
          description={
            [data.title || '地区鸟种清单', versionLabel].filter(Boolean).join(' · ')
          }
          descriptionVariant="caption"
          actions={
            <>
              {canEdit ? (
                <HeaderPrimaryButton onClick={openPublish}>发布新版本</HeaderPrimaryButton>
              ) : null}
              {canEdit ? (
                <HeaderSecondaryButton onClick={openEdit}>编辑信息</HeaderSecondaryButton>
              ) : null}
              <HeaderSecondaryLink href="/birds/regions">各地鸟种</HeaderSecondaryLink>
            </>
          }
        />

        {canEdit && unmatchedSpecies.length > 0 ? (
          <div className={styles.existsBanner}>
            <div className={styles.existsBannerBody}>
              <span>
                有 <strong>{unmatchedSpecies.length}</strong> 种不在鸟种库中（如国新），可先入库再对照已见进度：
              </span>
              <ul className={styles.unmatchedList}>
                {unmatchedSpecies.map((row) => (
                  <li key={`${row.storageIndex}-${row.name}`}>
                    <strong>{row.name || '未命名'}</strong>
                    {row.scientificName ? <em> {row.scientificName}</em> : null}
                    {canEdit ? (
                      <>
                        {' '}
                        <button
                          type="button"
                          className={styles.linkBtn}
                          disabled={catalogBusy}
                          onClick={() => openCatalogEditor(row)}
                        >
                          单独入库…
                        </button>
                      </>
                    ) : null}
                  </li>
                ))}
              </ul>
              {catalogError ? <p className={styles.catalogError}>{catalogError}</p> : null}
            </div>
            <button
              type="button"
              className={styles.primaryBtn}
              disabled={catalogBusy}
              onClick={handleQuickCreateUnmatched}
            >
              {catalogBusy ? '入库中…' : '一键入库（默认信息）'}
            </button>
          </div>
        ) : null}

        {versionHistory.length > 0 ? (
          <section className={styles.historySection} aria-label="版本历史">
            <h3 className={styles.historyTitle}>版本历史</h3>
            <ul className={styles.historyList}>
              {versionHistory.map((entry) => {
                const entryId = String(entry._id || `${entry.year}-${entry.versionMonth}-${entry.publishedAt}`);
                const fromLabel = formatVersionLabel(entry.year, entry.versionMonth) || '未标注版本';
                const toLabel =
                  formatVersionLabel(entry.nextYear, entry.nextVersionMonth) || '新版本';
                const addedCount = entry.changes?.added?.length || 0;
                const removedCount = entry.changes?.removed?.length || 0;
                const open = expandedHistoryId === entryId;
                return (
                  <li key={entryId} className={styles.historyItem}>
                    <button
                      type="button"
                      className={styles.historyItemHeader}
                      onClick={() =>
                        setExpandedHistoryId((prev) => (prev === entryId ? '' : entryId))
                      }
                    >
                      <span className={styles.historyPath}>
                        {fromLabel} → {toLabel}
                      </span>
                      <span className={styles.historyDelta}>
                        +{addedCount} / -{removedCount}
                      </span>
                      <span className={styles.historyChevron}>{open ? '▾' : '▸'}</span>
                    </button>
                    {open ? (
                      <div className={styles.historyBody}>
                        {addedCount === 0 && removedCount === 0 ? (
                          <p className={styles.historyEmpty}>物种集合无变化（可能仅记录次数更新）</p>
                        ) : (
                          <>
                            {addedCount > 0 ? (
                              <div className={styles.historyGroup}>
                                <h4>新增 {addedCount} 种</h4>
                                <ul>
                                  {(entry.changes?.added || []).map((bird, idx) => (
                                    <li key={`a-${bird.code}-${bird.name}-${idx}`}>
                                      <SpeciesHoverChip name={bird.name} />
                                      {bird.scientificName ? (
                                        <em> {bird.scientificName}</em>
                                      ) : null}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            ) : null}
                            {removedCount > 0 ? (
                              <div className={styles.historyGroup}>
                                <h4>移除 {removedCount} 种</h4>
                                <ul>
                                  {(entry.changes?.removed || []).map((bird, idx) => (
                                    <li key={`r-${bird.code}-${bird.name}-${idx}`}>
                                      <SpeciesHoverChip name={bird.name} />
                                      {bird.scientificName ? (
                                        <em> {bird.scientificName}</em>
                                      ) : null}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            ) : null}
                          </>
                        )}
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}

        <SpeciesLedgerBrowse
          className={styles.summarySection}
          progressLabel={
            <>
              已见 {summaryStats.seen} / {summaryStats.total}
              <span className={styles.summaryPct}>（{summaryStats.pct}%）</span>
            </>
          }
          progressPct={summaryStats.pct}
          searchValue={summarySearch}
          onSearchChange={setSummarySearch}
          filterValue={summaryFilter}
          onFilterChange={setSummaryFilter}
          orderCards={orderCards.map((card) => ({
            key: card.key,
            label: card.label,
            latin: card.latin,
            stat: `${card.focus}/${card.total} ${card.pct}%`,
            pct: card.pct,
            done: card.total > 0 && card.seen === card.total,
            active: orderGroupKey(order || '') === card.key && Boolean(order),
          }))}
          onSelectOrder={(card) => {
            if (order && orderGroupKey(order) === card.key) {
              setOrder('');
            } else {
              setOrder(card.key === '未分类' ? '' : card.key);
            }
            setFamily('');
          }}
        />

        {error ? <div className={styles.errorBanner}>{error}</div> : null}

        <div className={styles.toolbar}>
          <BirdSearchField
            className={styles.searchInput}
            value={search}
            onChange={setSearch}
            placeholder={BIRD_SEARCH_PLACEHOLDER_TAXON}
            size="sm"
            roundedRect
          />
          <select
            className={styles.filterSelect}
            value={order}
            onChange={(e) => {
              setOrder(e.target.value);
              setFamily('');
            }}
          >
            <option value="">全部目</option>
            {filterOptions.orders.map((item) => (
              <option key={item} value={item}>
                {orderDisplayName(item)}
              </option>
            ))}
          </select>
          <select
            className={styles.filterSelect}
            value={family}
            onChange={(e) => setFamily(e.target.value)}
          >
            <option value="">全部科</option>
            {filterOptions.families.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <select
            className={styles.filterSelect}
            value={`${sortBy}-${sortOrder}`}
            onChange={(e) => {
              const [field, dir] = e.target.value.split('-');
              setSortBy(field);
              setSortOrder(dir);
            }}
          >
            <option value="recordCount-desc">记录次数 ↓</option>
            <option value="recordCount-asc">记录次数 ↑</option>
            <option value="name-asc">中文名 A-Z</option>
            <option value="code-asc">编号</option>
          </select>
        </div>

        {tableSpecies.length === 0 ? (
          <PageState type="empty" title="没有匹配鸟种" message="换个关键词或筛选条件试试。" />
        ) : (
          <div className={styles.tableCard}>
            <div className={styles.previewTableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>鸟种编号</th>
                    <th>中文名</th>
                    <th>拉丁学名</th>
                    <th>英文名称</th>
                    <th>目</th>
                    <th>科</th>
                    <th>记录次数</th>
                    <th>已见</th>
                    <th>入库</th>
                  </tr>
                </thead>
                <tbody>
                  {tableSpecies.map((row, index) => (
                    <tr
                      key={`${row.code}-${row.name}-${index}`}
                      className={user && !row.observed ? styles.rowUnseen : undefined}
                    >
                      <td>{row.code || '—'}</td>
                      <td>
                        {row.inCatalog ? (
                          <Link
                            href={`/birds/${row.birdId?._id || row.birdId}`}
                            className={styles.birdLink}
                          >
                            {row.name}
                          </Link>
                        ) : (
                          <span className={styles.nameWithBadge}>
                            {row.name}
                            <span className={styles.missingBadge}>库中暂无</span>
                          </span>
                        )}
                      </td>
                      <td>
                        <em>{row.scientificName || '—'}</em>
                      </td>
                      <td>{row.englishName || '—'}</td>
                      <td>{orderDisplayName(row.order) || '—'}</td>
                      <td>{row.family || '—'}</td>
                      <td className={styles.countCell}>{row.recordCount ?? 0}</td>
                      <td>
                        {user ? (
                          <span
                            className={
                              row.observed ? styles.statusSeen : styles.statusUnseen
                            }
                          >
                            {row.observed ? '已见' : '未见'}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td>
                        {!row.inCatalog && canEdit ? (
                          <button
                            type="button"
                            className={styles.linkBtn}
                            disabled={catalogBusy}
                            onClick={() => openCatalogEditor(row)}
                          >
                            入库…
                          </button>
                        ) : row.inCatalog ? (
                          <span className={styles.mutedDash}>—</span>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
      <Footer />

      <FormModal
        open={showEdit}
        onClose={() => setShowEdit(false)}
        title="编辑清单信息"
        actions={
          <>
            <button type="button" className={styles.secondaryBtn} onClick={() => setShowEdit(false)}>
              取消
            </button>
            <button type="submit" form="region-edit-list-form" className={styles.primaryBtn} disabled={savingEdit}>
              {savingEdit ? '保存中…' : '保存'}
            </button>
          </>
        }
      >
            <form id="region-edit-list-form" onSubmit={handleSaveEdit}>
              <label>
                省份 *
                <select
                  value={editForm.provinceCode}
                  onChange={(e) =>
                    setEditForm((prev) => ({
                      ...prev,
                      provinceCode: e.target.value,
                      cityCode: '',
                    }))
                  }
                  required
                >
                  <option value="">请选择省份</option>
                  {provinces.map((p) => (
                    <option key={p.code} value={p.code}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                城市
                <select
                  value={editForm.cityCode}
                  disabled={!editForm.provinceCode}
                  onChange={(e) =>
                    setEditForm((prev) => ({ ...prev, cityCode: e.target.value }))
                  }
                >
                  <option value="">全省 / 未指定市</option>
                  {editCityOptions.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                区县
                <input
                  value={editForm.district}
                  onChange={(e) =>
                    setEditForm((prev) => ({ ...prev, district: e.target.value }))
                  }
                  placeholder="可选"
                />
              </label>
              <label className={styles.spotField}>
                鸟点
                <LocationAutocomplete
                  value={editForm.spot}
                  showHint={false}
                  placeholder="可选：搜索地点名录"
                  onChange={(loc) => {
                    setEditForm((prev) => ({
                      ...prev,
                      spot: String(loc?.name || '').trim(),
                      locationId: loc?._id ? String(loc._id) : '',
                      district:
                        prev.district ||
                        String(loc?.address?.district || '').trim() ||
                        prev.district,
                    }));
                  }}
                />
              </label>
              <label>
                地区名称 *
                <input
                  value={editForm.regionName}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, regionName: e.target.value }))}
                  required
                />
              </label>
              <label>
                标题
                <input
                  value={editForm.title}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, title: e.target.value }))}
                />
              </label>
              <div className={styles.modalRow}>
                <label>
                  版本年份
                  <input
                    type="number"
                    min="1900"
                    max="2100"
                    value={editForm.year}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, year: e.target.value }))}
                    placeholder="如 2026"
                  />
                </label>
                <label>
                  版本月份
                  <select
                    value={editForm.versionMonth}
                    onChange={(e) =>
                      setEditForm((prev) => ({ ...prev, versionMonth: e.target.value }))
                    }
                  >
                    <option value="">未指定</option>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                      <option key={m} value={String(m)}>
                        {m} 月
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <p className={styles.modalHint}>
                预览：
                {formatVersionLabel(editForm.year, editForm.versionMonth) || '（未设置版本）'}
              </p>
            </form>
      </FormModal>

      <FormModal
        open={showCatalogModal}
        onClose={() => setShowCatalogModal(false)}
        title="入库到鸟种库"
        wide
        actions={
          <>
            <button
              type="button"
              className={styles.secondaryBtn}
              onClick={() => setShowCatalogModal(false)}
            >
              取消
            </button>
            <button
              type="button"
              className={styles.secondaryBtn}
              disabled={catalogBusy}
              onClick={handleSaveCatalogAndEdit}
            >
              {catalogBusy ? '处理中…' : '入库并打开编辑'}
            </button>
            <button type="submit" form="region-catalog-form" className={styles.primaryBtn} disabled={catalogBusy}>
              {catalogBusy ? '入库中…' : '确认入库'}
            </button>
          </>
        }
      >
            <p className={styles.modalHint}>
              将用下列信息创建鸟种档案并关联到本清单。可先改再保存，或保存后打开编辑页继续补全。
            </p>
            {catalogError ? <p className={styles.catalogError}>{catalogError}</p> : null}
            <form id="region-catalog-form" onSubmit={handleSaveCatalogForm}>
              <label>
                中文名 *
                <input
                  value={catalogForm.name}
                  onChange={(e) => setCatalogForm((prev) => ({ ...prev, name: e.target.value }))}
                  required
                />
              </label>
              <label>
                学名 *
                <input
                  value={catalogForm.scientificName}
                  onChange={(e) =>
                    setCatalogForm((prev) => ({ ...prev, scientificName: e.target.value }))
                  }
                  required
                />
              </label>
              <label>
                英文名
                <input
                  value={catalogForm.englishName}
                  onChange={(e) =>
                    setCatalogForm((prev) => ({ ...prev, englishName: e.target.value }))
                  }
                />
              </label>
              <div className={styles.modalRow}>
                <label>
                  目
                  <input
                    value={catalogForm.order}
                    onChange={(e) => setCatalogForm((prev) => ({ ...prev, order: e.target.value }))}
                  />
                </label>
                <label>
                  科
                  <input
                    value={catalogForm.family}
                    onChange={(e) => setCatalogForm((prev) => ({ ...prev, family: e.target.value }))}
                  />
                </label>
              </div>
              <label>
                简介
                <textarea
                  rows={3}
                  value={catalogForm.description}
                  onChange={(e) =>
                    setCatalogForm((prev) => ({ ...prev, description: e.target.value }))
                  }
                />
              </label>
              <div className={styles.modalRow}>
                <label>
                  栖息地
                  <input
                    value={catalogForm.habitat}
                    onChange={(e) =>
                      setCatalogForm((prev) => ({ ...prev, habitat: e.target.value }))
                    }
                  />
                </label>
                <label>
                  分布
                  <input
                    value={catalogForm.distribution}
                    onChange={(e) =>
                      setCatalogForm((prev) => ({ ...prev, distribution: e.target.value }))
                    }
                  />
                </label>
              </div>
            </form>
      </FormModal>

      <FormModal
        open={showPublish}
        onClose={() => {
          setShowPublish(false);
          resetPublish();
        }}
        title="发布新版本"
        wide
        actions={
          <>
            <button
              type="button"
              className={styles.secondaryBtn}
              onClick={() => {
                setShowPublish(false);
                resetPublish();
              }}
            >
              取消
            </button>
            {!publishPreview ? (
              <button
                type="button"
                className={styles.primaryBtn}
                onClick={handlePreviewVersion}
                disabled={publishBusy || !publishForm.species.length}
              >
                {publishBusy ? '对比中…' : '对比差异'}
              </button>
            ) : (
              <button
                type="button"
                className={styles.primaryBtn}
                onClick={handlePublishVersion}
                disabled={publishBusy}
              >
                {publishBusy ? '发布中…' : '确认发布'}
              </button>
            )}
          </>
        }
      >
            <p className={styles.modalHint}>
              当前：{versionLabel || '未标注版本'}（{data.speciesCount || allSpecies.length || 0}{' '}
              种）。上传新清单后先对比，再确认发布。
            </p>
            <div className={styles.modalRow}>
              <label>
                新版本年份 *
                <input
                  type="number"
                  min="1900"
                  max="2100"
                  value={publishForm.year}
                  onChange={(e) => {
                    setPublishPreview(null);
                    setPublishForm((prev) => ({ ...prev, year: e.target.value }));
                  }}
                />
              </label>
              <label>
                新版本月份 *
                <select
                  value={publishForm.versionMonth}
                  onChange={(e) => {
                    setPublishPreview(null);
                    setPublishForm((prev) => ({ ...prev, versionMonth: e.target.value }));
                  }}
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <option key={m} value={String(m)}>
                      {m} 月
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label>
              鸟种清单文件 *
              <input
                ref={publishFileRef}
                type="file"
                accept=".xls,.xlsx,.xlsm,.csv"
                multiple
                onChange={handlePublishFiles}
                className={styles.fileInputHidden}
              />
            </label>
            <button
              type="button"
              className={styles.addFileBtn}
              onClick={() => publishFileRef.current?.click()}
            >
              {(publishForm.fileEntries || []).length ? '+ 继续添加文件' : '选择清单文件'}
            </button>
            {(publishForm.fileEntries || []).length > 0 ? (
              <ul className={styles.fileChipList}>
                {publishForm.fileEntries.map((entry) => (
                  <li key={entry.filename} className={styles.fileChip}>
                    <span>
                      {entry.filename}
                      <em>（{entry.species.length} 种）</em>
                    </span>
                    <button
                      type="button"
                      className={styles.fileChipRemove}
                      onClick={() => removePublishFile(entry.filename)}
                      aria-label={`移除 ${entry.filename}`}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            {publishForm.species.length ? (
              <p className={styles.modalHint}>
                合并后 {publishForm.species.length} 种
                {publishForm.mergeHits > 0
                  ? `（累加 ${publishForm.mergeHits} 次同种）`
                  : ''}
              </p>
            ) : null}

            {publishError ? <div className={styles.errorBanner}>{publishError}</div> : null}

            {publishPreview ? (
              <div className={styles.diffBox}>
                <p className={styles.diffSummary}>
                  {publishPreview.currentVersion?.label || '当前'} →{' '}
                  {publishPreview.nextVersion?.label || '新版'}：新增{' '}
                  <strong>{publishPreview.addedCount}</strong>，移除{' '}
                  <strong>{publishPreview.removedCount}</strong>，不变{' '}
                  {publishPreview.unchangedCount}
                </p>
                {publishPreview.addedCount > 0 ? (
                  <div className={styles.historyGroup}>
                    <h4>将新增</h4>
                    <ul className={styles.diffList}>
                      {(publishPreview.added || []).slice(0, 40).map((bird, idx) => (
                        <li key={`pa-${bird.code}-${bird.name}-${idx}`}>
                          <SpeciesHoverChip name={bird.name} />
                        </li>
                      ))}
                      {publishPreview.addedCount > 40 ? (
                        <li>… 还有 {publishPreview.addedCount - 40} 种</li>
                      ) : null}
                    </ul>
                  </div>
                ) : null}
                {publishPreview.removedCount > 0 ? (
                  <div className={styles.historyGroup}>
                    <h4>将移除</h4>
                    <ul className={styles.diffList}>
                      {(publishPreview.removed || []).slice(0, 40).map((bird, idx) => (
                        <li key={`pr-${bird.code}-${bird.name}-${idx}`}>
                          <SpeciesHoverChip name={bird.name} />
                        </li>
                      ))}
                      {publishPreview.removedCount > 40 ? (
                        <li>… 还有 {publishPreview.removedCount - 40} 种</li>
                      ) : null}
                    </ul>
                  </div>
                ) : null}
              </div>
            ) : null}
      </FormModal>
      {confirmDialog}
    </div>
  );
}
