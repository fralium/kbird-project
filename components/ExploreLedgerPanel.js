'use client';

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import PageState from './PageState';
import HabitatGallery from './HabitatGallery';
import SpeciesHoverChip from './SpeciesHoverChip';
import { api } from '../utils/api';
import { getOrderChineseName } from '../data/taxonomyTranslation';
import plotStyles from '../styles/PersonalPlots.module.css';
import styles from '../styles/ExploreDemo.module.css';

const BirdMapProvider = dynamic(() => import('./BirdMapProvider'), { ssr: false });

const LEDGER_TABS = [
  { id: 'map', label: '足迹地图' },
  { id: 'species', label: '种级表格' },
  { id: 'reports', label: '观鸟报告' },
];

const SOURCE_LABEL = {
  cbrc: '记录中心',
  manual: '手动',
  other: '其他',
};

function formatDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function scopeLabel(plot) {
  return (
    [plot?.province, plot?.city, plot?.district, plot?.spot].filter(Boolean).join(' · ') ||
    '未填范围'
  );
}

/** 与自留地详情相同：报告观鸟点生境库，图下标注地点 */
export function PlotHabitatGallery({ plot }) {
  const images = Array.isArray(plot?.habitatImages)
    ? plot.habitatImages.filter((img) => img && String(img.url || '').trim())
    : [];
  if (!images.length) return null;
  return (
    <div className={plotStyles.habitatSection}>
      <HabitatGallery
        title="范围内生境图"
        images={images}
        canUpload={false}
        canDelete={false}
        hint="来自境内报告匹配到的观鸟点生境库；图下标注地点名称。"
        emptyText="暂无生境照片"
      />
    </div>
  );
}

function orderDisplayName(orderKey) {
  if (!orderKey || orderKey === '未分类') return '未分类';
  return getOrderChineseName(orderKey) || orderKey;
}

function extractCoords(location) {
  if (!location) return null;
  const lat =
    location.coordinates?.coordinates?.[1] ??
    location.coordinates?.[1] ??
    location.lat ??
    location.latitude;
  const lng =
    location.coordinates?.coordinates?.[0] ??
    location.coordinates?.[0] ??
    location.lng ??
    location.longitude;
  if (lat == null || lng == null) return null;
  const nLat = Number(lat);
  const nLng = Number(lng);
  if (!Number.isFinite(nLat) || !Number.isFinite(nLng)) return null;
  if (nLat === 0 && nLng === 0) return null;
  return { lat: nLat, lng: nLng };
}

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
  if (districtMatch) {
    out.push(districtMatch[1]);
    rest = rest.slice(districtMatch[1].length);
  }
  rest = rest.replace(/^[\s·\-—_/]+/, '').trim();
  if (rest && rest.length >= 2) out.push(rest);
  return [...new Set(out.filter(Boolean))];
}

async function resolveLinkedPlot({ linkedPlotId, linkedPlotTitle }) {
  if (linkedPlotId) {
    try {
      const res = await api.personal.getPlotById(linkedPlotId);
      if (res?.success && res.data) return res.data;
    } catch {
      // fall through to title match
    }
  }
  if (!linkedPlotTitle) return null;
  const listRes = await api.personal.getPlots();
  const plots = Array.isArray(listRes?.data) ? listRes.data : [];
  const hit = plots.find((p) => String(p.title || '').trim() === String(linkedPlotTitle).trim());
  if (!hit?._id) return null;
  const detail = await api.personal.getPlotById(hit._id);
  return detail?.data || null;
}

export function useLinkedPlot(linkedPlotId, linkedPlotTitle) {
  const [plot, setPlot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await resolveLinkedPlot({ linkedPlotId, linkedPlotTitle });
      if (!data) {
        setPlot(null);
        setError('未找到关联自留地');
      } else {
        setPlot(data);
      }
    } catch (e) {
      setPlot(null);
      setError(e?.message || '加载自留地失败');
    } finally {
      setLoading(false);
    }
  }, [linkedPlotId, linkedPlotTitle]);

  useEffect(() => {
    load();
  }, [load]);

  return { plot, loading, error, reload: load };
}

function usePlotMapPins(plot, enabled = true) {
  const [mapPins, setMapPins] = useState([]);
  const [mapStatus, setMapStatus] = useState('idle');

  const mapResolveKey = useMemo(() => {
    if (!plot) return '';
    const reportLocs = (plot.reports || [])
      .map((r) => String(r.locationText || '').trim())
      .filter(Boolean)
      .join('|');
    return [
      plot._id || '',
      plot.locationId || '',
      plot.title || '',
      plot.spot || '',
      plot.district || '',
      plot.city || '',
      plot.province || '',
      reportLocs,
    ].join('::');
  }, [plot]);

  useEffect(() => {
    let cancelled = false;
    if (!plot || !mapResolveKey || !enabled) {
      return undefined;
    }

    const run = async () => {
      setMapStatus('loading');
      const pins = [];
      const seen = new Set();

      const addLoc = (loc, label) => {
        const coords = extractCoords(loc);
        if (!coords) return;
        const key = `${coords.lat.toFixed(5)},${coords.lng.toFixed(5)}`;
        if (seen.has(key)) return;
        seen.add(key);
        pins.push({
          lat: coords.lat,
          lng: coords.lng,
          name: label || loc.name || '地点',
        });
      };

      if (plot.locationId) {
        try {
          const data = await api.locations.getById(plot.locationId);
          if (!cancelled && data?.success && data.data) {
            addLoc(data.data, data.data.name);
          }
        } catch {
          // ignore
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

      for (const name of [...nameCandidates].filter(Boolean).slice(0, 28)) {
        if (cancelled) return;
        try {
          const data = await api.locations.getByName(name);
          if (data?.code === 'LOCATION_LOOKUP_SKIPPED') break;
          if (data?.success && data.data) addLoc(data.data, data.data.name);
        } catch (err) {
          if (
            err?.code === 'BACKEND_UNREACHABLE' ||
            Number(err?.status) === 0 ||
            Number(err?.status) >= 500
          ) {
            break;
          }
        }
      }

      if (!cancelled) {
        setMapPins(pins);
        setMapStatus(pins.length ? 'ready' : 'empty');
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [plot, mapResolveKey, enabled]);

  const mapCenter = useMemo(() => {
    if (!mapPins.length) return null;
    const lat = mapPins.reduce((s, p) => s + p.lat, 0) / mapPins.length;
    const lng = mapPins.reduce((s, p) => s + p.lng, 0) / mapPins.length;
    return { lat, lng };
  }, [mapPins]);

  return { mapPins, mapStatus, mapCenter };
}

function PlotFootprintMap({ plot, frameClassName, showMeta = true }) {
  const { mapPins, mapStatus, mapCenter } = usePlotMapPins(plot, Boolean(plot));
  const metaText =
    mapStatus === 'loading'
      ? '匹配中…'
      : mapPins.length > 0
        ? `${mapPins.length} 个地点`
        : '暂无坐标';

  return (
    <>
      {showMeta ? <div className={styles.ledgerMapMeta}>{metaText}</div> : null}
      <div className={frameClassName || styles.ledgerMapFrame}>
        {mapPins.length > 0 ? (
          <BirdMapProvider
            locations={mapPins}
            center={mapCenter}
            zoom={mapPins.length > 1 ? 11 : 12}
            height="100%"
          />
        ) : (
          <div className={plotStyles.mapEmpty}>
            <p className={plotStyles.mapEmptyTitle}>
              {mapStatus === 'loading' ? '正在匹配地点…' : '暂无地图点位'}
            </p>
            <p className={plotStyles.mapEmptyHint}>
              将报告地点或「{plot?.title || '自留地'}」录入地点词典并补全坐标后，可在此显示足迹。
            </p>
          </div>
        )}
      </div>
    </>
  );
}

/** 自留地样式的地图卡片（含标题旁地点数） */
function PlotMapCard({ plot }) {
  const { mapPins, mapStatus, mapCenter } = usePlotMapPins(plot, Boolean(plot));
  const metaText =
    mapStatus === 'loading'
      ? '匹配中…'
      : mapPins.length > 0
        ? `${mapPins.length} 个地点`
        : '暂无坐标';

  return (
    <div className={plotStyles.mapPanel}>
      <div className={plotStyles.panelHead}>
        <h2 className={plotStyles.panelTitle}>地图</h2>
        <span className={plotStyles.listMeta}>{metaText}</span>
      </div>
      <div className={plotStyles.mapFrame}>
        {mapPins.length > 0 ? (
          <BirdMapProvider
            locations={mapPins}
            center={mapCenter}
            zoom={mapPins.length > 1 ? 11 : 12}
            height="100%"
          />
        ) : (
          <div className={plotStyles.mapEmpty}>
            <p className={plotStyles.mapEmptyTitle}>
              {mapStatus === 'loading' ? '正在匹配地点…' : '暂无地图点位'}
            </p>
            <p className={plotStyles.mapEmptyHint}>
              将报告地点或「{plot?.title || '自留地'}」录入地点词典并补全坐标后，可在此显示足迹。
            </p>
          </div>
        )}
      </div>
      <div className={plotStyles.mapFooter}>
        <span className={plotStyles.muted}>观测足迹 · 来自自留地报告地点</span>
        <Link href="/locations" className={plotStyles.linkBtn}>
          打开地点词典
        </Link>
      </div>
    </div>
  );
}

export default function ExploreLedgerPanel({
  linkedPlotId = '',
  linkedPlotTitle = '',
  initialSection = 'species',
  onSectionChange,
}) {
  const [section, setSection] = useState(
    LEDGER_TABS.some((t) => t.id === initialSection) ? initialSection : 'species'
  );

  const goSection = (id) => {
    setSection(id);
    onSectionChange?.(id);
  };
  const { plot, loading, error } = useLinkedPlot(linkedPlotId, linkedPlotTitle);
  const [filterQ, setFilterQ] = useState('');
  const [filterSource, setFilterSource] = useState('');
  const [sortBy, setSortBy] = useState('times');
  const [sortOrder, setSortOrder] = useState('desc');
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    if (LEDGER_TABS.some((t) => t.id === initialSection)) {
      setSection(initialSection);
    } else if (initialSection === 'intro') {
      setSection('species');
    }
  }, [initialSection]);

  const plotId = plot?._id ? String(plot._id) : '';

  const allSpecies = useMemo(() => plot?.species || [], [plot]);

  const filteredSpecies = useMemo(() => {
    const q = filterQ.trim().toLowerCase();
    let list = allSpecies.slice();
    if (q) {
      list = list.filter(
        (s) =>
          String(s.name || '')
            .toLowerCase()
            .includes(q) ||
          String(s.scientificName || '')
            .toLowerCase()
            .includes(q)
      );
    }
    if (filterSource) {
      list = list.filter((s) => (s.sources || []).includes(filterSource));
    }
    const dir = sortOrder === 'asc' ? 1 : -1;
    list.sort((a, b) => {
      if (sortBy === 'name') {
        return String(a.name || '').localeCompare(String(b.name || ''), 'zh') * dir;
      }
      if (sortBy === 'firstSeenAt') {
        return (
          ((new Date(a.firstSeenAt || 0).getTime() || 0) -
            (new Date(b.firstSeenAt || 0).getTime() || 0)) *
          dir
        );
      }
      return ((Number(a.times) || 0) - (Number(b.times) || 0)) * dir;
    });
    return list;
  }, [allSpecies, filterQ, filterSource, sortBy, sortOrder]);

  const reportRows = useMemo(() => {
    const list = Array.isArray(plot?.reports) ? [...plot.reports] : [];
    list.sort((a, b) => new Date(b.startAt || 0) - new Date(a.startAt || 0));
    return list;
  }, [plot]);

  if (loading) {
    return (
      <div className={styles.seasonsModule}>
        <section className={styles.smBlock}>
          <PageState type="loading" title="加载实地档案…" />
        </section>
      </div>
    );
  }

  if (!plot) {
    return (
      <div className={styles.seasonsModule}>
        <section className={styles.smBlock}>
          <header className={styles.smHead}>
            <span className={styles.sectionMark} aria-hidden="true">
              览
            </span>
            <div>
              <h2 className={styles.smTitle}>实地档案</h2>
              <p className={styles.smHint}>
                探索管计划，自留地管记录。关联一块自留地后，可在此查看足迹、种级表与报告。
              </p>
            </div>
          </header>
          <p className={styles.empty}>
            {error || '尚未关联自留地'}
            {linkedPlotTitle ? `（期望：${linkedPlotTitle}）` : ''}
          </p>
          <Link href="/records/plots" className={styles.backToList}>
            打开自留地列表 →
          </Link>
        </section>
      </div>
    );
  }

  const sectionTitle =
    LEDGER_TABS.find((t) => t.id === section)?.label || '内容';
  const speciesCount = plot.statsCache?.speciesCount ?? allSpecies.length;
  const reportCount = plot.statsCache?.reportCount ?? reportRows.length;

  return (
    <div className={styles.seasonsModule}>
      <section className={styles.smBlock}>
        <header className={styles.smHead}>
          <span className={styles.sectionMark} aria-hidden="true">
            览
          </span>
          <div className={styles.checkHeadMain}>
            <div>
              <h2 className={styles.smTitle}>{plot.title}</h2>
              <p className={styles.smHint}>
                只读浏览 · {scopeLabel(plot)} · 录入 / 导入仍在自留地完成
              </p>
            </div>
            <div className={styles.ledgerHeadAside}>
              <p className={styles.listMeta}>
                鸟种 {speciesCount} · 报告 {reportCount}
              </p>
              <Link
                href={`/records/plots/${plotId}`}
                className={styles.backToList}
              >
                在自留地中打开 →
              </Link>
            </div>
          </div>
        </header>

        <nav className={styles.ledgerSubTabs} aria-label="实地档案子模块">
          {LEDGER_TABS.map((t, i) => (
            <button
              key={t.id}
              type="button"
              className={`${styles.plotBtn} ${
                section === t.id ? styles.plotBtnActive : ''
              }`}
              onClick={() => goSection(t.id)}
            >
              <span className={styles.itemMark}>
                {String(i + 1).padStart(2, '0')}
              </span>
              <span>{t.label}</span>
            </button>
          ))}
        </nav>
      </section>

      <section className={styles.smBlock}>
        <header className={styles.smHead}>
          <span className={styles.sectionMark} aria-hidden="true">
            一
          </span>
          <div>
            <h2 className={styles.smTitle}>{sectionTitle}</h2>
            <p className={styles.smHint}>
              {section === 'map'
                ? '观测足迹点位（来自报告地点）'
                : section === 'species'
                  ? '已记种列表；点「条目」展开单次记录'
                  : '点编号查看报告鸟种；补传请到自留地'}
            </p>
          </div>
        </header>

        {section === 'map' ? (
          <div className={styles.ledgerBlock}>
            <PlotFootprintMap plot={plot} />
          </div>
        ) : null}

        {section === 'species' ? (
          <div className={styles.ledgerBlock}>
            <div className={styles.filterBar}>
              <input
                className={styles.search}
                type="search"
                value={filterQ}
                onChange={(e) => setFilterQ(e.target.value)}
                placeholder="搜索中文名 / 学名…"
              />
              <select
                className={styles.select}
                value={filterSource}
                onChange={(e) => setFilterSource(e.target.value)}
                aria-label="来源"
              >
                <option value="">全部来源</option>
                <option value="manual">手动</option>
                <option value="cbrc">记录中心</option>
                <option value="other">其他</option>
              </select>
              <select
                className={styles.select}
                value={`${sortBy}-${sortOrder}`}
                onChange={(e) => {
                  const [field, dir] = e.target.value.split('-');
                  setSortBy(field);
                  setSortOrder(dir);
                }}
                aria-label="排序"
              >
                <option value="times-desc">次数高→低</option>
                <option value="times-asc">次数低→高</option>
                <option value="firstSeenAt-asc">首次最早→晚</option>
                <option value="firstSeenAt-desc">首次最晚→早</option>
                <option value="name-asc">名称 A→Z</option>
              </select>
            </div>

            {filteredSpecies.length === 0 ? (
              <p className={styles.empty}>当前筛选下没有鸟种</p>
            ) : (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>中文名</th>
                      <th>学名</th>
                      <th>目</th>
                      <th>次数</th>
                      <th>首次</th>
                      <th>记录人</th>
                      <th>来源</th>
                      <th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSpecies.map((s) => {
                      const sid = s._id;
                      const open = expandedId === sid;
                      const observersText =
                        (s.observers || []).join('、') || '—';
                      return (
                        <Fragment key={sid}>
                          <tr>
                            <td className={styles.nameCell}>
                              <SpeciesHoverChip
                                name={s.name}
                                href={s.birdId ? `/birds/${s.birdId}` : undefined}
                                className={s.birdId ? styles.ledgerLink : undefined}
                              />
                            </td>
                            <td className={styles.sciCell}>
                              <em>{s.scientificName || '—'}</em>
                            </td>
                            <td>{orderDisplayName(s.order) || '—'}</td>
                            <td>{s.times ?? 0}</td>
                            <td>{formatDate(s.firstSeenAt)}</td>
                            <td title={observersText}>{observersText}</td>
                            <td>
                              {(s.sources || [])
                                .map((src) => SOURCE_LABEL[src] || src)
                                .join('、') || '—'}
                            </td>
                            <td>
                              <button
                                type="button"
                                className={styles.ledgerLinkBtn}
                                onClick={() =>
                                  setExpandedId(open ? null : sid)
                                }
                              >
                                {open ? '收起' : '条目'}
                              </button>
                            </td>
                          </tr>
                          {open &&
                          Array.isArray(s.entries) &&
                          s.entries.length > 0 ? (
                            <tr>
                              <td colSpan={8}>
                                <div className={styles.ledgerEntryList}>
                                  {s.entries
                                    .slice()
                                    .sort(
                                      (a, b) =>
                                        new Date(b.date) - new Date(a.date),
                                    )
                                    .map((e) => (
                                      <div
                                        key={e._id}
                                        className={styles.ledgerEntryItem}
                                      >
                                        <span>{formatDate(e.date)}</span>
                                        <span>{e.observer || '—'}</span>
                                        <span className={styles.metaChip}>
                                          {SOURCE_LABEL[e.source] || e.source}
                                        </span>
                                        {e.reportId ? (
                                          <Link
                                            href={`/records/plots/${plotId}/reports/${encodeURIComponent(e.reportId)}`}
                                            className={styles.ledgerLink}
                                          >
                                            #{e.reportId}
                                          </Link>
                                        ) : null}
                                        {e.locationText ? (
                                          <span className={styles.smHint}>
                                            {e.locationText}
                                          </span>
                                        ) : null}
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
          </div>
        ) : null}

        {section === 'reports' ? (
          <div className={styles.ledgerBlock}>
            {reportRows.length === 0 ? (
              <p className={styles.empty}>还没有导入报告</p>
            ) : (
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
                      const incomplete =
                        hasBirds && hint > 0 && imported < hint;
                      return (
                        <tr key={r.reportId}>
                          <td>
                            <Link
                              href={`/records/plots/${plotId}/reports/${encodeURIComponent(r.reportId)}`}
                              className={styles.ledgerLink}
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
                              <span
                                className={`${styles.badge} ${
                                  incomplete
                                    ? styles.badgePending
                                    : styles.badgeOk
                                }`}
                              >
                                {imported} 种
                                {incomplete ? '（不足）' : ''}
                              </span>
                            ) : (
                              <span
                                className={`${styles.badge} ${styles.badgePending}`}
                              >
                                待补
                              </span>
                            )}
                          </td>
                          <td>
                            <Link
                              href={
                                hasBirds
                                  ? `/records/plots/${plotId}/reports/${encodeURIComponent(r.reportId)}`
                                  : `/records/plots/${plotId}`
                              }
                              className={styles.ledgerLink}
                            >
                              {hasBirds ? '查看' : '去补传'}
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : null}
      </section>
    </div>
  );
}

/** 总览首页：与自留地相同——介绍一张卡、地图一张卡 */
export function ExploreLedgerSummaryCard({
  linkedPlotId = '',
  linkedPlotTitle = '',
}) {
  const { plot, loading, error } = useLinkedPlot(linkedPlotId, linkedPlotTitle);

  if (loading) {
    return (
      <section className={plotStyles.overviewSection}>
        <div className={plotStyles.overviewGrid}>
          <div className={plotStyles.introPanel}>
            <div className={plotStyles.panelHead}>
              <h2 className={plotStyles.panelTitle}>介绍</h2>
            </div>
            <p className={plotStyles.introEmpty}>正在读取关联自留地…</p>
          </div>
          <div className={plotStyles.mapPanel}>
            <div className={plotStyles.panelHead}>
              <h2 className={plotStyles.panelTitle}>地图</h2>
            </div>
            <div className={plotStyles.mapFrame}>
              <div className={plotStyles.mapEmpty}>
                <p className={plotStyles.mapEmptyTitle}>加载中…</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (!plot) {
    const isServiceDown =
      /暂不可用|503|失败|ECONNREFUSED|网络|超时|fetch/i.test(
        String(error || ''),
      );
    return (
      <section className={plotStyles.overviewSection}>
        <div className={plotStyles.overviewGrid}>
          <div className={plotStyles.introPanel}>
            <div className={plotStyles.panelHead}>
              <h2 className={plotStyles.panelTitle}>介绍</h2>
            </div>
            <p className={plotStyles.introEmpty}>
              {isServiceDown
                ? error || '自留地服务暂不可用，请稍后重试。'
                : error ||
                  '尚未关联自留地。关联后，总览会显示介绍与足迹地图。'}
            </p>
            <Link href="/records/plots" className={plotStyles.linkBtn}>
              打开自留地 →
            </Link>
          </div>
          <div className={plotStyles.mapPanel}>
            <div className={plotStyles.panelHead}>
              <h2 className={plotStyles.panelTitle}>地图</h2>
            </div>
            <div className={plotStyles.mapFrame}>
              <div className={plotStyles.mapEmpty}>
                <p className={plotStyles.mapEmptyTitle}>
                  {isServiceDown ? '服务暂不可用' : '暂无地图点位'}
                </p>
                <p className={plotStyles.mapEmptyHint}>
                  {isServiceDown
                    ? '启动后端后刷新本页'
                    : '关联自留地后显示观测足迹'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <>
      <section className={plotStyles.overviewSection}>
        <div className={plotStyles.overviewGrid}>
          <div className={plotStyles.introPanel}>
            <div className={plotStyles.panelHead}>
              <h2 className={plotStyles.panelTitle}>介绍</h2>
              <Link href={`/records/plots/${plot._id}`} className={plotStyles.linkBtn}>
                {plot.notes ? '编辑' : '添加介绍'}
              </Link>
            </div>
            {plot.notes ? (
              <p className={plotStyles.introBody}>{plot.notes}</p>
            ) : (
              <p className={plotStyles.introEmpty}>
                还没有介绍。可以写写「{plot.title}」的范围、生境与观鸟要点。
              </p>
            )}
            <div className={plotStyles.mapFooter}>
              <span className={plotStyles.muted}>范围 · {scopeLabel(plot)}</span>
            </div>
          </div>

          <PlotMapCard plot={plot} />
        </div>
      </section>
      <PlotHabitatGallery plot={plot} />
    </>
  );
}
