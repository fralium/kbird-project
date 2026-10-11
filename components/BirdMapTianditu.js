import { useEffect, useState, useRef, useMemo, useId } from 'react';
import { buildMapInfoWindowHtml } from '@/utils/mapInfoWindowHtml';
import { splitPathIntoProgressSegments } from '@/utils/mapPathSegments';
import styles from '@/styles/BirdMapBaidu.module.css';

/**
 * 观鸟地图组件 - 天地图
 * 使用天地图 JavaScript API 4.0，需在环境变量中配置 NEXT_PUBLIC_TIANDITU_TK
 * 申请 Key：https://cloudcenter.tianditu.gov.cn/center/development/myApp
 * 应用类型请选择：浏览器端
 */
export default function BirdMapTianditu({
  locations = [],
  center = { lat: 30.2741, lng: 120.1551 },
  zoom = 10,
  /** 自适应视野时不要再缩小到比这更小 */
  minFitZoom = null,
  fitMode = 'auto',
  height = '400px',
  onMarkerClick,
  maxBounds,
  path = [],
  /** gradient = 五色实线表早晚；solid/dashed 单色 */
  pathStyle = 'gradient',
  showInfoWindow = true,
  selectedKey = '',
}) {
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState('');
  const [mapLayer, setMapLayer] = useState('normal');
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const overlaysRef = useRef([]);
  const onMarkerClickRef = useRef(onMarkerClick);
  const maxBoundsRef = useRef(maxBounds);
  const mapInitializedRef = useRef(false);
  const reactId = useId().replace(/:/g, '');
  const containerId = `tianditu-map-${reactId}`;

  const apiKey = typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_TIANDITU_TK || '' : '';

  useEffect(() => {
    onMarkerClickRef.current = onMarkerClick;
  }, [onMarkerClick]);

  useEffect(() => {
    maxBoundsRef.current = maxBounds;
  }, [maxBounds]);

  const getLngLat = (location) => {
    const lng = location.lng ?? location.coordinates?.[0] ?? location.location?.coordinates?.coordinates?.[0];
    const lat = location.lat ?? location.coordinates?.[1] ?? location.location?.coordinates?.coordinates?.[1];
    if (lat == null || lng == null) return null;
    const numLng = Number(lng);
    const numLat = Number(lat);
    // (0,0) 或仅输入地名未选地点时多为 [0,0]，视为无有效坐标
    if (numLng === 0 && numLat === 0) return null;
    return { lng: numLng, lat: numLat };
  };

  const validLocations = useMemo(
    () => locations.filter((loc) => getLngLat(loc) !== null),
    [locations]
  );

  const locationsKey = useMemo(
    () =>
      validLocations
        .map((loc) => {
          const pos = getLngLat(loc);
          return `${loc._id || loc.name || ''}:${pos?.lng},${pos?.lat}:${loc.records || 0}:${loc.birds || 0}`;
        })
        .join('|'),
    [validLocations]
  );

  const centerPoint = useMemo(() => {
    const first = validLocations[0];
    if (fitMode === 'china' || !first) {
      return { lng: center.lng ?? 103.8, lat: center.lat ?? 36.2 };
    }
    return getLngLat(first);
  }, [center.lat, center.lng, fitMode, validLocations]);

  useEffect(() => {
    if (typeof window === 'undefined' || !apiKey) return;

    if (window.T && window.T.Map) {
      setMapError('');
      setMapLoaded(true);
      return;
    }

    const scriptUrl = `https://api.tianditu.gov.cn/api?v=4.0&tk=${apiKey}`;
    const existingScript = document.querySelector(`script[src="${scriptUrl}"]`);
    const script = existingScript || document.createElement('script');
    let timeoutId = null;

    const handleLoad = () => {
      if (timeoutId) clearTimeout(timeoutId);
      setMapError('');
      setMapLoaded(true);
    };
    const handleError = () => {
      if (timeoutId) clearTimeout(timeoutId);
      setMapLoaded(false);
      setMapError('天地图脚本加载失败，可能被网络代理或安全软件拦截。');
    };

    script.addEventListener('load', handleLoad);
    script.addEventListener('error', handleError);

    if (!existingScript) {
      script.src = scriptUrl;
      script.async = true;
      document.head.appendChild(script);
    }

    timeoutId = setTimeout(() => {
      if (!window.T || !window.T.Map) {
        handleError();
      }
    }, 10000);

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      script.removeEventListener('load', handleLoad);
      script.removeEventListener('error', handleError);
    };
  }, [apiKey]);

  // 地图实例只初始化一次；父组件每秒重渲染（如时钟）不应销毁重建
  useEffect(() => {
    if (!mapLoaded || !window.T || !window.T.Map || !apiKey || mapInitializedRef.current) return;

    const id = setTimeout(() => {
      const containerEl = containerRef.current || document.getElementById(containerId);
      if (!containerEl || mapInitializedRef.current) return;

      mapInitializedRef.current = true;
      const T = window.T;
      const mapZoom = fitMode === 'china' ? zoom : validLocations.length > 1 ? zoom : Math.min(zoom, 16);
      const map = new T.Map(containerEl);
      map.centerAndZoom(new T.LngLat(centerPoint.lng, centerPoint.lat), mapZoom);

      const bounds = maxBoundsRef.current;
      if (Array.isArray(bounds) && bounds.length === 2 && window.T?.LngLatBounds) {
        const sw = bounds[0];
        const ne = bounds[1];
        const lngLatBounds = new T.LngLatBounds(
          new T.LngLat(Number(sw[1]), Number(sw[0])),
          new T.LngLat(Number(ne[1]), Number(ne[0]))
        );
        if (typeof map.setMaxBounds === 'function') {
          map.setMaxBounds(lngLatBounds);
        }
      }

      mapRef.current = map;
      setMapReady(true);
    }, 0);

    return () => {
      clearTimeout(id);
    };
  }, [apiKey, centerPoint.lat, centerPoint.lng, containerId, fitMode, mapLoaded, validLocations.length, zoom]);

  // 标记点随数据更新，不重建地图
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !window.T || !mapReady) return;

    overlaysRef.current.forEach((overlay) => {
      try {
        map.removeOverLay(overlay);
      } catch {
        // ignore
      }
    });
    overlaysRef.current = [];

    const T = window.T;
    const pathLngLats = [];
    const markerLngLats = [];
    let selectedMarker = null;
    let selectedInfoWin = null;

    validLocations.forEach((location) => {
      const pos = getLngLat(location);
      if (!pos) return;

      const lngLat = new T.LngLat(pos.lng, pos.lat);
      markerLngLats.push(lngLat);
      const marker = new T.Marker(lngLat);
      const infoWin = showInfoWindow
        ? new T.InfoWindow(buildMapInfoWindowHtml(location))
        : null;

      marker.addEventListener('click', () => {
        if (infoWin) marker.openInfoWindow(infoWin);
        if (typeof onMarkerClickRef.current === 'function') {
          onMarkerClickRef.current(location);
        }
      });

      map.addOverLay(marker);
      overlaysRef.current.push(marker);

      const locKey = String(location.key || location._id || '');
      if (showInfoWindow && selectedKey && locKey && locKey === String(selectedKey)) {
        selectedMarker = marker;
        selectedInfoWin = infoWin;
      }
    });

    const clampFitZoom = () => {
      if (!Number.isFinite(minFitZoom) || typeof map.getZoom !== 'function') return;
      const z = map.getZoom();
      if (Number.isFinite(z) && z < minFitZoom) {
        map.setZoom(minFitZoom);
      }
    };

    if (T.Polyline && Array.isArray(path) && path.length >= 2) {
      try {
        const segments =
          pathStyle === 'gradient'
            ? splitPathIntoProgressSegments(path, 5)
            : splitPathIntoProgressSegments(path, 1);
        segments.forEach((seg) => {
          const pts = seg.positions.map((p) => new T.LngLat(p.lng, p.lat));
          pts.forEach((p) => pathLngLats.push(p));
          if (pts.length < 2) return;
          const line = new T.Polyline(pts, {
            color: pathStyle === 'gradient' ? seg.color : 'var(--color-lake)',
            weight: 4,
            opacity: 0.9,
            lineStyle: pathStyle === 'dashed' ? 'dashed' : 'solid',
          });
          map.addOverLay(line);
          overlaysRef.current.push(line);
        });
        if (pathLngLats.length >= 2 && fitMode !== 'china') {
          map.setViewport(pathLngLats);
        }
      } catch {
        // ignore
      }
    }
    if (fitMode === 'china') {
      try {
        map.centerAndZoom(new T.LngLat(centerPoint.lng, centerPoint.lat), zoom);
      } catch {
        // ignore
      }
    } else if (Array.isArray(path) && path.length === 1) {
      try {
        const raw = path[0];
        const lat = Array.isArray(raw) ? Number(raw[0]) : Number(raw?.lat);
        const lng = Array.isArray(raw) ? Number(raw[1]) : Number(raw?.lng);
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          map.panTo(new T.LngLat(lng, lat));
          map.setZoom(Math.min(Math.max(zoom, 11), 14));
        }
      } catch {
        // ignore
      }
    } else if (markerLngLats.length >= 2) {
      try {
        map.setViewport(markerLngLats);
        clampFitZoom();
      } catch {
        // ignore
      }
    } else if (markerLngLats.length === 1) {
      try {
        map.panTo(markerLngLats[0]);
        map.setZoom(Math.min(Math.max(zoom, 11), 14));
      } catch {
        // ignore
      }
    }

    if (showInfoWindow && selectedMarker && selectedInfoWin) {
      try {
        selectedMarker.openInfoWindow(selectedInfoWin);
      } catch {
        // ignore
      }
    }
  }, [
    centerPoint.lat,
    centerPoint.lng,
    fitMode,
    locationsKey,
    mapReady,
    minFitZoom,
    path,
    pathStyle,
    selectedKey,
    showInfoWindow,
    validLocations,
    zoom,
  ]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !window.T) return;
    const typeMap = {
      normal: window.TMAP_NORMAL_MAP,
      hybrid: window.TMAP_HYBRID_MAP || window.TMAP_SATELLITE_MAP,
      terrain: window.TMAP_TERRAIN_HYBRID_MAP || window.TMAP_TERRAIN_MAP,
    };
    const next = typeMap[mapLayer] || window.TMAP_NORMAL_MAP;
    if (!next) return;
    try {
      map.setMapType(next);
    } catch {
      // ignore
    }
  }, [mapLayer, mapReady]);

  // 卸载时销毁地图
  useEffect(() => {
    return () => {
      overlaysRef.current = [];
      mapInitializedRef.current = false;
      if (mapRef.current) {
        try {
          mapRef.current.destroy?.();
        } catch {
          // ignore
        }
        mapRef.current = null;
      }
    };
  }, []);

  if (!apiKey) {
    return (
      <div
        style={{
          height,
          background: '#f0f0f0',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '8px',
          border: '1px solid #ddd',
          padding: '20px',
          textAlign: 'center',
          color: 'var(--text-muted)',
        }}
      >
        <p style={{ margin: '0 0 8px 0' }}>地图功能需要配置天地图 Key</p>
        <p style={{ margin: 0, fontSize: 'var(--type-caption)' }}>
          在 .env 中设置 <code>NEXT_PUBLIC_TIANDITU_TK</code>，应用类型选择「浏览器端」
        </p>
        <a
          href="https://cloudcenter.tianditu.gov.cn/center/development/myApp"
          target="_blank"
          rel="noopener noreferrer"
          style={{ marginTop: '10px', fontSize: 'var(--type-secondary)' }}
        >
          申请天地图 Key →
        </a>
      </div>
    );
  }

  if (validLocations.length === 0) {
    return (
      <div
        style={{
          height,
          background: '#f0f0f0',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '8px',
          border: '1px solid #ddd',
          padding: '20px',
          textAlign: 'center',
          color: 'var(--text-muted)',
        }}
      >
        <p style={{ margin: '0 0 8px 0' }}>📍 暂无位置信息</p>
        <p style={{ margin: 0, fontSize: 'var(--type-caption)' }}>请确保记录包含有效的地理坐标</p>
        <p style={{ margin: '10px 0 0 0', fontSize: 'var(--type-caption)', color: 'var(--text-muted)'}}>
          编辑本记录，在「地点」中从下拉列表<strong>选择</strong>带坐标的地点，地图即可显示
        </p>
      </div>
    );
  }

  if (mapError) {
    return (
      <div
        style={{
          height,
          background: '#f0f0f0',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '8px',
          border: '1px solid #ddd',
          padding: '20px',
          textAlign: 'center',
          color: 'var(--text-muted)',
        }}
      >
        <p style={{ margin: '0 0 8px 0' }}>地图服务当前不可用</p>
        <p style={{ margin: 0, fontSize: 'var(--type-caption)' }}>{mapError}</p>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', height, width: '100%', borderRadius: '8px', overflow: 'hidden', border: '1px solid #ddd' }}>
      <div
        ref={containerRef}
        style={{ height: '100%', width: '100%' }}
        id={containerId}
      />
      {mapReady ? (
        <div className={styles.layerSwitch} role="group" aria-label="地图图层">
          <button
            type="button"
            className={mapLayer === 'normal' ? styles.layerOn : ''}
            onClick={() => setMapLayer('normal')}
          >
            地图
          </button>
          <button
            type="button"
            className={mapLayer === 'hybrid' ? styles.layerOn : ''}
            onClick={() => setMapLayer('hybrid')}
          >
            卫星
          </button>
          <button
            type="button"
            className={mapLayer === 'terrain' ? styles.layerOn : ''}
            onClick={() => setMapLayer('terrain')}
          >
            地形
          </button>
        </div>
      ) : null}
      {!mapLoaded && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(255,255,255,0.8)',
            fontSize: 'var(--type-secondary)',
            color: 'var(--text-muted)',
          }}
        >
          加载地图中...
        </div>
      )}
    </div>
  );
}
