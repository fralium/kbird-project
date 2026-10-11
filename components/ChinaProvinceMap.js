'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import * as echarts from 'echarts';
import { normalizeProvinceGeoName } from '@/utils/provinceGeoName';

let chinaGeoCache = null;
let chinaGeoPromise = null;

/** 少→多：青绿 → 黄 → 橙 → 红 → 紫，便于区分档位 */
const HEAT_COLORS = ['#c8e6c9', '#66bb6a', '#ffee58', '#ffa726', '#ef5350', '#8e24aa'];

function loadChinaGeo() {
  if (chinaGeoCache) return Promise.resolve(chinaGeoCache);
  if (chinaGeoPromise) return chinaGeoPromise;
  chinaGeoPromise = fetch('/geo/china-provinces.json')
    .then((res) => {
      if (!res.ok) throw new Error('地图数据加载失败');
      return res.json();
    })
    .then((geo) => {
      echarts.registerMap('china', geo);
      chinaGeoCache = geo;
      return geo;
    })
    .catch((err) => {
      chinaGeoPromise = null;
      throw err;
    });
  return chinaGeoPromise;
}

function shortProvinceLabel(name) {
  const short = String(name || '').replace(
    /维吾尔自治区|壮族自治区|回族自治区|特别行政区|自治区|省|市/g,
    ''
  );
  return short.length > 4 ? short.slice(0, 4) : short;
}

function buildSeriesData(statsByProvince) {
  const merged = new Map();
  Object.entries(statsByProvince || {}).forEach(([rawName, stat]) => {
    const name = normalizeProvinceGeoName(rawName);
    if (!name) return;
    const prev = merged.get(name) || {
      name,
      value: 0,
      listCount: 0,
      speciesCount: 0,
      seenCount: 0,
    };
    prev.speciesCount += Number(stat?.speciesCount || 0);
    prev.listCount += Number(stat?.listCount || 0);
    prev.seenCount += Number(stat?.seenCount || 0);
    prev.value = prev.speciesCount || prev.listCount || prev.value;
    merged.set(name, prev);
  });
  return [...merged.values()].map((row) => ({
    ...row,
    label: { show: row.value > 0 },
  }));
}

function maxValueOf(rows) {
  const values = rows.map((d) => d.value).filter((v) => v > 0);
  return values.length ? Math.max(...values) : 1;
}

/**
 * 省级色块小地图：悬浮看数量，点击筛选省份。
 * 地图数据：/geo/china-provinces.json（DataV 省级边界）
 */
export default function ChinaProvinceMap({
  statsByProvince = {},
  selectedProvince = '',
  onSelectProvince,
  className = '',
  valueLabel = '鸟种数量',
  emptyTip = '暂无数据',
}) {
  const hostRef = useRef(null);
  const chartRef = useRef(null);
  const onSelectRef = useRef(onSelectProvince);
  const seriesDataRef = useRef([]);
  const [mapReady, setMapReady] = useState(false);
  const [loadError, setLoadError] = useState('');
  onSelectRef.current = onSelectProvince;

  const seriesData = useMemo(() => buildSeriesData(statsByProvince), [statsByProvince]);
  seriesDataRef.current = seriesData;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;

    setMapReady(false);
    const chart = echarts.init(host, null, { renderer: 'canvas' });
    chartRef.current = chart;

    let cancelled = false;
    let ro;

    const safeResize = () => {
      if (cancelled || chart.isDisposed?.()) return;
      chart.resize();
    };

    loadChinaGeo()
      .then(() => {
        if (cancelled || chart.isDisposed?.()) return;
        const data = seriesDataRef.current;
        const max = maxValueOf(data);
        chart.setOption(
          {
            backgroundColor: 'transparent',
            tooltip: {
              trigger: 'item',
              borderWidth: 0,
              backgroundColor: 'rgba(15, 23, 32, 0.88)',
              textStyle: { color: 'var(--text-white)', fontSize: 13},
              formatter: (params) => {
                const d = params?.data || {};
                const name = params?.name || '';
                const listCount = d.listCount || 0;
                const speciesCount = d.speciesCount || 0;
                const seenCount = d.seenCount || 0;
                if (!listCount && !speciesCount) {
                  return `${name}<br/>${emptyTip}`;
                }
                const lines = [`<strong>${name}</strong>`];
                if (speciesCount > 0) lines.push(`${valueLabel}: ${speciesCount}`);
                if (listCount > 0) lines.push(`点位数: ${listCount}`);
                if (seenCount > 0 && seenCount !== speciesCount) {
                  lines.push(`已见: ${seenCount}`);
                }
                return lines.join('<br/>');
              },
            },
            visualMap: {
              type: 'continuous',
              min: 0,
              max: Math.max(max, 1),
              right: 8,
              bottom: 12,
              text: ['多', '少'],
              textStyle: { color: 'var(--text-muted)', fontSize: 11},
              inRange: { color: HEAT_COLORS},
              calculable: false,
              itemWidth: 12,
              itemHeight: 88,
              show: data.some((d) => d.value > 0),
            },
            series: [
              {
                id: 'province-map',
                name: '各地鸟种',
                type: 'map',
                map: 'china',
                roam: false,
                selectedMode: 'single',
                boundingCoords: [
                  [73, 17.5],
                  [135.5, 53.8],
                ],
                layoutCenter: ['50%', '50%'],
                layoutSize: '100%',
                aspectScale: 0.88,
                label: {
                  show: false,
                  fontSize: 10,
                  color: '#1e293b',
                  formatter: (p) => shortProvinceLabel(p.name),
                },
                itemStyle: {
                  areaColor: '#f1f5f9',
                  borderColor: '#fff',
                  borderWidth: 1,
                },
                emphasis: {
                  label: { show: true, color: 'var(--color-ink)', fontWeight: 700, fontSize: 12},
                  itemStyle: {
                    areaColor: '#f472b6',
                    shadowBlur: 8,
                    shadowColor: 'rgba(2, 48, 71, 0.2)',
                  },
                },
                select: {
                  label: { show: true, color: 'var(--color-ink)', fontWeight: 700},
                  itemStyle: {
                    areaColor: '#a855f7',
                    borderColor: '#6b21a8',
                    borderWidth: 1.5,
                  },
                },
                data,
              },
            ],
          },
          { notMerge: true }
        );

        chart.off('click');
        chart.on('click', (params) => {
          if (params?.componentType !== 'series' || !params.name) return;
          const handler = onSelectRef.current;
          if (typeof handler === 'function') handler(String(params.name));
        });
        setLoadError('');
        setMapReady(true);
        requestAnimationFrame(safeResize);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err.message || '地图加载失败');
      });

    window.addEventListener('resize', safeResize);
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(safeResize);
      ro.observe(host);
    }

    return () => {
      cancelled = true;
      setMapReady(false);
      window.removeEventListener('resize', safeResize);
      if (ro) ro.disconnect();
      chart.dispose();
      if (chartRef.current === chart) chartRef.current = null;
    };
  }, [emptyTip, valueLabel]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || chart.isDisposed?.() || !mapReady || !chinaGeoCache) return;

    const max = maxValueOf(seriesData);
    chart.setOption({
      visualMap: {
        type: 'continuous',
        min: 0,
        max: Math.max(max, 1),
        show: seriesData.some((d) => d.value > 0),
        inRange: { color: HEAT_COLORS},
        text: ['多', '少'],
      },
      series: [
        {
          id: 'province-map',
          type: 'map',
          map: 'china',
          data: seriesData,
        },
      ],
    });
    chart.resize();

    const selected = normalizeProvinceGeoName(selectedProvince);
    const allNames = (chinaGeoCache.features || [])
      .map((f) => f?.properties?.name)
      .filter(Boolean);
    allNames.forEach((name) => {
      if (chart.isDisposed?.()) return;
      chart.dispatchAction({
        type: selected && name === selected ? 'select' : 'unselect',
        seriesIndex: 0,
        name,
      });
    });
  }, [seriesData, selectedProvince, mapReady]);

  if (loadError) {
    return (
      <div className={className}>
        <p style={{ padding: 16, color: 'var(--text-muted)', fontSize: 13, margin: 0}}>{loadError}</p>
      </div>
    );
  }

  return (
    <div className={className} style={{ width: '100%', height: '100%', minHeight: 0 }}>
      <div ref={hostRef} style={{ width: '100%', height: '100%', minHeight: 280 }} />
    </div>
  );
}
