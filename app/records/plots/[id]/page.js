'use client';

import { useCallback, useEffect, useMemo, useState, Fragment } from 'react';
import { formatDisplayDate as formatDate } from '@/utils/localDate';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import * as XLSX from 'xlsx';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import SimplePageHeader, {
  HeaderPrimaryButton,
  HeaderDangerButton,
} from '@/components/SimplePageHeader';
import PageState from '@/components/PageState';
import { useConfirmDialog } from '@/components/ConfirmDialog';
import HabitatGallery from '@/components/HabitatGallery';
import BirdNameAutocomplete from '@/components/BirdNameAutocomplete';
import BirdSearchField from '@/components/BirdSearchField';
import SpeciesLedgerBrowse from '@/components/SpeciesLedgerBrowse';
import { useAuth } from '@/components/AuthProvider';
import { api } from '@/utils/api';
import {
  orderDisplayName,
  orderGroupKey,
  orderLatinSubtitle,
} from '@/utils/taxonomyOrderUi';
import { speciesMatchesSearch } from '@/utils/clientPinyinMatch';
import { BIRD_SEARCH_PLACEHOLDER, BIRD_SEARCH_PLACEHOLDER_TAXON } from '@/utils/birdSearchUi';
import { extractCoords as extractCoordsBase } from '@/utils/locationCoords';
import styles from '@/styles/PersonalPlots.module.css';
import regionStyles from '@/styles/RegionBirdLists.module.css';

const BirdMapProvider = dynamic(() => import('@/components/BirdMapProvider'), {
  ssr: false,
});

const SOURCE_LABEL = {
  cbrc: '记录中心',
  manual: '手动',
  other: '其他',
};

function scopeLabel(plot) {
  return [plot?.province, plot?.city, plot?.district, plot?.spot].filter(Boolean).join(' · ') || '未填范围';
}

function extractCoords(location) {
  const coords = extractCoordsBase(location);
  if (!coords || (coords.lat === 0 && coords.lng === 0)) return null;
  return coords;
}

/** 从「省市区 + 短地名」长地址拆出短地名，便于词典匹配 */
function spotCandidatesFromText(text) {
  const raw = String(text || '').trim();
  if (!raw) return [];
  const out = [raw];
  let rest = raw;
  const provinceMatch = rest.match(
    /^(北京市|天津市|上海市|重庆市|[^省]+省|[^自治区]+自治区|[^特别行政区]+特别行政区)/
  );
  if (provinceMatch) rest = rest.slice(provinceMatch[1].length);
  const cityMatch = rest.match(/^([^市]+市|[^州]+自治州|[^地区]+地区|[^盟]+盟)/);
  if (cityMatch) {
    out.push(cityMatch[1]);
    rest = rest.slice(cityMatch[1].length);
  }
  const districtMatch = rest.match(/^(.+?(?:区|县|旗|市|自治县|自治旗))/);
  if (districtMatch && rest.length > districtMatch[1].length) {
    out.push(districtMatch[1]);
    rest = rest.slice(districtMatch[1].length);
  }
  const spot = rest.trim();
  if (spot) out.push(spot);
  return [...new Set(out.filter((v) => v && v.length >= 2))];
}

/** 前端预览：报告列表编号（与后端解析大致对齐） */
function previewReportListFile(rows) {
  if (!Array.isArray(rows) || rows.length < 2) {
    return { error: '内容不足', reportIds: [] };
  }

  const normalize = (cell) => String(cell ?? '').replace(/\s+/g, '').trim();
  const findHeaderIndex = () => {
    const max = Math.min(rows.length, 40);
    for (let i = 0; i < max; i++) {
      const cells = (rows[i] || []).map(normalize);
      const hasReportId = cells.some((c) => /报告编号/.test(c));
      const hasMeta = cells.some((c) => /观测时间|观测地点|记录用户|公开状态/.test(c));
      const hasCn = cells.some((c) => /中文名|鸟种中文|^鸟名$/.test(c));
      if (hasReportId && hasMeta && !hasCn) return i;
    }
    return -1;
  };

  const headerIndex = findHeaderIndex();
  if (headerIndex < 0) {
    return { error: '无法识别为报告列表表头', reportIds: [] };
  }

  const header = (rows[headerIndex] || []).map(normalize);
  let colId = header.findIndex((h) => /报告编号/.test(h));
  if (colId < 0) colId = 0;

  const seen = new Set();
  const reportIds = [];
  for (let i = headerIndex + 1; i < rows.length; i++) {
    const id = String(rows[i]?.[colId] ?? '').trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    reportIds.push(id);
  }

  if (!reportIds.length) {
    return { error: '没有可用报告编号', reportIds: [] };
  }
  return { error: '', reportIds };
}

/** 前端预览：统计报告鸟种明细表行数（与后端解析规则大致对齐） */
function previewReportBirdsFile(rows) {
  if (!Array.isArray(rows) || rows.length < 2) {
    return { error: '内容不足', birdCount: 0, byReport: {}, hasReportIdColumn: false };
  }

  const normalize = (cell) => String(cell ?? '').replace(/\s+/g, '').trim();
  const findHeaderIndex = () => {
    const max = Math.min(rows.length, 40);
    for (let i = 0; i < max; i++) {
      const cells = (rows[i] || []).map(normalize);
      const joined = cells.join('|');
      const hasCn = cells.some((c) => /中文名|鸟种中文|中文名称|^鸟名$/.test(c));
      const hasLatin = cells.some((c) => /拉丁|学名/.test(c));
      const hasCode = cells.some((c) => /鸟种编号/.test(c));
      if ((hasCn && (hasLatin || hasCode)) || (hasCn && /报告编号/.test(joined))) {
        return i;
      }
    }
    return -1;
  };

  const headerIndex = findHeaderIndex();
  if (headerIndex < 0) {
    return { error: '无法识别表头', birdCount: 0, byReport: {}, hasReportIdColumn: false };
  }

  const header = (rows[headerIndex] || []).map(normalize);
  const findCol = (patterns, fallback = -1) => {
    for (let i = 0; i < header.length; i++) {
      if (patterns.some((re) => re.test(header[i]))) return i;
    }
    return fallback;
  };

  const colReport = findCol([/报告编号/], -1);
  const colCn = findCol([/中文名/, /鸟种中文/, /中文名称/, /^鸟名$/], 1);
  const colLatin = findCol([/拉丁学名/, /拉丁名/, /^学名$/], 2);

  const byReport = {};
  let birdCount = 0;
  for (let i = headerIndex + 1; i < rows.length; i++) {
    const row = rows[i] || [];
    const name = String(row[colCn] ?? '').trim();
    const scientificName = String(row[colLatin] ?? '').trim();
    if (!name && !scientificName) continue;
    birdCount += 1;
    const reportId = colReport >= 0 ? String(row[colReport] ?? '').trim() : '';
    const key = reportId || '__none__';
    byReport[key] = (byReport[key] || 0) + 1;
  }

  if (!birdCount) {
    return { error: '没有可用鸟种行', birdCount: 0, byReport: {}, hasReportIdColumn: colReport >= 0 };
  }

  return {
    error: '',
    birdCount,
    byReport,
    hasReportIdColumn: colReport >= 0,
  };
}

export default function PersonalPlotDetailPage() {
  const params = useParams();
  const plotId = params?.id;
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, token, loading: authLoading } = useAuth();

  const [plot, setPlot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const { ask, dialog: confirmDialog } = useConfirmDialog();
  const [message, setMessage] = useState('');
  const [messageError, setMessageError] = useState(false);
  const [expandedId, setExpandedId] = useState(null);

  const [showEditor, setShowEditor] = useState(false);
  const [editorTab, setEditorTab] = useState('import'); // import | manual

  const [filterObserver, setFilterObserver] = useState('');
  const [filterSource, setFilterSource] = useState('');
  const [filterYear, setFilterYear] = useState('');
  const [filterQ, setFilterQ] = useState('');
  const [orderFilter, setOrderFilter] = useState('');
  const [familyFilter, setFamilyFilter] = useState('');
  const [summarySearch, setSummarySearch] = useState('');
  const [sortBy, setSortBy] = useState('times');
  const [sortOrder, setSortOrder] = useState('desc');

  const toggleSpeciesSort = useCallback(
    (field, defaultOrder = 'desc') => {
      if (sortBy === field) {
        setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
        return;
      }
      setSortBy(field);
      setSortOrder(defaultOrder);
    },
    [sortBy]
  );

  const [birdName, setBirdName] = useState('');
  const [birdId, setBirdId] = useState('');
  const [scientificName, setScientificName] = useState('');
  const [entryDate, setEntryDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [entryObserver, setEntryObserver] = useState('');
  const [entrySource, setEntrySource] = useState('manual');
  const [entryNote, setEntryNote] = useState('');

  const [listRows, setListRows] = useState(null);
  const [listFileName, setListFileName] = useState('');
  const [birdsRows, setBirdsRows] = useState(null);
  const [birdsFileName, setBirdsFileName] = useState('');
  const [selectedReportId, setSelectedReportId] = useState('');
  const [cbrcObserver, setCbrcObserver] = useState('');
  const [cbrcDate, setCbrcDate] = useState(() => new Date().toISOString().slice(0, 10));

  const [editingIntro, setEditingIntro] = useState(false);
  const [introDraft, setIntroDraft] = useState('');
  const [mapPins, setMapPins] = useState([]);
  const [mapStatus, setMapStatus] = useState('idle'); // idle|loading|ready|empty
  const [primaryMapLocation, setPrimaryMapLocation] = useState(null);
  const [resolvedHabitatImages, setResolvedHabitatImages] = useState([]);

  const showMsg = (text, isError = false) => {
    setMessage(text);
    setMessageError(isError);
  };

  const load = useCallback(async () => {
    if (!plotId) return;
    setLoading(true);
    try {
      const data = await api.personal.getPlotById(plotId);
      if (!data.success) {
        showMsg(data.message || '加载失败', true);
        setPlot(null);
        return;
      }
      setPlot(data.data);
    } catch (error) {
      const msg =
        error?.code === 'BACKEND_UNREACHABLE' || Number(error?.status) === 503
          ? '无法连接后端 API，请确认后端服务已启动且地址配置正确'
          : error.message || '加载失败';
      showMsg(msg, true);
      setPlot(null);
    } finally {
      setLoading(false);
    }
  }, [plotId]);

  useEffect(() => {
    if (!authLoading && (!user || !token)) {
      router.push('/login');
      return;
    }
    if (user && token && plotId) load();
  }, [authLoading, user, token, plotId, router, load]);

  useEffect(() => {
    if (user?.name && !entryObserver) {
      setEntryObserver(user.name);
      setCbrcObserver(user.name);
    }
  }, [user, entryObserver]);

  const applyPlot = (data) => {
    if (data?.data) setPlot(data.data);
  };

  useEffect(() => {
    if (!plot) return;
    if (!editingIntro) setIntroDraft(plot.notes || '');
  }, [plot, editingIntro]);

  // Fingerprint location-related fields so map/habitat resolve does not re-run on unrelated plot edits.
  const mapResolveKey = useMemo(() => {
    if (!plot) return '';
    const reportLocs = (plot.reports || [])
      .map((r) =>
        [String(r.locationId || '').trim(), String(r.locationText || '').trim()]
          .filter(Boolean)
          .join('@')
      )
      .filter(Boolean)
      .join('|');
    return [
      plot._id || plotId,
      plot.locationId || '',
      plot.title || '',
      plot.spot || '',
      plot.district || '',
      plot.city || '',
      plot.province || '',
      reportLocs,
    ].join('::');
  }, [plot, plotId]);

  // 大地图 + 范围内生境图：关联地点、报告 locationId、报告观测地点词典匹配
  useEffect(() => {
    let cancelled = false;
    if (!plot || !mapResolveKey) {
      setMapPins([]);
      setPrimaryMapLocation(null);
      setResolvedHabitatImages([]);
      setMapStatus('idle');
      return undefined;
    }

    const run = async () => {
      setMapStatus('loading');
      const pins = [];
      const seenCoords = new Set();
      const seenLocIds = new Set();
      const habitatByUrl = new Map();
      const representative = [];
      const extras = [];
      let primary = null;

      const collectHabitat = (loc) => {
        if (!loc) return;
        const locId = loc._id ? String(loc._id) : '';
        const locName = String(loc.name || '').trim() || '未命名地点';
        const images = Array.isArray(loc.images) ? loc.images : [];
        let firstKept = false;
        images.forEach((img) => {
          const url = typeof img === 'string' ? img : String(img?.url || '').trim();
          if (!url || habitatByUrl.has(url)) return;
          const item = {
            url,
            caption: locName,
            locationId: locId,
            locationName: locName,
          };
          habitatByUrl.set(url, item);
          if (!firstKept) {
            representative.push(item);
            firstKept = true;
          } else {
            extras.push(item);
          }
        });
      };

      const addLoc = (loc, label) => {
        if (!loc) return false;
        const locId = loc._id ? String(loc._id) : '';
        if (locId && seenLocIds.has(locId)) {
          collectHabitat(loc);
          return true;
        }
        if (locId) seenLocIds.add(locId);
        collectHabitat(loc);

        const coords = extractCoords(loc);
        if (!coords) return Boolean(locId);
        const key = `${coords.lat.toFixed(5)},${coords.lng.toFixed(5)}`;
        if (seenCoords.has(key)) return true;
        seenCoords.add(key);
        pins.push({
          lat: coords.lat,
          lng: coords.lng,
          name: label || loc.name || '地点',
        });
        if (!primary) primary = loc;
        return true;
      };

      if (plot.locationId) {
        try {
          const data = await api.locations.getById(plot.locationId);
          if (!cancelled && data?.success && data.data) {
            addLoc(data.data, data.data.name);
            primary = data.data;
          }
        } catch {
          // ignore
        }
      }

      const reportLocationIds = [
        ...new Set(
          (plot.reports || [])
            .map((r) => String(r.locationId || '').trim())
            .filter(Boolean)
        ),
      ].slice(0, 24);
      for (const locId of reportLocationIds) {
        if (cancelled) return;
        if (seenLocIds.has(locId)) continue;
        try {
          const data = await api.locations.getById(locId);
          if (data?.success && data.data) {
            addLoc(data.data, data.data.name);
          }
        } catch {
          // ignore single miss
        }
      }

      const nameCandidates = new Set();
      [plot.title, plot.spot, plot.district, plot.city].filter(Boolean).forEach((t) => {
        nameCandidates.add(String(t).trim());
      });
      if (plot.province && plot.city) {
        nameCandidates.add(`${plot.province}${plot.city}`);
      }
      (plot.reports || []).forEach((r) => {
        spotCandidatesFromText(r.locationText).forEach((c) => nameCandidates.add(c));
      });

      // 短观鸟点名优先，避免长地址占满额度且难命中
      const list = [...nameCandidates]
        .filter(Boolean)
        .sort((a, b) => a.length - b.length || a.localeCompare(b, 'zh-CN'))
        .slice(0, 40);
      for (const name of list) {
        if (cancelled) return;
        try {
          const data = await api.locations.getByName(name);
          if (data?.code === 'LOCATION_LOOKUP_SKIPPED') break;
          if (data?.success && data.data) {
            addLoc(data.data, data.data.name);
          }
        } catch (error) {
          // Backend down / unexpected — stop probing more names
          if (
            error?.code === 'BACKEND_UNREACHABLE' ||
            Number(error?.status) === 0 ||
            Number(error?.status) >= 500
          ) {
            break;
          }
        }
      }

      if (cancelled) return;
      const habitatList = [...representative, ...extras].slice(0, 24);
      setMapPins(pins);
      setPrimaryMapLocation(primary);
      setResolvedHabitatImages(habitatList);
      setMapStatus(pins.length ? 'ready' : 'empty');
    };

    run();
    return () => {
      cancelled = true;
    };
    // plot is read inside run; mapResolveKey covers location-relevant changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional fingerprint gate
  }, [mapResolveKey]);

  const mapCenter = useMemo(() => {
    // 无点位时用中国大致中心，避免写死某地个人坐标
    if (!mapPins.length) return { lat: 35.8617, lng: 104.1954 };
    const lat = mapPins.reduce((s, p) => s + p.lat, 0) / mapPins.length;
    const lng = mapPins.reduce((s, p) => s + p.lng, 0) / mapPins.length;
    return { lat, lng };
  }, [mapPins]);

  // 优先用后端 enrich 的 habitatImages（报告点位匹配），前端解析结果作补充
  const habitatImages = useMemo(() => {
    const byUrl = new Map();
    const push = (img) => {
      const url = typeof img === 'string' ? String(img).trim() : String(img?.url || '').trim();
      if (!url || byUrl.has(url)) return;
      byUrl.set(url, {
        url,
        caption: img?.caption || img?.locationName || '',
        locationId: img?.locationId || '',
        locationName: img?.locationName || img?.caption || '',
      });
    };
    (Array.isArray(plot?.habitatImages) ? plot.habitatImages : []).forEach(push);
    (Array.isArray(resolvedHabitatImages) ? resolvedHabitatImages : []).forEach(push);
    return [...byUrl.values()].slice(0, 24);
  }, [plot?.habitatImages, resolvedHabitatImages]);

  const handleSaveIntro = async () => {
    if (!plotId) return;
    setBusy(true);
    showMsg('');
    try {
      const data = await api.personal.updatePlot(plotId, {
        notes: introDraft.trim(),
      });
      if (!data.success) {
        showMsg(data.message || '保存介绍失败', true);
        return;
      }
      applyPlot(data);
      setEditingIntro(false);
      showMsg('介绍已保存');
    } catch (error) {
      showMsg(error.message || '保存介绍失败', true);
    } finally {
      setBusy(false);
    }
  };

  const handleLinkPrimaryLocation = async () => {
    if (!plotId || !primaryMapLocation?._id) return;
    setBusy(true);
    showMsg('');
    try {
      const data = await api.personal.updatePlot(plotId, {
        locationId: primaryMapLocation._id,
      });
      if (!data.success) {
        showMsg(data.message || '关联地点失败', true);
        return;
      }
      applyPlot(data);
      showMsg(`已关联地点词典「${primaryMapLocation.name}」`);
    } catch (error) {
      showMsg(error.message || '关联地点失败', true);
    } finally {
      setBusy(false);
    }
  };

  const allSpecies = useMemo(
    () => (Array.isArray(plot?.species) ? plot.species : []),
    [plot]
  );

  const matchesSummaryQuery = useCallback((row, q) => {
    if (!q) return true;
    return speciesMatchesSearch(row, q, {
      orderLabel: orderDisplayName(row.order || '未分类'),
    });
  }, []);

  const orderCards = useMemo(() => {
    const q = summarySearch.trim().toLowerCase();
    const fullMap = new Map();
    allSpecies.forEach((row) => {
      const key = orderGroupKey(row.order);
      if (!fullMap.has(key)) fullMap.set(key, { key, speciesCount: 0, times: 0 });
      const node = fullMap.get(key);
      node.speciesCount += 1;
      node.times += Number(row.times) || 0;
    });

    const visibleKeys = new Set();
    allSpecies.forEach((row) => {
      if (!matchesSummaryQuery(row, q)) return;
      visibleKeys.add(orderGroupKey(row.order));
    });

    const totalSpecies = allSpecies.length || 1;
    return Array.from(fullMap.values())
      .filter((node) => visibleKeys.has(node.key))
      .map((node) => ({
        ...node,
        pct: Math.round((node.speciesCount / totalSpecies) * 100),
        label: orderDisplayName(node.key),
        latin: orderLatinSubtitle(node.key),
      }))
      .sort((a, b) => a.label.localeCompare(b.label, 'zh'));
  }, [allSpecies, summarySearch, matchesSummaryQuery]);

  const filterOptions = useMemo(() => {
    const orderKeys = [
      ...new Set(
        allSpecies.map((s) => orderGroupKey(s.order)).filter((k) => k && k !== '未分类')
      ),
    ].sort((a, b) => orderDisplayName(a).localeCompare(orderDisplayName(b), 'zh'));
    const families = [...new Set(allSpecies.map((s) => s.family).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b, 'zh')
    );
    return { orders: orderKeys, families };
  }, [allSpecies]);

  const filteredSpecies = useMemo(() => {
    const q = filterQ.trim().toLowerCase();
    const summaryQ = summarySearch.trim().toLowerCase();
    const yearNum = filterYear ? Number.parseInt(filterYear, 10) : NaN;
    let list = allSpecies.filter((s) => matchesSummaryQuery(s, summaryQ));

    if (orderFilter) {
      const orderKey = orderGroupKey(orderFilter);
      list = list.filter((s) => orderGroupKey(s.order) === orderKey);
    }
    if (familyFilter) {
      list = list.filter((s) => String(s.family || '') === familyFilter);
    }
    if (q) {
      list = list.filter((s) =>
        speciesMatchesSearch(s, q, {
          orderLabel: orderDisplayName(s.order || '未分类'),
        })
      );
    }
    if (filterObserver) {
      const obsQ = filterObserver.trim();
      list = list.filter((s) => (s.observers || []).join(' ').includes(obsQ));
    }
    if (filterSource) {
      list = list.filter((s) => (s.sources || []).includes(filterSource));
    }
    if (Number.isFinite(yearNum)) {
      list = list.filter((s) =>
        (s.entries || []).some((e) => {
          const d = e.date ? new Date(e.date) : null;
          return d && !Number.isNaN(d.getTime()) && d.getFullYear() === yearNum;
        })
      );
    }

    const dir = sortOrder === 'asc' ? 1 : -1;
    return [...list].sort((a, b) => {
      if (sortBy === 'times') return ((a.times || 0) - (b.times || 0)) * dir;
      if (sortBy === 'firstSeenAt' || sortBy === 'lastSeenAt') {
        const av = a[sortBy] ? new Date(a[sortBy]).getTime() : NaN;
        const bv = b[sortBy] ? new Date(b[sortBy]).getTime() : NaN;
        const aMissing = !Number.isFinite(av);
        const bMissing = !Number.isFinite(bv);
        if (aMissing && bMissing) {
          return String(a.name || '').localeCompare(String(b.name || ''), 'zh');
        }
        if (aMissing) return 1;
        if (bMissing) return -1;
        return (av - bv) * dir;
      }
      if (sortBy === 'name') {
        return String(a.name || '').localeCompare(String(b.name || ''), 'zh') * dir;
      }
      return String(a.name || '').localeCompare(String(b.name || ''), 'zh');
    });
  }, [
    allSpecies,
    filterQ,
    summarySearch,
    orderFilter,
    familyFilter,
    filterObserver,
    filterSource,
    filterYear,
    sortBy,
    sortOrder,
    matchesSummaryQuery,
  ]);

  const yearOptions = useMemo(() => {
    const years = new Set();
    allSpecies.forEach((s) => {
      (s.entries || []).forEach((e) => {
        const d = e.date ? new Date(e.date) : null;
        if (d && !Number.isNaN(d.getTime())) years.add(d.getFullYear());
      });
    });
    return [...years].sort((a, b) => b - a);
  }, [allSpecies]);

  const handleAddEntry = async (event) => {
    event.preventDefault();
    if (!birdName.trim()) {
      showMsg('请填写鸟种', true);
      return;
    }
    if (!entryDate) {
      showMsg('请填写日期', true);
      return;
    }
    setBusy(true);
    showMsg('');
    try {
      const data = await api.personal.addPlotEntry(plotId, {
        birdId: birdId || undefined,
        name: birdName.trim(),
        scientificName: scientificName || undefined,
        date: entryDate,
        observer: entryObserver,
        source: entrySource,
        note: entryNote,
      });
      if (!data.success) {
        showMsg(data.message || '添加失败', true);
        return;
      }
      applyPlot(data);
      setBirdName('');
      setBirdId('');
      setScientificName('');
      setEntryNote('');
      showMsg('已添加观察条目');
    } catch (error) {
      showMsg(error.message || '添加失败', true);
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteSpecies = async (speciesId) => {
    const ok = await ask('确定删除该鸟种及其全部条目？');
    if (!ok) return;
    setBusy(true);
    try {
      const data = await api.personal.deletePlotSpecies(plotId, speciesId);
      if (!data.success) {
        showMsg(data.message || '删除失败', true);
        return;
      }
      applyPlot(data);
      showMsg('已删除鸟种');
    } catch (error) {
      showMsg(error.message || '删除失败', true);
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteEntry = async (speciesId, entryId) => {
    const ok = await ask('确定删除这条观察条目？');
    if (!ok) return;
    setBusy(true);
    try {
      const data = await api.personal.deletePlotEntry(plotId, speciesId, entryId);
      if (!data.success) {
        showMsg(data.message || '删除失败', true);
        return;
      }
      applyPlot(data);
    } catch (error) {
      showMsg(error.message || '删除失败', true);
    } finally {
      setBusy(false);
    }
  };

  const handleDeletePlot = async () => {
    const ok = await ask('确定删除整块自留地？删除后不能恢复。');
    if (!ok) return;
    setBusy(true);
    try {
      const data = await api.personal.deletePlot(plotId);
      if (!data.success) {
        showMsg(data.message || '删除失败', true);
        return;
      }
      router.push('/records/plots');
    } catch (error) {
      showMsg(error.message || '删除失败', true);
      setBusy(false);
    }
  };

  const readXlsRows = async (file) => {
    const extension = String(file.name || '').toLowerCase().split('.').pop();
    if (!['xls', 'xlsx'].includes(extension)) {
      throw new Error('请上传 XLS / XLSX');
    }
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    const firstSheetName = workbook.SheetNames?.[0];
    if (!firstSheetName) throw new Error('Excel 中没有工作表');
    const worksheet = workbook.Sheets[firstSheetName];
    const rows = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      defval: '',
      raw: false,
    });
    if (!Array.isArray(rows) || rows.length < 2) {
      throw new Error('内容不足，至少需要表头 + 1 行');
    }
    return rows.map((row) => (Array.isArray(row) ? row.map((cell) => String(cell ?? '').trim()) : []));
  };

  const handleListFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const rows = await readXlsRows(file);
      setListRows(rows);
      setListFileName(file.name);
      const preview = previewReportListFile(rows);
      if (preview.error) {
        showMsg(`已读取 ${file.name}，但${preview.error}，导入前请确认格式`, true);
      } else {
        showMsg(`已读取报告列表：${file.name}（${preview.reportIds.length} 份）`);
      }
    } catch (error) {
      setListRows(null);
      setListFileName('');
      showMsg(error.message || '读取失败', true);
    } finally {
      event.target.value = '';
    }
  };

  const handleBirdsFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const rows = await readXlsRows(file);
      setBirdsRows(rows);
      setBirdsFileName(file.name);
      const preview = previewReportBirdsFile(rows);
      if (preview.error) {
        showMsg(`已读取 ${file.name}，但${preview.error}，导入前请确认格式`, true);
      } else {
        showMsg(`已读取鸟种明细：${file.name}（约 ${preview.birdCount} 种）`);
      }
    } catch (error) {
      setBirdsRows(null);
      setBirdsFileName('');
      showMsg(error.message || '读取失败', true);
    } finally {
      event.target.value = '';
    }
  };

  const modeLabel = (mode) => {
    if (mode === 'report_list') return '报告列表';
    if (mode === 'report_birds') return '报告鸟种';
    if (mode === 'species_list') return '总清单';
    if (mode === 'report') return '宽表报告';
    return mode || '导入';
  };

  const handleImportList = async () => {
    if (!listRows) {
      showMsg('请先选择报告列表 xls', true);
      return;
    }

    if (listReportCompare && listReportCompare.total > 0) {
      if (listReportCompare.newCount === 0) {
        const ok = await ask({
          title: '确认导入',
          message: `文件 ${listReportCompare.total} 份报告均已在本自留地中（将刷新元信息，无新增）。\n\n仍要导入吗？`,
          confirmLabel: '仍要导入',
          cancelLabel: '取消',
        });
        if (!ok) return;
      } else if (listReportCompare.existingCount > 0) {
        const ok = await ask({
          title: '确认导入',
          message: `文件 ${listReportCompare.total} 份：已有 ${listReportCompare.existingCount}，将新增 ${listReportCompare.newCount}。\n\n确认导入？`,
          confirmLabel: '确认导入',
          cancelLabel: '取消',
        });
        if (!ok) return;
      }
    }

    setBusy(true);
    showMsg('');
    try {
      const data = await api.personal.importPlotCbrc(plotId, {
        rows: listRows,
        mode: 'report_list',
        force: true,
      });
      if (!data.success) {
        showMsg(data.message || '导入失败', true);
        return;
      }
      applyPlot(data);
      const s = data.summary || {};
      showMsg(
        `导入完成（${modeLabel(s.mode)}）：文件 ${s.fileCount ?? s.added + (s.updated || 0)} 份，新增 ${s.added || 0}，已有并刷新 ${s.updated || 0}。${s.hint || ''}`
      );
      setListRows(null);
      setListFileName('');
    } catch (error) {
      showMsg(error.message || '导入失败', true);
    } finally {
      setBusy(false);
    }
  };

  const handleImportBirds = async () => {
    if (!birdsRows) {
      showMsg('请先选择报告鸟种明细 xls', true);
      return;
    }
    if (!(plot?.reports || []).length && !selectedReportId) {
      showMsg('请先导入报告列表，或填写/选择报告编号', true);
      return;
    }

    const mismatch = birdsReportCompare?.mismatch;
    if (mismatch) {
      const ok = await ask({
        title: '种数不一致',
        message: `文件约 ${mismatch.fileCount} 种，关联报告 ${mismatch.reportId} 提示种数为 ${mismatch.hintCount}，不一致，可能传错了报告或文件。\n\n仍要继续导入吗？`,
        confirmLabel: '仍要导入',
        cancelLabel: '取消',
      });
      if (!ok) return;
    }

    setBusy(true);
    showMsg('');
    try {
      const data = await api.personal.importPlotCbrc(plotId, {
        rows: birdsRows,
        mode: 'report_birds',
        reportId: selectedReportId || undefined,
        defaultObserver: cbrcObserver,
        defaultDate: cbrcDate,
        force: true,
      });
      if (!data.success) {
        showMsg(data.message || '导入失败', true);
        return;
      }
      applyPlot(data);
      const s = data.summary || {};
      showMsg(
        `导入完成（${modeLabel(s.mode)}）：新增 ${s.added || 0}，跳过重复 ${s.skippedDup || 0}，未匹配 ${s.unmatchedKept || 0}。${s.hint || ''}`
      );
      setBirdsRows(null);
      setBirdsFileName('');
    } catch (error) {
      showMsg(error.message || '导入失败', true);
    } finally {
      setBusy(false);
    }
  };

  const reportRows = useMemo(() => {
    const list = Array.isArray(plot?.reports) ? [...plot.reports] : [];
    return list.sort((a, b) => {
      const ta = a.startAt ? new Date(a.startAt).getTime() : 0;
      const tb = b.startAt ? new Date(b.startAt).getTime() : 0;
      return tb - ta;
    });
  }, [plot]);

  const listFilePreview = useMemo(() => {
    if (!listRows) return null;
    return previewReportListFile(listRows);
  }, [listRows]);

  const listReportCompare = useMemo(() => {
    if (!listFilePreview || listFilePreview.error || !listFilePreview.reportIds.length) {
      return null;
    }
    const existingIds = new Set(reportRows.map((r) => String(r.reportId)));
    const newIds = [];
    const existingMatched = [];
    listFilePreview.reportIds.forEach((id) => {
      if (existingIds.has(String(id))) existingMatched.push(id);
      else newIds.push(id);
    });
    return {
      total: listFilePreview.reportIds.length,
      existingCount: existingMatched.length,
      newCount: newIds.length,
      newIds,
      existingIds: existingMatched,
    };
  }, [listFilePreview, reportRows]);

  const birdsFilePreview = useMemo(() => {
    if (!birdsRows) return null;
    return previewReportBirdsFile(birdsRows);
  }, [birdsRows]);

  /** 文件种数 vs 关联报告提示种数 */
  const birdsReportCompare = useMemo(() => {
    if (!birdsFilePreview || birdsFilePreview.error || !birdsFilePreview.birdCount) {
      return null;
    }

    const resolveHint = (reportId) => {
      const report = reportRows.find((r) => String(r.reportId) === String(reportId));
      const hint = Number(report?.speciesCountHint) || 0;
      return { report, hint };
    };

    // 用户显式选择了报告：优先按该报告对比
    if (selectedReportId) {
      const { hint } = resolveHint(selectedReportId);
      if (!hint) {
        return {
          fileCount: birdsFilePreview.birdCount,
          reportId: selectedReportId,
          hintCount: 0,
          mismatch: null,
          note: '关联报告无提示种数，跳过对比',
        };
      }
      const fileCount = birdsFilePreview.hasReportIdColumn
        ? birdsFilePreview.byReport[selectedReportId] ||
          birdsFilePreview.byReport.__none__ ||
          birdsFilePreview.birdCount
        : birdsFilePreview.birdCount;
      const mismatch =
        fileCount !== hint
          ? { fileCount, reportId: selectedReportId, hintCount: hint }
          : null;
      return { fileCount, reportId: selectedReportId, hintCount: hint, mismatch, note: '' };
    }

    // 表内自带编号：若只有一个报告编号，自动对比
    const reportIds = Object.keys(birdsFilePreview.byReport).filter((k) => k !== '__none__');
    if (reportIds.length === 1) {
      const reportId = reportIds[0];
      const fileCount = birdsFilePreview.byReport[reportId] || 0;
      const { hint } = resolveHint(reportId);
      if (!hint) {
        return {
          fileCount,
          reportId,
          hintCount: 0,
          mismatch: null,
          note: '表内报告无提示种数，跳过对比',
        };
      }
      const mismatch =
        fileCount !== hint ? { fileCount, reportId, hintCount: hint } : null;
      return { fileCount, reportId, hintCount: hint, mismatch, note: '' };
    }

    if (reportIds.length > 1) {
      const mismatches = reportIds
        .map((reportId) => {
          const fileCount = birdsFilePreview.byReport[reportId] || 0;
          const { hint } = resolveHint(reportId);
          if (!hint || fileCount === hint) return null;
          return { fileCount, reportId, hintCount: hint };
        })
        .filter(Boolean);
      return {
        fileCount: birdsFilePreview.birdCount,
        reportId: '',
        hintCount: 0,
        mismatch: mismatches[0] || null,
        mismatches,
        note:
          mismatches.length > 0
            ? `表内 ${reportIds.length} 份报告中有 ${mismatches.length} 份种数与提示不符`
            : `表内含 ${reportIds.length} 份报告编号，种数均与提示一致`,
      };
    }

    return {
      fileCount: birdsFilePreview.birdCount,
      reportId: '',
      hintCount: 0,
      mismatch: null,
      note: '未选择关联报告，无法与提示种数对比',
    };
  }, [birdsFilePreview, selectedReportId, reportRows]);

  const observerStats = useMemo(() => {
    const map = new Map();
    (plot?.species || []).forEach((s) => {
      (s.observers || []).forEach((name) => {
        const key = String(name || '').trim();
        if (!key) return;
        map.set(key, (map.get(key) || 0) + 1);
      });
    });
    return [...map.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [plot]);

  const openEditor = (tab = 'import', reportId = '') => {
    if (reportId) setSelectedReportId(reportId);
    setEditorTab(tab);
    setShowEditor(true);
  };

  // Deep-link from report detail 「补传鸟种」
  useEffect(() => {
    const importReport = searchParams?.get('importReport');
    if (!importReport || !plot) return;
    setSelectedReportId(importReport);
    setEditorTab('import');
    setShowEditor(true);
    router.replace(`/records/plots/${plotId}`, { scroll: false });
  }, [searchParams, plot, plotId, router]);

  useEffect(() => {
    if (!showEditor) return undefined;
    const timer = window.setTimeout(() => {
      document.getElementById('plot-editor')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 30);
    return () => window.clearTimeout(timer);
  }, [showEditor]);

  if (authLoading || loading) {
    return (
      <div className={styles.container}>
        <Navbar />
        <main className={styles.main}>
          <PageState type="loading" title="加载中" />
        </main>
        <Footer />
      </div>
    );
  }

  if (!plot) {
    return (
      <div className={styles.container}>
        <Navbar />
        <main className={styles.main}>
          <Link href="/records/plots" className={styles.backLink}>
            ← 返回自留地列表列表
          </Link>
          <PageState type="empty" title="自留地不存在" message={message || '可能已删除或无权访问'} />
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <Navbar />
      <main className={styles.main}>
        <Link href="/records/plots" className={styles.backLink}>
          ← 返回自留地列表
        </Link>
        <SimplePageHeader
          title={plot.title}
          description={scopeLabel(plot)}
          actions={
            <div className={styles.headerActions}>
              <HeaderPrimaryButton
                onClick={() => (showEditor ? setShowEditor(false) : openEditor('import'))}
              >
                {showEditor ? '收起录入' : '录入 / 导入'}
              </HeaderPrimaryButton>
              <HeaderDangerButton onClick={handleDeletePlot} disabled={busy}>
                删除
              </HeaderDangerButton>
            </div>
          }
        />

        {message ? (
          <div className={`${styles.message} ${messageError ? styles.messageError : ''}`}>{message}</div>
        ) : null}

        <section className={styles.statsGrid}>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>鸟种</div>
            <div className={styles.statValue}>{plot.statsCache?.speciesCount ?? 0}</div>
            <div className={styles.statSub}>去重种数</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>观察次数</div>
            <div className={styles.statValue}>{plot.statsCache?.entryCount ?? 0}</div>
            <div className={styles.statSub}>种 × 场次条目</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>报告</div>
            <div className={styles.statValue}>
              {plot.statsCache?.reportsWithBirds ?? 0}
              <span className={styles.statSlash}>/{plot.statsCache?.reportCount ?? 0}</span>
            </div>
            <div className={styles.statSub}>已补鸟种 / 全部</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>记录人</div>
            <div className={styles.statValue}>{observerStats.length}</div>
            <div className={styles.statSub}>
              {observerStats.length
                ? observerStats
                    .slice(0, 3)
                    .map((o) => o.name)
                    .join('、')
                : '暂无'}
            </div>
          </div>
        </section>

        {showEditor ? (
          <section className={styles.editorPanel} id="plot-editor">
            <div className={styles.panelHead}>
              <h2 className={styles.panelTitle}>录入 / 导入</h2>
              <button type="button" className={styles.linkBtn} onClick={() => setShowEditor(false)}>
                关闭
              </button>
            </div>
            <div className="kb-view-bar" role="tablist" aria-label="录入方式">
              <div className="kb-view-seg">
                <button
                  type="button"
                  role="tab"
                  aria-selected={editorTab === 'import'}
                  className={`kb-view-tab${editorTab === 'import' ? ' is-active' : ''}`}
                  onClick={() => setEditorTab('import')}
                >
                  导入报告
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={editorTab === 'manual'}
                  className={`kb-view-tab${editorTab === 'manual' ? ' is-active' : ''}`}
                  onClick={() => setEditorTab('manual')}
                >
                  手动添加
                </button>
              </div>
              <p className="kb-view-hint">
                {editorTab === 'import'
                  ? '从出行报告导入鸟种到自留地。'
                  : '按次手动添加：选种、日期与来源。'}
              </p>
            </div>

            {editorTab === 'manual' ? (
              <form onSubmit={handleAddEntry}>
                <p className={styles.hint}>按出现次数记账：选种 + 日期 + 记录人 + 来源。</p>
                <div className={styles.formGrid3}>
                  <div className={styles.field}>
                    <label>鸟种</label>
                    <BirdNameAutocomplete
                      value={birdName}
                      onChange={(v) => {
                        setBirdName(v);
                        setBirdId('');
                      }}
                      onSelect={(bird) => {
                        setBirdName(bird.name || '');
                        setBirdId(bird._id || '');
                        setScientificName(bird.scientificName || '');
                      }}
                      placeholder="输入中文名"
                    />
                  </div>
                  <div className={styles.field}>
                    <label htmlFor="entry-date">日期</label>
                    <input
                      id="entry-date"
                      type="date"
                      value={entryDate}
                      onChange={(e) => setEntryDate(e.target.value)}
                      required
                    />
                  </div>
                  <div className={styles.field}>
                    <label htmlFor="entry-observer">记录人</label>
                    <input
                      id="entry-observer"
                      value={entryObserver}
                      onChange={(e) => setEntryObserver(e.target.value)}
                      placeholder="自己或他人姓名"
                    />
                  </div>
                  <div className={styles.field}>
                    <label htmlFor="entry-source">来源</label>
                    <select
                      id="entry-source"
                      value={entrySource}
                      onChange={(e) => setEntrySource(e.target.value)}
                    >
                      <option value="manual">手动</option>
                      <option value="cbrc">鸟类记录中心</option>
                      <option value="other">其他</option>
                    </select>
                  </div>
                  <div className={`${styles.field} ${styles.fieldWide}`}>
                    <label htmlFor="entry-note">备注</label>
                    <input
                      id="entry-note"
                      value={entryNote}
                      onChange={(e) => setEntryNote(e.target.value)}
                      placeholder="可选"
                    />
                  </div>
                </div>
                <div className={styles.actions}>
                  <button type="submit" className="btn btn-primary" disabled={busy}>
                    {busy ? '提交中…' : '添加条目'}
                  </button>
                </div>
              </form>
            ) : (
              <>
                <div className={styles.importBlock}>
                  <h3 className={styles.importStep}>① 报告列表</h3>
                  <p className={styles.hint}>
                    含报告编号、观测时间、记录用户、观测地点。只建场次骨架；导入前会对比已有报告编号。
                  </p>
                  <div className={styles.formGrid}>
                    <div className={styles.field}>
                      <label htmlFor="list-file">文件</label>
                      <input id="list-file" type="file" accept=".xls,.xlsx" onChange={handleListFile} />
                      {listFileName ? (
                        <span className={styles.muted}>
                          已选：{listFileName}
                          {listFilePreview && !listFilePreview.error
                            ? `（${listFilePreview.reportIds.length} 份）`
                            : ''}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  {listReportCompare ? (
                    <div
                      className={`${styles.compareBanner} ${
                        listReportCompare.newCount === 0
                          ? styles.compareBannerWarn
                          : listReportCompare.existingCount > 0
                            ? styles.compareBannerOk
                            : styles.compareBannerOk
                      }`}
                      role="status"
                    >
                      {listReportCompare.newCount === 0 ? (
                        <>
                          文件 <strong>{listReportCompare.total}</strong> 份报告
                          均已存在（将刷新元信息，无新增）。
                        </>
                      ) : listReportCompare.existingCount > 0 ? (
                        <>
                          文件 <strong>{listReportCompare.total}</strong> 份：已有{' '}
                          <strong>{listReportCompare.existingCount}</strong>，
                          将新增 <strong>{listReportCompare.newCount}</strong>
                          {listReportCompare.newIds.length <= 5
                            ? `（${listReportCompare.newIds.join('、')}）`
                            : `（如 ${listReportCompare.newIds.slice(0, 3).join('、')}…）`}
                          。
                        </>
                      ) : (
                        <>
                          文件 <strong>{listReportCompare.total}</strong> 份报告均为新编号，将全部新增。
                        </>
                      )}
                    </div>
                  ) : null}
                  <div className={styles.actions}>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={handleImportList}
                      disabled={busy || !listRows}
                    >
                      {busy ? '导入中…' : '导入报告列表'}
                    </button>
                  </div>
                </div>
                <div className={styles.importBlock}>
                  <h3 className={styles.importStep}>② 报告鸟种明细</h3>
                  <p className={styles.hint}>
                    逐份上传；表内无报告编号时，在下方选择要关联的报告。导入前会对比文件种数与报告「提示种数」。
                  </p>
                  <div className={styles.formGrid}>
                    <div className={styles.field}>
                      <label htmlFor="birds-file">文件</label>
                      <input id="birds-file" type="file" accept=".xls,.xlsx" onChange={handleBirdsFile} />
                      {birdsFileName ? (
                        <span className={styles.muted}>
                          已选：{birdsFileName}
                          {birdsFilePreview && !birdsFilePreview.error
                            ? `（约 ${birdsFilePreview.birdCount} 种）`
                            : ''}
                        </span>
                      ) : null}
                    </div>
                    <div className={styles.field}>
                      <label htmlFor="report-select">关联报告编号</label>
                      <select
                        id="report-select"
                        value={selectedReportId}
                        onChange={(e) => setSelectedReportId(e.target.value)}
                      >
                        <option value="">表内自带编号 / 未选</option>
                        {reportRows.map((r) => (
                          <option key={r.reportId} value={r.reportId}>
                            {r.reportId} · {formatDate(r.startAt)} · {r.locationText || '无地点'}
                            {r.speciesCountHint > 0 ? ` · 提示${r.speciesCountHint}种` : ''}
                            {(r.birdsImported || 0) > 0 ? ` · 已有${r.birdsImported}种` : ' · 待补'}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className={styles.field}>
                      <label htmlFor="cbrc-observer">缺省记录人</label>
                      <input
                        id="cbrc-observer"
                        value={cbrcObserver}
                        onChange={(e) => setCbrcObserver(e.target.value)}
                      />
                    </div>
                    <div className={styles.field}>
                      <label htmlFor="cbrc-date">缺省日期</label>
                      <input
                        id="cbrc-date"
                        type="date"
                        value={cbrcDate}
                        onChange={(e) => setCbrcDate(e.target.value)}
                      />
                    </div>
                  </div>
                  {birdsReportCompare ? (
                    <div
                      className={`${styles.compareBanner} ${
                        birdsReportCompare.mismatch
                          ? styles.compareBannerWarn
                          : birdsReportCompare.hintCount > 0
                            ? styles.compareBannerOk
                            : ''
                      }`}
                      role="status"
                    >
                      {birdsReportCompare.mismatch ? (
                        <>
                          种数不一致：文件 <strong>{birdsReportCompare.mismatch.fileCount}</strong> 种
                          ，报告 <strong>{birdsReportCompare.mismatch.reportId}</strong> 提示{' '}
                          <strong>{birdsReportCompare.mismatch.hintCount}</strong> 种
                          —— 请确认是否传错文件或选错报告。
                        </>
                      ) : birdsReportCompare.hintCount > 0 ? (
                        <>
                          种数一致：文件 <strong>{birdsReportCompare.fileCount}</strong> 种
                          {birdsReportCompare.reportId
                            ? `，报告 ${birdsReportCompare.reportId} 提示 ${birdsReportCompare.hintCount} 种`
                            : ''}
                          。
                        </>
                      ) : (
                        <>
                          文件约 <strong>{birdsReportCompare.fileCount}</strong> 种。
                          {birdsReportCompare.note ? ` ${birdsReportCompare.note}` : ''}
                        </>
                      )}
                    </div>
                  ) : null}
                  <div className={styles.actions}>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={handleImportBirds}
                      disabled={busy || !birdsRows}
                    >
                      {busy ? '导入中…' : '导入鸟种明细'}
                    </button>
                  </div>
                </div>
              </>
            )}
          </section>
        ) : null}

        <section className={styles.overviewSection}>
          <div className={styles.overviewGrid}>
            <div className={styles.introPanel}>
              <div className={styles.panelHead}>
                <h2 className={styles.panelTitle}>介绍</h2>
                {editingIntro ? (
                  <div className={styles.headerActions}>
                    <button
                      type="button"
                      className={styles.linkBtn}
                      onClick={() => {
                        setEditingIntro(false);
                        setIntroDraft(plot.notes || '');
                      }}
                      disabled={busy}
                    >
                      取消
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={handleSaveIntro}
                      disabled={busy}
                    >
                      {busy ? '保存中…' : '保存'}
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className={styles.linkBtn}
                    onClick={() => {
                      setIntroDraft(plot.notes || '');
                      setEditingIntro(true);
                    }}
                  >
                    {plot.notes ? '编辑' : '添加介绍'}
                  </button>
                )}
              </div>
              {editingIntro ? (
                <textarea
                  className={styles.introTextarea}
                  value={introDraft}
                  onChange={(e) => setIntroDraft(e.target.value)}
                  rows={8}
                  placeholder={`介绍这块自留地，例如：${plot.title}的范围、主要生境、关注重点、资料来源习惯等。`}
                />
              ) : plot.notes ? (
                <p className={styles.introBody}>{plot.notes}</p>
              ) : (
                <p className={styles.introEmpty}>
                  还没有介绍。可以写写「{plot.title}」的范围、生境与观鸟要点。
                </p>
              )}
              {observerStats.length > 0 ? (
                <div className={styles.chipRow} style={{ marginTop: 12 }}>
                  {observerStats.map((o) => (
                    <span key={o.name} className={styles.chip}>
                      {o.name} · {o.count} 种
                    </span>
                  ))}
                </div>
              ) : null}
            </div>

            <div className={styles.mapPanel}>
              <div className={styles.panelHead}>
                <h2 className={styles.panelTitle}>地图</h2>
                <span className={styles.listMeta}>
                  {mapStatus === 'loading'
                    ? '匹配中…'
                    : mapPins.length > 0
                      ? `${mapPins.length} 个地点`
                      : '暂无坐标'}
                </span>
              </div>
              <div className={styles.mapFrame}>
                {mapPins.length > 0 ? (
                  <BirdMapProvider
                    locations={mapPins}
                    center={mapCenter}
                    zoom={mapPins.length > 1 ? 11 : 12}
                    height="100%"
                  />
                ) : (
                  <div className={styles.mapEmpty}>
                    <p className={styles.mapEmptyTitle}>
                      {mapStatus === 'loading' ? '正在匹配地点…' : '暂无地图点位'}
                    </p>
                    <p className={styles.mapEmptyHint}>
                      将报告地点或「{plot.title}」录入地点词典并补全坐标后，可在此显示大地图。
                    </p>
                  </div>
                )}
              </div>
              <div className={styles.mapFooter}>
                {primaryMapLocation?.name ? (
                  <span className={styles.muted}>
                    主地点 · {primaryMapLocation.name}
                    {plot.locationId &&
                    String(plot.locationId) === String(primaryMapLocation._id)
                      ? '（已关联）'
                      : ''}
                  </span>
                ) : (
                  <span className={styles.muted}>范围 · {scopeLabel(plot)}</span>
                )}
                {primaryMapLocation?._id &&
                String(plot.locationId || '') !== String(primaryMapLocation._id) ? (
                  <button
                    type="button"
                    className={styles.linkBtn}
                    onClick={handleLinkPrimaryLocation}
                    disabled={busy}
                  >
                    关联到本自留地
                  </button>
                ) : null}
                {primaryMapLocation?._id ? (
                  <Link href={`/locations/${primaryMapLocation._id}`} className={styles.linkBtn}>
                    地点详情
                  </Link>
                ) : (
                  <Link href="/locations" className={styles.linkBtn}>
                    打开地点词典
                  </Link>
                )}
              </div>
            </div>
          </div>
        </section>

        {habitatImages.length > 0 ? (
          <div className={styles.habitatSection}>
            <HabitatGallery
              title="范围内生境图"
              images={habitatImages}
              canUpload={false}
              canDelete={false}
              hint="来自境内报告匹配到的观鸟点生境库；图下标注地点名称。"
              emptyText="暂无生境照片"
            />
          </div>
        ) : null}

        <section className={regionStyles.summarySection}>
          <div className={styles.panelHead}>
            <h2 className={styles.panelTitle} style={{ margin: 0 }}>
              按目一览
            </h2>
            <button type="button" className={styles.linkBtn} onClick={() => openEditor('manual')}>
              + 手动记一条
            </button>
          </div>
          {allSpecies.length === 0 ? (
            <p className={regionStyles.summaryEmpty}>
              暂无鸟种。
              <button type="button" className={styles.linkBtn} onClick={() => openEditor('import')}>
                去导入报告
              </button>
            </p>
          ) : (
            <SpeciesLedgerBrowse
              progressLabel={
                <>
                  共 {allSpecies.length} 种
                  <span className={regionStyles.summaryPct}>
                    {orderFilter
                      ? `（当前：${orderDisplayName(orderFilter)}）`
                      : '（全部目）'}
                  </span>
                </>
              }
              progressPct={
                allSpecies.length
                  ? Math.round(
                      ((orderCards.find((c) => c.key === orderGroupKey(orderFilter || ''))
                        ?.speciesCount || allSpecies.length) /
                        allSpecies.length) *
                        100
                    )
                  : 0
              }
              searchValue={summarySearch}
              onSearchChange={setSummarySearch}
              showFilterChips
              filterOptions={[{ id: '', label: '全部' }]}
              filterValue={orderFilter ? orderGroupKey(orderFilter) : ''}
              onFilterChange={() => {
                setOrderFilter('');
                setFamilyFilter('');
              }}
              filterAriaLabel="目筛选"
              orderCards={orderCards.map((card) => ({
                key: card.key,
                label: card.label,
                latin: card.latin,
                stat: `${card.speciesCount}种 · ${card.times}次`,
                pct: card.pct,
                active: Boolean(orderFilter) && orderGroupKey(orderFilter) === card.key,
              }))}
              onSelectOrder={(card) => {
                if (orderFilter && orderGroupKey(orderFilter) === card.key) {
                  setOrderFilter('');
                } else {
                  setOrderFilter(card.key === '未分类' ? '未分类' : card.key);
                }
                setFamilyFilter('');
              }}
            />
          )}
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHead}>
            <h2 className={styles.panelTitle}>种级表格</h2>
          </div>
          <div className={regionStyles.toolbar}>
            <BirdSearchField
              className={regionStyles.searchInput}
              value={filterQ}
              onChange={setFilterQ}
              placeholder={BIRD_SEARCH_PLACEHOLDER}
              size="sm"
              roundedRect
            />
            <select
              className={regionStyles.filterSelect}
              value={orderFilter}
              onChange={(e) => {
                setOrderFilter(e.target.value);
                setFamilyFilter('');
              }}
            >
              <option value="">全部目</option>
              {filterOptions.orders.map((item) => (
                <option key={item} value={item}>
                  {orderDisplayName(item)}
                </option>
              ))}
              {allSpecies.some((s) => orderGroupKey(s.order) === '未分类') ? (
                <option value="未分类">未分类</option>
              ) : null}
            </select>
            <select
              className={regionStyles.filterSelect}
              value={familyFilter}
              onChange={(e) => setFamilyFilter(e.target.value)}
            >
              <option value="">全部科</option>
              {filterOptions.families.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            <select
              className={regionStyles.filterSelect}
              value={filterSource}
              onChange={(e) => setFilterSource(e.target.value)}
            >
              <option value="">全部来源</option>
              <option value="manual">手动</option>
              <option value="cbrc">记录中心</option>
              <option value="other">其他</option>
            </select>
            <select
              className={regionStyles.filterSelect}
              value={filterYear}
              onChange={(e) => setFilterYear(e.target.value)}
            >
              <option value="">全部年份</option>
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
            <select
              className={regionStyles.filterSelect}
              value={`${sortBy}-${sortOrder}`}
              onChange={(e) => {
                const [field, dir] = e.target.value.split('-');
                setSortBy(field);
                setSortOrder(dir);
              }}
              aria-label="种级表格排序"
            >
              <option value="times-desc">次数高→低</option>
              <option value="times-asc">次数低→高</option>
              <option value="firstSeenAt-asc">首次最早→晚</option>
              <option value="firstSeenAt-desc">首次最晚→早</option>
              <option value="name-asc">名称 A→Z</option>
              <option value="lastSeenAt-desc">末次新→旧</option>
            </select>
            <input
              className={regionStyles.searchInput}
              value={filterObserver}
              onChange={(e) => setFilterObserver(e.target.value)}
              placeholder="记录人"
            />
          </div>

          {filteredSpecies.length === 0 ? (
            <div className={styles.empty}>当前筛选下没有鸟种</div>
          ) : (
            <div className={styles.tableWrap}>
              <table className={regionStyles.table}>
                <thead>
                  <tr>
                    <th>中文名</th>
                    <th>学名</th>
                    <th>目</th>
                    <th>科</th>
                    <th>
                      <button
                        type="button"
                        className={styles.sortThBtn}
                        onClick={() => toggleSpeciesSort('times', 'desc')}
                        title="按出现次数排序"
                      >
                        次数
                        <span className={styles.sortThIcon} aria-hidden="true">
                          {sortBy === 'times' ? (sortOrder === 'asc' ? '↑' : '↓') : '↕'}
                        </span>
                      </button>
                    </th>
                    <th>
                      <button
                        type="button"
                        className={styles.sortThBtn}
                        onClick={() => toggleSpeciesSort('firstSeenAt', 'asc')}
                        title="按首次发现日期排序（点一次看最早）"
                      >
                        首次
                        <span className={styles.sortThIcon} aria-hidden="true">
                          {sortBy === 'firstSeenAt' ? (sortOrder === 'asc' ? '↑' : '↓') : '↕'}
                        </span>
                      </button>
                    </th>
                    <th>记录人</th>
                    <th>来源</th>
                    <th className={styles.stickyActions}>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSpecies.map((s) => {
                    const sid = s._id;
                    const open = expandedId === sid;
                    const observersText = (s.observers || []).join('、') || '—';
                    return (
                      <Fragment key={sid}>
                        <tr>
                          <td>
                            {s.birdId ? (
                              <Link href={`/birds/${s.birdId}`} className={regionStyles.birdLink}>
                                {s.name}
                              </Link>
                            ) : (
                              <span className={styles.speciesName}>{s.name}</span>
                            )}
                          </td>
                          <td>
                            <span className={styles.speciesSci}>{s.scientificName || '—'}</span>
                          </td>
                          <td>{orderDisplayName(s.order) || '—'}</td>
                          <td>{s.family || '—'}</td>
                          <td className={regionStyles.countCell}>{s.times ?? 0}</td>
                          <td>{formatDate(s.firstSeenAt)}</td>
                          <td className={styles.observersCell} title={observersText}>
                            {observersText}
                          </td>
                          <td>
                            {(s.sources || []).map((src) => SOURCE_LABEL[src] || src).join('、') ||
                              '—'}
                          </td>
                          <td className={styles.stickyActions}>
                            <div className={styles.rowActions}>
                              <button
                                type="button"
                                className={styles.linkBtn}
                                onClick={() => setExpandedId(open ? null : sid)}
                              >
                                {open ? '收起' : '条目'}
                              </button>
                              <button
                                type="button"
                                className={styles.linkBtn}
                                onClick={() => handleDeleteSpecies(sid)}
                                disabled={busy}
                              >
                                删除
                              </button>
                            </div>
                          </td>
                        </tr>
                        {open && Array.isArray(s.entries) && s.entries.length > 0 ? (
                          <tr>
                            <td colSpan={9}>
                              <div className={styles.entryList}>
                                {s.entries
                                  .slice()
                                  .sort((a, b) => new Date(b.date) - new Date(a.date))
                                  .map((e) => (
                                    <div key={e._id} className={styles.entryItem}>
                                      <span>{formatDate(e.date)}</span>
                                      <span>{e.observer || '—'}</span>
                                      <span className={styles.sourceTag}>
                                        {SOURCE_LABEL[e.source] || e.source}
                                      </span>
                                      {e.reportId ? (
                                        <span className={styles.muted}>#{e.reportId}</span>
                                      ) : null}
                                      {e.locationText ? (
                                        <span className={styles.muted}>{e.locationText}</span>
                                      ) : null}
                                      {e.note ? (
                                        <span className={styles.muted}>{e.note}</span>
                                      ) : null}
                                      <button
                                        type="button"
                                        className={styles.linkBtn}
                                        onClick={() => handleDeleteEntry(sid, e._id)}
                                        disabled={busy}
                                      >
                                        删条目
                                      </button>
                                    </div>
                                  ))}
                              </div>
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {reportRows.length > 0 ? (
          <section className={styles.panel}>
            <div className={styles.panelHead}>
              <h2 className={styles.panelTitle}>报告进度</h2>
              {reportRows.some((r) => !(Number(r.birdsImported) > 0)) ? (
                <button type="button" className={styles.linkBtn} onClick={() => openEditor('import')}>
                  补传鸟种明细
                </button>
              ) : null}
            </div>
            <p className={styles.hint}>
              已补全 {plot.statsCache?.reportsWithBirds ?? 0} / {plot.statsCache?.reportCount ?? 0}{' '}
              份。点击编号或「查看」打开报告鸟种列表
              {reportRows.some((r) => !(Number(r.birdsImported) > 0))
                ? '；待补的报告可点「补传鸟种」。'
                : '。'}
            </p>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>报告编号</th>
                    <th>时间</th>
                    <th>记录人</th>
                    <th>地点</th>
                    <th>提示种数</th>
                    <th>已导入</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {reportRows.map((r) => {
                    const imported = Number(r.birdsImported) || 0;
                    const hint = Number(r.speciesCountHint) || 0;
                    const hasBirds = imported > 0;
                    const incomplete = hasBirds && hint > 0 && imported < hint;
                    return (
                      <tr key={r.reportId}>
                        <td>
                          <Link
                            href={`/records/plots/${plotId}/reports/${encodeURIComponent(r.reportId)}`}
                            className={styles.linkBtn}
                          >
                            {r.reportId}
                          </Link>
                        </td>
                        <td>{r.timeRaw || formatDate(r.startAt)}</td>
                        <td>{r.observer || '—'}</td>
                        <td>{r.locationText || '—'}</td>
                        <td>{hint || '—'}</td>
                        <td>
                          {hasBirds ? (
                            <span className={incomplete ? styles.statusWarn : styles.statusOk}>
                              {imported} 种
                              {incomplete ? '（不足）' : ''}
                            </span>
                          ) : (
                            <span className={styles.statusPending}>待补</span>
                          )}
                        </td>
                        <td>
                          {hasBirds && !incomplete ? (
                            <Link
                              href={`/records/plots/${plotId}/reports/${encodeURIComponent(r.reportId)}`}
                              className={styles.linkBtn}
                            >
                              查看
                            </Link>
                          ) : (
                            <button
                              type="button"
                              className={styles.linkBtn}
                              onClick={() => openEditor('import', r.reportId)}
                            >
                              {hasBirds ? '补足鸟种' : '补传鸟种'}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}
      </main>
      <Footer />
      {confirmDialog}
    </div>
  );
}
