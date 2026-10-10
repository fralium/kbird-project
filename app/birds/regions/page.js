'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Navbar from '../../../components/Navbar';
import Footer from '../../../components/Footer';
import SimplePageHeader, { HeaderPrimaryButton } from '../../../components/SimplePageHeader';
import PageState from '../../../components/PageState';
import { useConfirmDialog } from '../../../components/ConfirmDialog';
import { useAuth } from '../../../components/AuthProvider';
import { api } from '../../../utils/api';
import { RECORD_COVER_MODES, resolveRegionListCover, useRecordCoverSet } from '../../../utils/habitatCover';
import {
  MAX_SPECIES_LIST_UPLOAD_FILES,
  mergeSpeciesLists,
  parseSpeciesListFile,
} from '../../../utils/cbrcSpeciesListParser';
import {
  provinces,
  getCitiesByProvince,
} from '../../../data/chinaRegions';
import LocationAutocomplete from '../../../components/LocationAutocomplete';
import styles from '../../../styles/RegionBirdLists.module.css';

const ChinaProvinceMap = dynamic(() => import('../../../components/ChinaProvinceMap'), {
  ssr: false,
  loading: () => (
    <div className={styles.mapCanvas} style={{ display: 'grid', placeItems: 'center', color: '#94a3b8' }}>
      地图加载中…
    </div>
  ),
});

const UNLABELED_PROVINCE = '未标注省份';
const FILTER_PANEL_STORAGE_KEY = 'kbird.regions.filterPanel';

function readRegionsFilterPanelOpen() {
  if (typeof window === 'undefined') return true;
  try {
    return localStorage.getItem(FILTER_PANEL_STORAGE_KEY) !== '0';
  } catch {
    return true;
  }
}

function writeRegionsFilterPanelOpen(open) {
  try {
    localStorage.setItem(FILTER_PANEL_STORAGE_KEY, open ? '1' : '0');
  } catch {
    /* ignore */
  }
}

const emptyForm = () => ({
  provinceCode: '',
  cityCode: '',
  district: '',
  spot: '',
  locationId: '',
  regionName: '',
  title: '',
  year: String(new Date().getFullYear()),
  versionMonth: String(new Date().getMonth() + 1),
});

function resolveDivisionNames(provinceCode, cityCode, district, spot) {
  const provinceName = provinces.find((p) => p.code === provinceCode)?.name || '';
  const cityName =
    getCitiesByProvince(provinceCode).find((c) => c.code === cityCode)?.name || '';
  const districtName = String(district || '').trim();
  const spotName = String(spot || '').trim();
  return { provinceName, cityName, districtName, spotName };
}

function suggestRegionName({ provinceName, cityName, districtName, spotName }) {
  return spotName || districtName || cityName || provinceName || '';
}

function suggestTitle({ provinceName, cityName, districtName, spotName }) {
  const parts = [provinceName, cityName, districtName, spotName].filter(Boolean);
  if (!parts.length) return '';
  return `${parts.join('-')} 鸟类记录`;
}

function divisionSubtitle(item) {
  const parts = [item.province, item.city, item.district, item.spot].filter(Boolean);
  if (parts.length) return parts.join(' · ');
  return item.title || '鸟种清单';
}

function compareRegionLists(a, b) {
  const spotA = String(a.spot || '').trim() ? 1 : 0;
  const spotB = String(b.spot || '').trim() ? 1 : 0;
  if (spotA !== spotB) return spotA - spotB;

  const cityCmp = String(a.city || '').localeCompare(String(b.city || ''), 'zh');
  if (cityCmp !== 0) return cityCmp;
  const districtCmp = String(a.district || '').localeCompare(String(b.district || ''), 'zh');
  if (districtCmp !== 0) return districtCmp;
  const spotNameCmp = String(a.spot || '').localeCompare(String(b.spot || ''), 'zh');
  if (spotNameCmp !== 0) return spotNameCmp;
  return String(a.regionName || '').localeCompare(String(b.regionName || ''), 'zh');
}

function groupProvinceItems(items) {
  const provinceLists = [];
  const cities = new Map();
  const ensureCity = (name) => {
    const key = name || '其他';
    if (!cities.has(key)) cities.set(key, { cityName: key, lists: [], spots: [] });
    return cities.get(key);
  };

  items.forEach((item) => {
    const isSpot = Boolean(String(item.spot || '').trim());
    const city = String(item.city || '').trim();
    if (isSpot) {
      ensureCity(city).spots.push(item);
      return;
    }
    if (!city) {
      provinceLists.push(item);
      return;
    }
    ensureCity(city).lists.push(item);
  });

  const cityGroups = Array.from(cities.values()).sort((a, b) =>
    a.cityName.localeCompare(b.cityName, 'zh')
  );
  return { provinceLists, cityGroups };
}

function RegionListCard({ item, user, onDelete, cover, size = 'city' }) {
  const isSpot = Boolean(String(item.spot || '').trim());
  const versionLabel =
    item.year && item.versionMonth
      ? `${item.year}.${item.versionMonth}`
      : item.year
        ? `${item.year}`
        : '';
  const seenCount = typeof item.seenCount === 'number' ? item.seenCount : null;
  const speciesCount = item.speciesCount || 0;
  const canDelete =
    user &&
    (user.role === 'admin' ||
      (item.uploadedBy &&
        String(item.uploadedBy?._id || item.uploadedBy) === String(user._id)));

  return (
    <article className={`${styles.coverCard} ${styles[`coverCard_${size}`]}`}>
      <Link href={`/birds/regions/${item._id}`} className={styles.coverCardLink}>
        <div className={styles.coverMedia}>
          <Image
            src={cover.url}
            alt=""
            fill
            sizes="(max-width: 700px) 100vw, 33vw"
            unoptimized
            className={styles.coverImage}
          />
          <div className={styles.coverShade} aria-hidden="true" />
          {isSpot ? <span className={styles.coverBadge}>鸟点</span> : null}
          {cover.source === 'bird' && cover.birdName ? (
            <span className={styles.coverBirdBadge}>
              {cover.level ? `${cover.level.replace('国家', '国')} · ` : ''}
              {cover.birdName}
            </span>
          ) : null}
          <div className={styles.coverOverlay}>
            <h2 className={styles.coverTitle}>{item.regionName}</h2>
            {size !== 'spot' ? (
              <p className={styles.coverMeta}>{divisionSubtitle(item)}</p>
            ) : null}
            <p className={styles.coverStats}>
              {seenCount != null
                ? `已见 ${seenCount} / ${speciesCount} 种`
                : `${speciesCount} 种`}
              {versionLabel ? ` · ${versionLabel}` : ''}
            </p>
          </div>
        </div>
      </Link>
      {canDelete ? (
        <button
          type="button"
          className={styles.coverDelete}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDelete(item._id, item.regionName);
          }}
        >
          删除
        </button>
      ) : null}
    </article>
  );
}

function ProvinceOverviewCard({ provinceName, items, onOpen, cover }) {
  const { provinceLists, cityGroups } = groupProvinceItems(items);
  const spotCount = cityGroups.reduce((n, g) => n + g.spots.length, 0);
  const cityCount = cityGroups.filter((g) => g.cityName !== '其他' || g.lists.length).length;
  const speciesCount = Math.max(0, ...items.map((i) => Number(i.speciesCount || 0)));
  const bits = [];
  if (provinceLists.length) bits.push(`${provinceLists.length} 份全省`);
  if (cityCount) bits.push(`${cityCount} 市`);
  if (spotCount) bits.push(`${spotCount} 鸟点`);

  return (
    <button type="button" className={styles.coverCard} onClick={() => onOpen(provinceName)}>
      <div className={styles.coverMedia}>
        <Image
          src={cover.url}
          alt=""
          fill
          sizes="(max-width: 700px) 100vw, 33vw"
          unoptimized
          className={styles.coverImage}
        />
        <div className={styles.coverShade} aria-hidden="true" />
        {cover.source === 'bird' && cover.birdName ? (
          <span className={styles.coverBirdBadge}>
            {cover.level ? `${cover.level.replace('国家', '国')} · ` : ''}
            {cover.birdName}
          </span>
        ) : null}
        <div className={styles.coverOverlay}>
          <h2 className={styles.coverTitle}>{provinceName}</h2>
          <p className={styles.coverMeta}>{bits.join(' · ') || `${items.length} 份清单`}</p>
          <p className={styles.coverStats}>{speciesCount} 种 · 点开看市与鸟点</p>
        </div>
      </div>
    </button>
  );
}

export default function RegionBirdListsPage() {
  const [coverSet, updateCoverSet] = useRecordCoverSet();
  const router = useRouter();
  const { user } = useAuth();
  const { ask, dialog: confirmDialog } = useConfirmDialog();
  const fileRef = useRef(null);
  const nameLockedRef = useRef(false);
  const titleLockedRef = useRef(false);
  const [lists, setLists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [query, setQuery] = useState('');
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [fileEntries, setFileEntries] = useState([]);
  const [conflictId, setConflictId] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [selectedProvince, setSelectedProvince] = useState('');
  const [filterPanelOpen, setFilterPanelOpen] = useState(true);

  const cityOptions = useMemo(
    () => getCitiesByProvince(form.provinceCode),
    [form.provinceCode]
  );

  const mergedPreview = useMemo(() => {
    if (!fileEntries.length) return null;
    const { species, mergeHits } = mergeSpeciesLists(fileEntries.map((f) => f.species));
    return {
      species,
      mergeHits,
      sample: species.slice(0, 8),
      filenames: fileEntries.map((f) => f.filename),
      filename: fileEntries.map((f) => f.filename).join(' + '),
      fileCount: fileEntries.length,
    };
  }, [fileEntries]);

  useEffect(() => {
    setPreview(mergedPreview);
  }, [mergedPreview]);

  const existingSameRegion = useMemo(() => {
    const names = resolveDivisionNames(
      form.provinceCode,
      form.cityCode,
      form.district,
      form.spot
    );
    if (!names.provinceName) return null;
    return (
      lists.find(
        (item) =>
          String(item.province || '') === names.provinceName &&
          String(item.city || '') === names.cityName &&
          String(item.district || '') === names.districtName &&
          String(item.spot || '') === names.spotName
      ) || null
    );
  }, [lists, form.provinceCode, form.cityCode, form.district, form.spot]);

  const provinceGroups = useMemo(() => {
    const map = new Map();
    lists.forEach((item) => {
      const key = String(item.province || '').trim() || UNLABELED_PROVINCE;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(item);
    });
    return Array.from(map.entries())
      .map(([provinceName, items]) => [provinceName, [...items].sort(compareRegionLists)])
      .sort((a, b) => {
        if (a[0] === UNLABELED_PROVINCE) return 1;
        if (b[0] === UNLABELED_PROVINCE) return -1;
        return a[0].localeCompare(b[0], 'zh');
      });
  }, [lists]);

  const statsByProvince = useMemo(() => {
    const map = {};
    lists.forEach((item) => {
      const key = String(item.province || '').trim();
      if (!key) return;
      if (!map[key]) {
        map[key] = { listCount: 0, speciesCount: 0, seenCount: 0 };
      }
      map[key].listCount += 1;
      map[key].speciesCount = Math.max(
        map[key].speciesCount,
        Number(item.speciesCount || 0)
      );
      map[key].seenCount = Math.max(map[key].seenCount, Number(item.seenCount || 0));
    });
    return map;
  }, [lists]);

  const visibleProvinceGroups = useMemo(() => {
    if (!selectedProvince) return provinceGroups;
    return provinceGroups.filter(([name]) => name === selectedProvince);
  }, [provinceGroups, selectedProvince]);

  const handleSelectProvince = useCallback((name) => {
    setSelectedProvince((prev) => (prev === name ? '' : name));
  }, []);

  useEffect(() => {
    setFilterPanelOpen(readRegionsFilterPanelOpen());
  }, []);

  useEffect(() => {
    if (!selectedProvince) return;
    const timer = window.setTimeout(() => {
      const el = document.getElementById(`province-${selectedProvince}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
    return () => window.clearTimeout(timer);
  }, [selectedProvince]);

  const fetchLists = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.regionLists.getAll({
        q: query.trim() || undefined,
        limit: '100',
        page: '1',
        _t: String(Date.now()),
      });
      if (data.success) {
        setLists(Array.isArray(data.data) ? data.data : []);
      } else {
        setError(data.message || '加载失败');
      }
    } catch (err) {
      setError(err?.message || '加载失败');
    } finally {
      setLoading(false);
    }
  }, [query, user?._id]);

  useEffect(() => {
    fetchLists();
  }, [fetchLists]);

  const patchDivision = (patch) => {
    setForm((prev) => {
      const next = { ...prev, ...patch };
      const names = resolveDivisionNames(
        next.provinceCode,
        next.cityCode,
        next.district,
        next.spot
      );
      if (!nameLockedRef.current) {
        next.regionName = suggestRegionName(names);
      }
      if (!titleLockedRef.current) {
        next.title = suggestTitle(names);
      }
      return next;
    });
  };

  const resetUpload = () => {
    setPreview(null);
    setFileEntries([]);
    setConflictId('');
    nameLockedRef.current = false;
    titleLockedRef.current = false;
    setForm(emptyForm());
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleFiles = async (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    setError('');
    setSuccess('');

    try {
      const parsed = [];
      for (const file of files) {
        parsed.push(await parseSpeciesListFile(file));
      }
      let added = 0;
      setFileEntries((prev) => {
        const next = [...prev];
        parsed.forEach((item) => {
          if (next.length >= MAX_SPECIES_LIST_UPLOAD_FILES) return;
          const idx = next.findIndex((f) => f.filename === item.filename);
          if (idx >= 0) {
            next[idx] = item;
          } else {
            next.push(item);
            added += 1;
          }
        });
        return next.slice(0, MAX_SPECIES_LIST_UPLOAD_FILES);
      });
      setSuccess(
        added > 0 || parsed.length > 0
          ? `已处理 ${parsed.length} 个文件（上限 ${MAX_SPECIES_LIST_UPLOAD_FILES}），请选择省市区/鸟点后保存`
          : `文件数已达上限 ${MAX_SPECIES_LIST_UPLOAD_FILES}`
      );
    } catch (err) {
      setError(err?.message || '解析失败');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const removeFileEntry = (filename) => {
    setFileEntries((prev) => prev.filter((f) => f.filename !== filename));
  };

  const handleSave = async () => {
    if (!user) {
      setError('请先登录后再上传');
      return;
    }
    if (!preview?.species?.length) {
      setError('请先选择文件');
      return;
    }
    const names = resolveDivisionNames(
      form.provinceCode,
      form.cityCode,
      form.district,
      form.spot
    );
    if (!names.provinceName) {
      setError('请选择省份');
      return;
    }
    const regionName = form.regionName.trim() || suggestRegionName(names);
    if (!regionName) {
      setError('请填写显示名称');
      return;
    }

    setUploading(true);
    setError('');
    setSuccess('');
    try {
      // 精确冲突检测（不依赖当前列表页）
      const conflictCheck = await api.regionLists.getAll({
        exactDivision: '1',
        province: names.provinceName,
        city: names.cityName,
        district: names.districtName,
        spot: names.spotName,
        limit: '5',
        page: '1',
      });
      const conflictHit = Array.isArray(conflictCheck?.data) ? conflictCheck.data[0] : null;
      if (conflictHit?._id) {
        setConflictId(String(conflictHit._id));
        throw Object.assign(
          new Error(`「${conflictHit.regionName}」已有清单，请发布新版本`),
          { code: 'REGION_LIST_EXISTS', data: { _id: conflictHit._id } }
        );
      }

      const data = await api.regionLists.create({
        province: names.provinceName,
        city: names.cityName,
        district: names.districtName,
        spot: names.spotName,
        locationId: form.locationId || undefined,
        regionName,
        title: form.title.trim() || suggestTitle(names) || `${regionName}鸟种清单`,
        year: form.year.trim() || undefined,
        versionMonth: form.versionMonth.trim() || undefined,
        originalFilename: preview.filename,
        species: preview.species,
      });
      if (!data.success) {
        throw new Error(data.message || '保存失败');
      }

      const savedId = data.data?._id;
      const msg = data.message || `已保存「${regionName}」`;
      setSuccess(msg);
      setShowUpload(false);
      resetUpload();
      await fetchLists();

      if (typeof window !== 'undefined' && window.showToast) {
        window.showToast(msg, 'success', 2500);
      }

      if (savedId) {
        router.push(`/birds/regions/${savedId}`);
        return;
      }
    } catch (err) {
      if (err?.code === 'REGION_LIST_EXISTS' && err?.data?._id) {
        setConflictId(String(err.data._id));
        setError(err.message || '该地区已有清单');
        return;
      }
      setConflictId('');
      setError(err?.message || '保存失败，请确认后端已重启并已登录');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id, regionName) => {
    const ok = await ask(`确定删除「${regionName}」清单？`);
    if (!ok) return;
    try {
      const data = await api.regionLists.delete(id);
      if (!data.success) throw new Error(data.message || '删除失败');
      setSuccess('已删除');
      await fetchLists();
    } catch (err) {
      setError(err?.message || '删除失败');
    }
  };

  return (
    <div className={styles.container}>
      <Navbar />
      <main className={styles.main}>
        <SimplePageHeader
          title="各地鸟种"
          description="按省看地区清单和已见进度"
          descriptionVariant="caption"
          actions={
            user ? (
              <HeaderPrimaryButton
                onClick={() => {
                  setShowUpload((v) => !v);
                  setError('');
                  setSuccess('');
                }}
              >
                {showUpload ? '收起上传' : '上传清单'}
              </HeaderPrimaryButton>
            ) : null
          }
        />

        {showUpload ? (
          <section className={styles.uploadCard}>
            <p className={styles.uploadHint}>
              支持鸟种清单表格（.xls / .xlsx）。先选省市区与鸟点，可一次选多个文件合并（同种记录次数相加）；同一地区已有清单时请「发布新版本」。
            </p>
            {existingSameRegion || conflictId ? (
              <div className={styles.existsBanner}>
                <span>
                  「{(existingSameRegion || {}).regionName || '该地区'}」已有清单，请发布新版本而不是重复创建。
                </span>
                <Link
                  href={`/birds/regions/${existingSameRegion?._id || conflictId}?publish=1`}
                >
                  去发布新版本 →
                </Link>
              </div>
            ) : null}
            <div className={styles.formGrid}>
              <label>
                省份 *
                <select
                  value={form.provinceCode}
                  onChange={(e) => {
                    const provinceCode = e.target.value;
                    patchDivision({ provinceCode, cityCode: '', district: '' });
                  }}
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
                  value={form.cityCode}
                  disabled={!form.provinceCode}
                  onChange={(e) => patchDivision({ cityCode: e.target.value })}
                >
                  <option value="">全省 / 未指定市</option>
                  {cityOptions.map((c) => (
                    <option key={`${c.code}-${c.name}`} value={c.code}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                区县
                <input
                  value={form.district}
                  onChange={(e) => patchDivision({ district: e.target.value })}
                  placeholder="可选，如：余杭区"
                  disabled={!form.provinceCode}
                />
              </label>
              <label className={styles.spotField}>
                鸟点
                <LocationAutocomplete
                  value={form.spot}
                  showHint={false}
                  placeholder="可选：搜索地点名录，如五常湿地"
                  onChange={(loc) => {
                    const spotName = String(loc?.name || '').trim();
                    const districtFromLoc = String(loc?.address?.district || '').trim();
                    patchDivision({
                      spot: spotName,
                      locationId: loc?._id ? String(loc._id) : '',
                      ...(districtFromLoc && !form.district
                        ? { district: districtFromLoc }
                        : {}),
                    });
                  }}
                />
              </label>
              <label>
                显示名称 *
                <input
                  value={form.regionName}
                  onChange={(e) => {
                    nameLockedRef.current = true;
                    setForm((prev) => ({ ...prev, regionName: e.target.value }));
                  }}
                  placeholder="卡片上显示的名称"
                />
              </label>
              <label>
                清单标题
                <input
                  value={form.title}
                  onChange={(e) => {
                    titleLockedRef.current = true;
                    setForm((prev) => ({ ...prev, title: e.target.value }));
                  }}
                  placeholder="可选"
                />
              </label>
              <label>
                版本年份
                <input
                  value={form.year}
                  onChange={(e) => setForm((prev) => ({ ...prev, year: e.target.value }))}
                  placeholder="如 2026"
                />
              </label>
              <label>
                版本月份
                <select
                  value={form.versionMonth}
                  onChange={(e) => setForm((prev) => ({ ...prev, versionMonth: e.target.value }))}
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
            <div className={styles.uploadRow}>
              <input
                ref={fileRef}
                type="file"
                accept=".xls,.xlsx,.xlsm,.csv"
                multiple
                onChange={handleFiles}
                className={styles.fileInputHidden}
              />
              <button
                type="button"
                className={styles.addFileBtn}
                onClick={() => fileRef.current?.click()}
              >
                {fileEntries.length ? '+ 继续添加文件' : '选择清单文件'}
              </button>
              {fileEntries.length > 0 ? (
                <ul className={styles.fileChipList}>
                  {fileEntries.map((entry) => (
                    <li key={entry.filename} className={styles.fileChip}>
                      <span>
                        {entry.filename}
                        <em>（{entry.species.length} 种）</em>
                      </span>
                      <button
                        type="button"
                        className={styles.fileChipRemove}
                        onClick={() => removeFileEntry(entry.filename)}
                        aria-label={`移除 ${entry.filename}`}
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>

            {preview ? (
              <div className={styles.previewBox}>
                <div className={styles.previewMeta}>
                  <strong>
                    {preview.fileCount > 1
                      ? `${preview.fileCount} 个文件合并`
                      : preview.filenames?.[0] || preview.filename}
                  </strong>
                  <span>
                    共 {preview.species.length} 种
                    {preview.mergeHits > 0 ? `（累加 ${preview.mergeHits} 次同种）` : ''}
                  </span>
                </div>
                <div className={styles.previewTableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>编号</th>
                        <th>中文名</th>
                        <th>拉丁学名</th>
                        <th>目</th>
                        <th>科</th>
                        <th>记录次数</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.sample.map((row) => (
                        <tr key={`${row.code}-${row.name}`}>
                          <td>{row.code || '—'}</td>
                          <td>{row.name}</td>
                          <td>
                            <em>{row.scientificName || '—'}</em>
                          </td>
                          <td>{row.order || '—'}</td>
                          <td>{row.family || '—'}</td>
                          <td>{row.recordCount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {preview.species.length > preview.sample.length ? (
                  <p className={styles.previewMore}>… 仅预览前 {preview.sample.length} 行</p>
                ) : null}
                <div className={styles.uploadActions}>
                  <button type="button" className={styles.secondaryBtn} onClick={resetUpload}>
                    清空重选
                  </button>
                  <button
                    type="button"
                    className={styles.primaryBtn}
                    onClick={handleSave}
                    disabled={
                      uploading ||
                      !form.provinceCode ||
                      !form.regionName.trim() ||
                      Boolean(existingSameRegion) ||
                      Boolean(conflictId)
                    }
                  >
                    {uploading ? '保存中…' : '保存清单'}
                  </button>
                </div>
              </div>
            ) : null}
          </section>
        ) : null}

        <div className={styles.foldPanel} aria-label="搜索与省地图">
          <button
            type="button"
            className={styles.foldToggle}
            onClick={() => {
              setFilterPanelOpen((prev) => {
                const next = !prev;
                writeRegionsFilterPanelOpen(next);
                return next;
              });
            }}
            aria-expanded={filterPanelOpen}
          >
            <span className={styles.foldToggleTitle}>筛选</span>
            <span className={styles.foldToggleSummary}>
              {(() => {
                const parts = [];
                if (query.trim()) parts.push(`搜索「${query.trim()}」`);
                if (selectedProvince) parts.push(selectedProvince);
                if (parts.length === 0) return '搜索 · 省地图';
                return parts.join(' · ');
              })()}
            </span>
            <span className={styles.foldToggleChevron} aria-hidden="true">
              {filterPanelOpen ? '▴' : '▾'}
            </span>
          </button>
          <div
            className={`${styles.foldBody} ${filterPanelOpen ? '' : styles.foldBodyHidden}`}
            hidden={!filterPanelOpen}
          >
              <div className={styles.toolbar}>
                <input
                  className={styles.searchInput}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="搜索省 / 市 / 区 / 名称…"
                />
                <button type="button" className={styles.secondaryBtn} onClick={fetchLists}>
                  刷新
                </button>
              </div>

              {!loading && lists.length > 0 ? (
                <section className={styles.mapCard} aria-label="省级鸟种概览地图">
                  <div className={styles.mapCardHeader}>
                    <h2 className={styles.mapCardTitle}>省级概览</h2>
                    <p className={styles.mapCardHint}>悬浮查看数量，点击省份筛选下方清单</p>
                  </div>
                  <ChinaProvinceMap
                    className={styles.mapCanvas}
                    statsByProvince={statsByProvince}
                    selectedProvince={selectedProvince}
                    onSelectProvince={handleSelectProvince}
                  />
                  {selectedProvince ? (
                    <div className={styles.mapFilterBar}>
                      <span className={styles.mapFilterChip}>当前：{selectedProvince}</span>
                      <button
                        type="button"
                        className={styles.mapFilterClear}
                        onClick={() => setSelectedProvince('')}
                      >
                        清除筛选
                      </button>
                    </div>
                  ) : null}
                </section>
              ) : null}
          </div>
        </div>

        {error ? <div className={styles.errorBanner}>{error}</div> : null}
        {success ? <div className={styles.successBanner}>{success}</div> : null}

        {!loading && lists.length > 0 ? (
          <div className={styles.listMeta}>
            <div className={styles.listMetaLead}>
              <span className={styles.listMetaCount}>
                {selectedProvince
                  ? `${visibleProvinceGroups.reduce((sum, [, items]) => sum + items.length, 0)} 份`
                  : `${provinceGroups.length} 省`}
              </span>
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
            </div>
          </div>
        ) : null}

        {loading ? (
          <PageState type="loading" title="加载各地鸟种…" />
        ) : lists.length === 0 ? (
          <PageState
            type="empty"
            title="还没有地区清单"
            message={user ? '上传地区鸟种清单开始收集。' : '登录后可上传地区鸟种清单。'}
          />
        ) : visibleProvinceGroups.length === 0 ? (
          <PageState
            type="empty"
            title={`${selectedProvince || '该省'}暂无清单`}
            message="换一个省份，或清除地图筛选查看全部。"
          />
        ) : (
          <div className={styles.provinceGroups}>
            {!selectedProvince ? (
              <div className={styles.cardGrid}>
                {(() => {
                  const usedUrls = new Set();
                  return visibleProvinceGroups.map(([provinceName, items]) => {
                    const nested = groupProvinceItems(items);
                    const hero =
                      nested.provinceLists[0] ||
                      nested.cityGroups[0]?.lists[0] ||
                      nested.cityGroups[0]?.spots[0] ||
                      items[0];
                    const cover = resolveRegionListCover(hero, usedUrls, coverSet);
                    return (
                      <ProvinceOverviewCard
                        key={provinceName}
                        provinceName={provinceName}
                        items={items}
                        onOpen={handleSelectProvince}
                        cover={cover}
                      />
                    );
                  });
                })()}
              </div>
            ) : (
              visibleProvinceGroups.map(([provinceName, items]) => {
                const nested = groupProvinceItems(items);
                const usedUrls = new Set();
                return (
                  <section
                    key={provinceName}
                    id={`province-${provinceName}`}
                    className={styles.provinceGroup}
                  >
                    <h3 className={styles.provinceHeading}>
                      {provinceName}
                      <span className={styles.provinceCount}>{items.length}</span>
                    </h3>

                    {nested.provinceLists.length ? (
                      <div className={styles.heroGrid}>
                        {nested.provinceLists.map((item) => (
                          <RegionListCard
                            key={item._id}
                            item={item}
                            user={user}
                            onDelete={handleDelete}
                            cover={resolveRegionListCover(item, usedUrls, coverSet)}
                            size="hero"
                          />
                        ))}
                      </div>
                    ) : null}

                    {nested.cityGroups.map((city) => (
                      <div key={city.cityName} className={styles.cityBlock}>
                        <h4 className={styles.cityHeading}>{city.cityName}</h4>
                        {city.lists.length ? (
                          <div className={styles.cityGrid}>
                            {city.lists.map((item) => (
                              <RegionListCard
                                key={item._id}
                                item={item}
                                user={user}
                                onDelete={handleDelete}
                                cover={resolveRegionListCover(item, usedUrls, coverSet)}
                                size="city"
                              />
                            ))}
                          </div>
                        ) : null}
                        {city.spots.length ? (
                          <div className={styles.spotGrid}>
                            {city.spots.map((item) => (
                              <RegionListCard
                                key={item._id}
                                item={item}
                                user={user}
                                onDelete={handleDelete}
                                cover={resolveRegionListCover(item, usedUrls, coverSet)}
                                size="spot"
                              />
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </section>
                );
              })
            )}
          </div>
        )}
      </main>
      <Footer />
      {confirmDialog}
    </div>
  );
}
