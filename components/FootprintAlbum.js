'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { normalizeProvinceGeoName } from '../utils/provinceGeoName';
import { PATH_PROGRESS_COLORS } from '../utils/mapPathSegments';
import SpeciesHoverChip from './SpeciesHoverChip';
import styles from '../styles/FootprintAlbum.module.css';

const BirdMapProvider = dynamic(() => import('./BirdMapProvider'), { ssr: false });
const ChinaProvinceMap = dynamic(() => import('./ChinaProvinceMap'), { ssr: false });
const FootprintOrbit3D = dynamic(() => import('./FootprintOrbit3D'), { ssr: false });

const MAP_CENTER = { lat: 36.2, lng: 103.8 };
/** 偏陆地中国幅面，减少中亚/太平洋留白 */
const CHINA_BOUNDS = [
  [20.5, 78.0],
  [51.5, 132.0],
];
const MAP_HEIGHT = '420px';
const MAP_ZOOM = 5;

const VIEW_MODES = [
  { id: 'map', label: '地图', hint: '点位与轨迹' },
  { id: 'heat', label: '热力', hint: '省级分布' },
  { id: 'orbit', label: '立体', hint: '轨道视角' },
];

function formatMonthLabel(ym) {
  if (!ym || !/^\d{4}-\d{2}$/.test(ym)) return '—';
  const [y, m] = ym.split('-');
  return `${y}年${Number(m)}月`;
}

function formatDayLabel(dateValue) {
  if (!dateValue) return '—';
  const d = new Date(dateValue);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });
}

function monthEndMs(ym) {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m, 0, 23, 59, 59, 999).getTime();
}

function firstDateMonth(point) {
  if (!point?.firstDate) return null;
  const d = new Date(point.firstDate);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function toMapLocation(p) {
  return {
    _id: p.key,
    key: p.key,
    name: p.name,
    lat: p.lat,
    lng: p.lng,
    coordinates: [p.lng, p.lat],
    records: p.visitCount,
    birds: p.speciesCount,
    recordCount: p.visitCount,
    birdCount: p.speciesCount,
    date: p.firstDate || p.lastDate,
    locationId: p.locationId,
    province: p.province,
    speciesNames: p.speciesNames,
    lastDate: p.lastDate,
    firstDate: p.firstDate,
  };
}

export default function FootprintAlbum({
  footprint,
  dashProvinces = [],
}) {
  const points = Array.isArray(footprint?.points) ? footprint.points : [];
  const visits = Array.isArray(footprint?.visits) ? footprint.visits : [];
  const trips = Array.isArray(footprint?.trips) ? footprint.trips : [];

  const timeline = useMemo(() => {
    if (Array.isArray(footprint?.timeline) && footprint.timeline.length > 0) {
      return footprint.timeline;
    }
    const set = new Set();
    points.forEach((p) => {
      if (Array.isArray(p.months)) p.months.forEach((m) => set.add(m));
      else {
        const m = firstDateMonth(p);
        if (m) set.add(m);
      }
    });
    return [...set].sort();
  }, [footprint?.timeline, points]);

  const [scrubIndex, setScrubIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [viewMode, setViewMode] = useState('map');
  const [selectedKey, setSelectedKey] = useState('');
  const [activeTripKey, setActiveTripKey] = useState('');
  const [heatProvince, setHeatProvince] = useState('');
  const railRef = useRef(null);
  const cardRefs = useRef([]);

  useEffect(() => {
    if (timeline.length === 0) {
      setScrubIndex(0);
      return;
    }
    setScrubIndex(timeline.length - 1);
  }, [timeline]);

  useEffect(() => {
    if (!playing || timeline.length <= 1) return undefined;
    const timer = setInterval(() => {
      setScrubIndex((prev) => {
        if (prev >= timeline.length - 1) {
          setPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, 1100);
    return () => clearInterval(timer);
  }, [playing, timeline.length]);

  const scrubMonth = timeline[scrubIndex] || null;
  const scrubEnd = scrubMonth ? monthEndMs(scrubMonth) : Infinity;

  const monthStats = useMemo(() => {
    const firstCount = new Map();
    points.forEach((p) => {
      const m = firstDateMonth(p);
      if (!m) return;
      firstCount.set(m, (firstCount.get(m) || 0) + 1);
    });
    let cumulative = 0;
    return timeline.map((ym) => {
      const newborn = firstCount.get(ym) || 0;
      cumulative += newborn;
      return { ym, newborn, cumulative };
    });
  }, [points, timeline]);

  const visiblePoints = useMemo(() => {
    if (!scrubMonth || points.length === 0) return points;
    return points.filter((p) => {
      if (!p.firstDate) return true;
      const t = new Date(p.firstDate).getTime();
      return !Number.isNaN(t) && t <= scrubEnd;
    });
  }, [points, scrubMonth, scrubEnd]);

  const visibleTrips = useMemo(
    () =>
      trips.filter((t) => {
        const tMs = new Date(t.date).getTime();
        return !Number.isNaN(tMs) && tMs <= scrubEnd;
      }),
    [trips, scrubEnd]
  );

  const activeTrip = useMemo(
    () => visibleTrips.find((t) => t.dayKey === activeTripKey) || null,
    [visibleTrips, activeTripKey]
  );

  // 从最早到最晚把访问点连起来；相邻同点去重；五色表示时间先后
  const pathPositions = useMemo(() => {
    const ordered = visits
      .filter((v) => {
        const t = new Date(v.date).getTime();
        return !Number.isNaN(t) && t <= scrubEnd;
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const coords = [];
    let lastKey = '';
    ordered.forEach((v) => {
      const lat = Number(v.lat);
      const lng = Number(v.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      const key = v.pointKey || `${lat.toFixed(5)},${lng.toFixed(5)}`;
      if (key === lastKey) return;
      lastKey = key;
      coords.push([lat, lng]);
    });
    return coords.length >= 2 ? coords : [];
  }, [visits, scrubEnd]);

  const mapLocations = useMemo(() => visiblePoints.map(toMapLocation), [visiblePoints]);

  const mapPaneRef = useRef(null);

  const selectedPoint = useMemo(() => {
    if (!selectedKey) return null;
    return (
      visiblePoints.find((p) => p.key === selectedKey) ||
      points.find((p) => p.key === selectedKey) ||
      null
    );
  }, [selectedKey, visiblePoints, points]);

  const provinceStats = useMemo(() => {
    const map = {};
    const ensure = (rawName) => {
      const name = normalizeProvinceGeoName(rawName);
      if (!name) return null;
      if (!map[name]) {
        map[name] = { speciesCount: 0, listCount: 0, seenCount: 0, _names: new Set() };
      }
      return name;
    };

    // 截止月内点位 → 省级种数 / 点数
    visiblePoints.forEach((p) => {
      const name = ensure(p.province);
      if (!name) return;
      map[name].listCount += 1;
      (p.speciesNames || []).forEach((n) => {
        if (n) map[name]._names.add(n);
      });
      if (!(p.speciesNames || []).length && Number(p.speciesCount) > 0) {
        map[name].speciesCount += Number(p.speciesCount) || 0;
      }
    });
    Object.values(map).forEach((row) => {
      if (row._names.size > 0) {
        row.speciesCount = row._names.size;
      }
      row.seenCount = row.speciesCount;
      delete row._names;
      if (!row.speciesCount && row.listCount) {
        row.speciesCount = row.listCount;
        row.seenCount = row.listCount;
      }
    });

    // 点位没有省份时，用 API / 总览省份兜底
    if (Object.keys(map).length === 0) {
      const fallback =
        Array.isArray(footprint?.provinces) && footprint.provinces.length > 0
          ? footprint.provinces
          : Array.isArray(dashProvinces)
            ? dashProvinces
            : [];
      fallback.forEach((p) => {
        const name = ensure(p.name);
        if (!name) return;
        const species = Number(p.species ?? p.speciesCount ?? 0);
        map[name].speciesCount = Math.max(map[name].speciesCount, species);
        map[name].listCount = Math.max(map[name].listCount, Number(p.points || 1));
        map[name].seenCount = map[name].speciesCount;
        delete map[name]._names;
      });
    }

    return map;
  }, [visiblePoints, footprint?.provinces, dashProvinces]);

  const heatProvinceDetail = useMemo(() => {
    if (!heatProvince) return null;
    const locs = visiblePoints.filter(
      (p) => normalizeProvinceGeoName(p.province) === heatProvince
    );
    const names = new Set();
    locs.forEach((p) => {
      (p.speciesNames || []).forEach((n) => {
        if (n) names.add(n);
      });
    });
    const stats = provinceStats[heatProvince];
    return {
      name: heatProvince,
      speciesCount: names.size || Number(stats?.speciesCount) || 0,
      pointCount: locs.length || Number(stats?.listCount) || 0,
      visitCount: locs.reduce((sum, p) => sum + (Number(p.visitCount) || 0), 0),
      points: locs,
      speciesNames: [...names],
    };
  }, [heatProvince, visiblePoints, provinceStats]);

  useEffect(() => {
    const el = cardRefs.current[scrubIndex];
    if (!el || !railRef.current) return;
    el.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [scrubIndex]);

  useEffect(() => {
    if (activeTripKey && !visibleTrips.some((t) => t.dayKey === activeTripKey)) {
      setActiveTripKey('');
    }
  }, [activeTripKey, visibleTrips]);

  useEffect(() => {
    if (viewMode !== 'heat' && heatProvince) {
      setHeatProvince('');
    }
  }, [viewMode, heatProvince]);

  // 出行日只作用于地图模式的右侧站点一览；热力/立体下收起并清空
  useEffect(() => {
    if (viewMode !== 'map' && activeTripKey) {
      setActiveTripKey('');
    }
  }, [viewMode, activeTripKey]);

  const total = points.length;
  const shown = visiblePoints.length;
  const activeStat = monthStats[scrubIndex];
  const hasTimeline = timeline.length > 1;

  const selectPoint = (point) => {
    if (!point?.key) return;
    setSelectedKey(point.key);
    setHeatProvince('');
    setViewMode((mode) => (mode === 'heat' ? 'map' : mode));
  };

  const togglePlay = () => {
    if (playing) {
      setPlaying(false);
      return;
    }
    if (scrubIndex >= timeline.length - 1) setScrubIndex(0);
    setPlaying(true);
  };

  return (
    <section className={styles.album} aria-label="足迹地图册">
      <div className={styles.header}>
        <div className={styles.headerMain}>
          <h3 className={styles.title}>我的足迹</h3>
          <p className={styles.sub}>
            {shown ? `${shown}地点` : ''}
            {visibleTrips.length ? `${shown ? ' · ' : ''}${visibleTrips.length} 个出行日` : ''}
            {scrubMonth ? ` · 截止 ${formatMonthLabel(scrubMonth)}` : ''}
            {activeStat?.newborn ? ` · 本月新 +${activeStat.newborn}` : ''}
          </p>
        </div>
        {total > 0 ? (
          <div className={styles.toolbar}>
            <div className={styles.modeSwitch} role="tablist" aria-label="足迹显示方式">
              {VIEW_MODES.map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  role="tab"
                  aria-selected={viewMode === mode.id}
                  className={`${styles.modeBtn}${viewMode === mode.id ? ` ${styles.modeBtnActive}` : ''}`}
                  onClick={() => setViewMode(mode.id)}
                  title={mode.hint}
                >
                  {mode.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              className={`${styles.playBtn}${playing ? ` ${styles.playBtnActive}` : ''}`}
              disabled={!hasTimeline}
              onClick={togglePlay}
            >
              {playing ? '暂停' : '播放'}
            </button>
          </div>
        ) : null}
      </div>

      {total === 0 ? (
        <div className={styles.empty}>暂无可用坐标。请在记录或地点中补全经纬度。</div>
      ) : (
        <>
          <div className={styles.scrub}>
            <div className={styles.railShell}>
              <div className={styles.railWrap} ref={railRef}>
                <div className={styles.railTrack} aria-hidden="true" />
                <div
                  className={styles.rail}
                  role="listbox"
                  aria-label="足迹时间轴"
                  aria-activedescendant={scrubMonth ? `fp-month-${scrubMonth}` : undefined}
                >
                  {monthStats.map((stat, index) => {
                    const active = index === scrubIndex;
                    const passed = index <= scrubIndex;
                    return (
                      <button
                        key={stat.ym}
                        id={`fp-month-${stat.ym}`}
                        type="button"
                        role="option"
                        aria-selected={active}
                        ref={(node) => {
                          cardRefs.current[index] = node;
                        }}
                        className={`${styles.monthCard}${active ? ` ${styles.monthCardActive}` : ''}${
                          passed ? ` ${styles.monthCardPassed}` : ''
                        }`}
                        title={`${formatMonthLabel(stat.ym)}：本月新点 ${stat.newborn}，截止累计 ${stat.cumulative} 点`}
                        onClick={() => {
                          setPlaying(false);
                          setScrubIndex(index);
                        }}
                      >
                        <span className={styles.monthWhen}>{formatMonthLabel(stat.ym)}</span>
                        <span className={styles.monthMeta}>
                          {stat.newborn > 0 ? (
                            <span className={styles.monthNew}>
                              新点<em>+{stat.newborn}</em>
                            </span>
                          ) : (
                            <span className={styles.monthQuiet}>无新点</span>
                          )}
                          <span className={styles.monthCum}>累计 {stat.cumulative}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          <div className={styles.stageRow}>
            <div className={styles.mapPane} ref={mapPaneRef}>
              {viewMode === 'map' ? (
                <div className={styles.mapWrap}>
                  <BirdMapProvider
                    locations={mapLocations}
                    center={MAP_CENTER}
                    zoom={MAP_ZOOM}
                    minFitZoom={5}
                    fitMode="china"
                    height={MAP_HEIGHT}
                    maxBounds={CHINA_BOUNDS}
                    path={pathPositions}
                    pathStyle="gradient"
                    markerSize={{ width: 16, height: 20 }}
                    showInfoWindow
                    selectedKey={selectedKey}
                    onMarkerClick={(loc) => {
                      selectPoint(loc);
                    }}
                  />
                  {pathPositions.length >= 2 ? (
                    <div className={styles.pathLegend} aria-hidden="true">
                      <span className={styles.pathLegendLabel}>早</span>
                      <span className={styles.pathLegendBar}>
                        {PATH_PROGRESS_COLORS.map((color) => (
                          <i key={color} style={{ background: color }} />
                        ))}
                      </span>
                      <span className={styles.pathLegendLabel}>晚</span>
                    </div>
                  ) : (
                    <div className={styles.mapHint} aria-hidden="true">
                      访问点不足两个，还画不出路线
                    </div>
                  )}
                </div>
              ) : null}
              {viewMode === 'heat' ? (
                <div className={styles.heatWrap}>
                  {Object.keys(provinceStats).length === 0 ? (
                    <div className={styles.emptyPane}>
                      记录/地点里还没有可识别的省份。请在地点地址中填写省名后，热力才会上色。
                    </div>
                  ) : (
                    <ChinaProvinceMap
                      statsByProvince={provinceStats}
                      selectedProvince={heatProvince}
                      onSelectProvince={(name) => {
                        setSelectedKey('');
                        setActiveTripKey('');
                        setHeatProvince((prev) => (prev === name ? '' : name));
                      }}
                      className={styles.heatMap}
                      valueLabel="鸟种数"
                      emptyTip="该省暂无足迹"
                    />
                  )}
                </div>
              ) : null}
              {viewMode === 'orbit' ? (
                <div className={styles.orbitWrap}>
                  <FootprintOrbit3D
                    points={visiblePoints}
                    selectedKey={selectedKey}
                    onSelect={selectPoint}
                    height={420}
                  />
                </div>
              ) : null}
            </div>

            <aside className={styles.sidePane} aria-label="点位一览">
              {viewMode === 'heat' && heatProvinceDetail ? (
                <div className={`${styles.sideCard} ${styles.sideCardFocus}`}>
                  <div className={styles.sideKicker}>选中省份</div>
                  <h4 className={styles.sideTitle}>{heatProvinceDetail.name}</h4>
                  <div className={styles.sideStats}>
                    <span>
                      <strong>{heatProvinceDetail.speciesCount}</strong> 种
                    </span>
                    <span>
                      <strong>{heatProvinceDetail.pointCount}</strong> 地点
                    </span>
                    <span>
                      <strong>{heatProvinceDetail.visitCount}</strong> 次
                    </span>
                  </div>
                  {heatProvinceDetail.points.length ? (
                    <>
                      <div className={styles.sideSectionLabel}>本省地点</div>
                      <div className={styles.pointList}>
                        {heatProvinceDetail.points.slice(0, 30).map((p) => (
                          <button
                            key={p.key}
                            type="button"
                            className={styles.pointRow}
                            onClick={() => selectPoint(p)}
                          >
                            <strong>{p.name}</strong>
                            <span>
                              {p.speciesCount || 0} 种 · {p.visitCount || 0} 次
                            </span>
                          </button>
                        ))}
                      </div>
                    </>
                  ) : null}
                  {heatProvinceDetail.speciesNames.length ? (
                    <>
                      <div className={styles.sideSectionLabel}>见过的鸟种</div>
                      <div className={`${styles.chipRow} ${styles.sideScroll}`}>
                        {heatProvinceDetail.speciesNames.slice(0, 40).map((name) => (
                          <SpeciesHoverChip key={name} name={name} className={styles.chip} />
                        ))}
                        {heatProvinceDetail.speciesNames.length > 40 ? (
                          <span className={styles.chipMore}>
                            +{heatProvinceDetail.speciesNames.length - 40}
                          </span>
                        ) : null}
                      </div>
                    </>
                  ) : (
                    <p className={styles.sideHint}>该省暂无鸟种明细。</p>
                  )}
                  <div className={styles.sideLinks}>
                    <button
                      type="button"
                      className={styles.sideGhost}
                      onClick={() => setHeatProvince('')}
                    >
                      关闭，回一览
                    </button>
                  </div>
                </div>
              ) : selectedPoint ? (
                <div className={`${styles.sideCard} ${styles.sideCardFocus}`}>
                  <div className={styles.sideKicker}>选中地点</div>
                  <h4 className={styles.sideTitle}>{selectedPoint.name}</h4>
                  <div className={styles.sideStats}>
                    <span>
                      <strong>{selectedPoint.speciesCount || 0}</strong> 种
                    </span>
                    <span>
                      <strong>{selectedPoint.visitCount || 0}</strong> 次
                    </span>
                    {selectedPoint.province ? (
                      <span className={styles.sideProvince}>{selectedPoint.province}</span>
                    ) : null}
                  </div>
                  <dl className={styles.sideDl}>
                    <div>
                      <dt>初见</dt>
                      <dd>{formatDayLabel(selectedPoint.firstDate)}</dd>
                    </div>
                    <div>
                      <dt>最近</dt>
                      <dd>{formatDayLabel(selectedPoint.lastDate)}</dd>
                    </div>
                  </dl>
                  {selectedPoint.speciesNames?.length ? (
                    <>
                      <div className={styles.sideSectionLabel}>见过的鸟种</div>
                      <div className={`${styles.chipRow} ${styles.sideScroll}`}>
                        {selectedPoint.speciesNames.slice(0, 40).map((name) => (
                          <SpeciesHoverChip key={name} name={name} className={styles.chip} />
                        ))}
                        {selectedPoint.speciesNames.length > 40 ? (
                          <span className={styles.chipMore}>
                            +{selectedPoint.speciesNames.length - 40}
                          </span>
                        ) : null}
                      </div>
                    </>
                  ) : (
                    <p className={styles.sideHint}>暂无鸟种明细。</p>
                  )}
                  <div className={styles.sideLinks}>
                    <Link
                      href={`/locations?search=${encodeURIComponent(selectedPoint.name)}`}
                      className={styles.sideLink}
                    >
                      地点词典
                    </Link>
                    <button
                      type="button"
                      className={styles.sideGhost}
                      onClick={() => setSelectedKey('')}
                    >
                      关闭，回一览
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className={styles.sideCard}>
                    <div className={styles.sideKicker}>
                      {viewMode === 'heat'
                        ? '省份一览'
                        : viewMode === 'map' && activeTrip
                          ? '当天站点'
                          : '点位一览'}
                    </div>
                    <p className={styles.sideHint}>
                      {viewMode === 'heat'
                        ? '点热力图上的省份，查看该省地点与鸟种'
                        : viewMode === 'orbit'
                          ? '点球体上的地点，暂停自转并查看详情'
                          : activeTrip
                            ? `${formatDayLabel(activeTrip.date)} · ${
                                activeTrip.stopCount || activeTrip.stops?.length || 0
                              } 站`
                            : '点地图标记或列表，查看地点详情'}
                    </p>
                  </div>
                  <div className={styles.pointList}>
                    {viewMode === 'heat'
                      ? Object.entries(provinceStats)
                          .sort((a, b) => (b[1].speciesCount || 0) - (a[1].speciesCount || 0))
                          .map(([name, row]) => (
                            <button
                              key={name}
                              type="button"
                              className={styles.pointRow}
                              onClick={() => {
                                setSelectedKey('');
                                setHeatProvince(name);
                              }}
                            >
                              <strong>{name}</strong>
                              <span>
                                {row.speciesCount || 0} 种 · {row.listCount || 0} 地点
                              </span>
                            </button>
                          ))
                      : viewMode === 'map' && activeTrip
                        ? (activeTrip.stops || []).map((stop, idx) => (
                            <button
                              key={stop.pointKey || `${stop.name}-${idx}`}
                              type="button"
                              className={styles.pointRow}
                              onClick={() => {
                                const matched = points.find((p) => p.key === stop.pointKey);
                                if (matched) selectPoint(matched);
                                else setSelectedKey(stop.pointKey || '');
                              }}
                            >
                              <strong>
                                {idx + 1}. {stop.name}
                              </strong>
                              <span>当天第 {idx + 1} 站</span>
                            </button>
                          ))
                        : visiblePoints.slice(0, 40).map((p) => (
                            <button
                              key={p.key}
                              type="button"
                              className={styles.pointRow}
                              onClick={() => selectPoint(p)}
                            >
                              <strong>{p.name}</strong>
                              <span>
                                {p.speciesCount || 0} 种 · {p.visitCount || 0} 次
                              </span>
                            </button>
                          ))}
                  </div>
                  {viewMode === 'map' && activeTrip ? (
                    <button
                      type="button"
                      className={styles.sideGhost}
                      onClick={() => setActiveTripKey('')}
                    >
                      退出当天，看全部点位
                    </button>
                  ) : null}
                </>
              )}
            </aside>
          </div>

          {viewMode === 'map' && visibleTrips.length > 0 ? (
            <div className={styles.tripSection}>
              <div className={styles.tripHead}>
                <h4 className={styles.tripTitle}>出行日</h4>
                <p className={styles.tripSub}>点一天可在右侧只看当天站点</p>
              </div>
              <div className={styles.tripShell}>
                <div className={styles.tripRail}>
                  {visibleTrips.map((trip) => {
                    const active = trip.dayKey === activeTripKey;
                    return (
                      <button
                        key={trip.dayKey}
                        type="button"
                        className={`${styles.tripCard}${
                          active ? ` ${styles.tripCardActive}` : ''
                        }`}
                        onClick={() => {
                          if (active) {
                            setActiveTripKey('');
                            return;
                          }
                          setActiveTripKey(trip.dayKey);
                          setSelectedKey('');
                          setPlaying(false);
                          requestAnimationFrame(() => {
                            mapPaneRef.current?.scrollIntoView({
                              behavior: 'smooth',
                              block: 'nearest',
                            });
                          });
                        }}
                      >
                        <span className={styles.tripDate}>{formatDayLabel(trip.date)}</span>
                        <span className={styles.tripStat}>
                          {trip.stopCount} 站 · {trip.speciesCount} 种
                          {active ? ' · 正在看' : ''}
                        </span>
                        <span className={styles.tripStops}>
                          {(trip.stops || [])
                            .slice(0, 3)
                            .map((s) => s.name)
                            .join(' → ')}
                          {(trip.stops || []).length > 3 ? ' …' : ''}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
