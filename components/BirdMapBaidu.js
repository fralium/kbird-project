import { useEffect, useState, useRef, useMemo, useId } from 'react';
import { wgs84ToBd09 } from '../utils/mapCoords';
import { createBaiduBirdMarker } from '../utils/baiduMapMarker';
import { buildMapInfoWindowHtml } from '../utils/mapInfoWindowHtml';
import { splitPathIntoProgressSegments } from '../utils/mapPathSegments';
import styles from '../styles/BirdMapBaidu.module.css';

/**
 * 观鸟地图组件 - 百度地图
 * JavaScript API 3.0，需配置 NEXT_PUBLIC_BAIDU_MAP_AK
 */

export default function BirdMapBaidu({
  locations = [],
  center = { lat: 30.2741, lng: 120.1551 },
  zoom = 10,
  /** 自适应视野时不要再缩小到比这更小 */
  minFitZoom = null,
  /** china = 固定中国幅面；path = 跟轨迹；auto = 跟点/线 */
  fitMode = 'auto',
  height = '400px',
  onMarkerClick,
  /** 标记尺寸，密集点位建议 { width: 16, height: 20 } */
  markerSize = null,
  /** 轨迹：[[lat,lng], ...] 或 [{lat,lng}, ...]（WGS84） */
  path = [],
  /** gradient = 五色实线表早晚；solid/dashed 单色 */
  pathStyle = 'gradient',
  /** 足迹册等场景可关气泡，改用侧栏展示 */
  showInfoWindow = true,
  /** 选中点位 key，用于从列表点选时也打开气泡 */
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
  const mapInitializedRef = useRef(false);
  const reactId = useId().replace(/:/g, '');
  const containerId = `baidu-map-${reactId}`;

  const apiKey = typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_BAIDU_MAP_AK || '' : '';

  useEffect(() => {
    onMarkerClickRef.current = onMarkerClick;
  }, [onMarkerClick]);

  const getLngLat = (location) => {
    const lng = location.lng ?? location.coordinates?.[0] ?? location.location?.coordinates?.coordinates?.[0];
    const lat = location.lat ?? location.coordinates?.[1] ?? location.location?.coordinates?.coordinates?.[1];
    if (lat == null || lng == null) return null;
    const numLng = Number(lng);
    const numLat = Number(lat);
    if (numLng === 0 && numLat === 0) return null;
    if (!Number.isFinite(numLng) || !Number.isFinite(numLat)) return null;
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
    const raw =
      fitMode === 'china' || !first
        ? { lng: center.lng ?? 103.8, lat: center.lat ?? 36.2 }
        : getLngLat(first);
    return wgs84ToBd09(raw.lng, raw.lat);
  }, [center.lat, center.lng, fitMode, validLocations]);

  const pathKey = useMemo(() => JSON.stringify(path || []), [path]);

  useEffect(() => {
    if (typeof window === 'undefined' || !apiKey) return undefined;

    if (window.BMap) {
      setMapError('');
      setMapLoaded(true);
      return undefined;
    }

    const callbackName = `__initBaiduMap_${reactId}`;
    const scriptUrl = `https://api.map.baidu.com/api?v=3.0&ak=${encodeURIComponent(apiKey)}&callback=${callbackName}`;
    let timeoutId = null;

    window[callbackName] = () => {
      if (timeoutId) clearTimeout(timeoutId);
      setMapError('');
      setMapLoaded(true);
    };

    const existing = document.querySelector(`script[data-baidu-map="${apiKey}"]`);
    if (existing) {
      if (window.BMap) {
        setMapLoaded(true);
      }
      return () => {
        try {
          delete window[callbackName];
        } catch {
          // ignore
        }
      };
    }

    const script = document.createElement('script');
    script.src = scriptUrl;
    script.async = true;
    script.dataset.baiduMap = apiKey;
    script.onerror = () => {
      if (timeoutId) clearTimeout(timeoutId);
      setMapLoaded(false);
      setMapError('百度地图脚本加载失败，请检查网络、AK 与域名白名单。');
    };
    document.head.appendChild(script);

    timeoutId = setTimeout(() => {
      if (!window.BMap) {
        setMapLoaded(false);
        setMapError('百度地图加载超时，请确认 AK 类型为「浏览器端」且已放行本地域名。');
      }
    }, 12000);

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      try {
        delete window[callbackName];
      } catch {
        // ignore
      }
    };
  }, [apiKey, reactId]);

  useEffect(() => {
    if (!mapLoaded || !window.BMap || !apiKey || mapInitializedRef.current) return undefined;

    const id = setTimeout(() => {
      const containerEl = containerRef.current || document.getElementById(containerId);
      if (!containerEl || mapInitializedRef.current) return;

      mapInitializedRef.current = true;
      const BMap = window.BMap;
      const mapZoom = fitMode === 'china' ? zoom : validLocations.length > 1 ? zoom : Math.min(zoom, 16);
      const map = new BMap.Map(containerEl);
      map.centerAndZoom(new BMap.Point(centerPoint.lng, centerPoint.lat), mapZoom);
      map.enableScrollWheelZoom(true);
      try {
        if (Number.isFinite(minFitZoom)) map.setMinZoom(minFitZoom);
      } catch {
        // ignore
      }
      map.addControl(new BMap.NavigationControl({ anchor: window.BMAP_ANCHOR_TOP_RIGHT }));
      map.addControl(new BMap.ScaleControl({ anchor: window.BMAP_ANCHOR_BOTTOM_LEFT }));

      mapRef.current = map;
      setMapReady(true);
      try {
        map.checkResize();
      } catch {
        // ignore
      }
    }, 0);

    return () => clearTimeout(id);
  }, [apiKey, centerPoint.lat, centerPoint.lng, containerId, fitMode, mapLoaded, minFitZoom, validLocations.length, zoom]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return undefined;

    const resize = () => {
      try {
        map.checkResize();
      } catch {
        // ignore
      }
    };

    resize();
    const timer = setTimeout(resize, 120);
    const el = containerRef.current;
    let observer;
    if (typeof ResizeObserver !== 'undefined' && el) {
      observer = new ResizeObserver(() => resize());
      observer.observe(el);
    }
    window.addEventListener('resize', resize);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', resize);
      if (observer) observer.disconnect();
    };
  }, [mapReady, height]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !window.BMap || !mapReady) return;

    overlaysRef.current.forEach((overlay) => {
      try {
        map.removeOverlay(overlay);
      } catch {
        // ignore
      }
    });
    overlaysRef.current = [];

    const BMap = window.BMap;
    const points = [];
    const pathPoints = [];
    let selectedInfo = null;

    validLocations.forEach((location) => {
      const raw = getLngLat(location);
      if (!raw) return;
      const pos = wgs84ToBd09(raw.lng, raw.lat);
      const point = new BMap.Point(pos.lng, pos.lat);
      points.push(point);

      const marker = createBaiduBirdMarker(
        BMap,
        point,
        markerSize ? { iconSize: markerSize } : undefined
      );
      const infoWin = showInfoWindow
        ? new BMap.InfoWindow(buildMapInfoWindowHtml(location), {
            width: 0,
            height: 0,
            title: '',
            enableMessage: false,
          })
        : null;

      marker.addEventListener('click', () => {
        if (infoWin) {
          map.openInfoWindow(infoWin, point);
        }
        if (typeof onMarkerClickRef.current === 'function') {
          onMarkerClickRef.current(location);
        }
      });

      map.addOverlay(marker);
      overlaysRef.current.push(marker);

      const locKey = String(location.key || location._id || '');
      if (showInfoWindow && selectedKey && locKey && locKey === String(selectedKey)) {
        selectedInfo = { infoWin, point };
      }
    });

    const toBdPoint = (coord) => {
      const pos = wgs84ToBd09(coord.lng, coord.lat);
      return new BMap.Point(pos.lng, pos.lat);
    };

    if (BMap.Polyline && Array.isArray(path) && path.length >= 2) {
      try {
        const segments = splitPathIntoProgressSegments(path, pathStyle === 'gradient' ? 5 : 1);
        segments.forEach((seg) => {
          const pts = seg.positions.map(toBdPoint);
          if (pts.length < 2) return;
          pts.forEach((p) => pathPoints.push(p));
          const polyline = new BMap.Polyline(pts, {
            strokeColor: pathStyle === 'gradient' ? seg.color : '#219EBC',
            strokeWeight: 5,
            strokeOpacity: 0.95,
            strokeStyle: pathStyle === 'dashed' ? 'dashed' : 'solid',
          });
          map.addOverlay(polyline);
          overlaysRef.current.push(polyline);
        });
      } catch {
        // ignore polyline failures
      }
    }

    if (fitMode === 'china') {
      map.centerAndZoom(new BMap.Point(centerPoint.lng, centerPoint.lat), zoom);
    } else if (pathPoints.length > 1) {
      try {
        map.setViewport(pathPoints, { margins: [36, 36, 36, 36] });
      } catch {
        // ignore
      }
    } else if (points.length > 1) {
      try {
        map.setViewport(points, { margins: [28, 40, 28, 40] });
        if (Number.isFinite(minFitZoom) && typeof map.getZoom === 'function') {
          const z = map.getZoom();
          if (Number.isFinite(z) && z < minFitZoom) map.setZoom(minFitZoom);
        }
      } catch {
        // ignore
      }
    } else if (pathPoints.length === 1 || points.length === 1) {
      map.centerAndZoom(pathPoints[0] || points[0], Math.min(Math.max(zoom, 11), 14));
    } else {
      map.centerAndZoom(new BMap.Point(centerPoint.lng, centerPoint.lat), zoom);
    }

    try {
      map.checkResize();
    } catch {
      // ignore
    }

    if (showInfoWindow && selectedInfo?.infoWin && selectedInfo.point) {
      try {
        map.openInfoWindow(selectedInfo.infoWin, selectedInfo.point);
      } catch {
        // ignore
      }
    } else if (showInfoWindow && !selectedKey && typeof map.closeInfoWindow === 'function') {
      try {
        map.closeInfoWindow();
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
    markerSize,
    minFitZoom,
    pathKey,
    pathStyle,
    selectedKey,
    showInfoWindow,
    validLocations,
    zoom,
  ]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    let next = window.BMAP_NORMAL_MAP;
    if (mapLayer === 'hybrid') {
      next = window.BMAP_HYBRID_MAP || window.BMAP_SATELLITE_MAP;
    } else if (mapLayer === 'terrain') {
      // 百度 3.0 无标准地形图时，退回纯卫星影像
      next = window.BMAP_EARTH_MAP || window.BMAP_SATELLITE_MAP || window.BMAP_HYBRID_MAP;
    }
    if (!next) return;
    try {
      map.setMapType(next);
      map.checkResize();
    } catch {
      // ignore
    }
  }, [mapLayer, mapReady]);

  useEffect(() => {
    return () => {
      overlaysRef.current = [];
      mapInitializedRef.current = false;
      mapRef.current = null;
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
          color: '#666',
        }}
      >
        <p style={{ margin: '0 0 8px 0' }}>地图功能需要配置百度地图 AK</p>
        <p style={{ margin: 0, fontSize: '12px' }}>
          在 .env 中设置 <code>NEXT_PUBLIC_BAIDU_MAP_AK</code>，应用类型选择「浏览器端」
        </p>
        <a
          href="https://lbsyun.baidu.com/apiconsole/key"
          target="_blank"
          rel="noopener noreferrer"
          style={{ marginTop: '10px', fontSize: '13px' }}
        >
          申请百度地图 AK →
        </a>
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
          color: '#666',
        }}
      >
        <p style={{ margin: '0 0 8px 0' }}>百度地图当前不可用</p>
        <p style={{ margin: 0, fontSize: '12px' }}>{mapError}</p>
      </div>
    );
  }

  return (
    <div
      style={{
        position: 'relative',
        height,
        width: '100%',
        borderRadius: '8px',
        overflow: 'hidden',
        border: '1px solid #ddd',
      }}
    >
      <div ref={containerRef} id={containerId} style={{ height: '100%', width: '100%' }} />
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
      {!mapLoaded || !mapReady ? (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(255,255,255,0.8)',
            color: '#666',
            pointerEvents: 'none',
          }}
        >
          百度地图加载中…
        </div>
      ) : null}
      {mapReady && validLocations.length === 0 ? (
        <div
          style={{
            position: 'absolute',
            left: 10,
            bottom: 10,
            zIndex: 10,
            background: 'rgba(255,255,255,0.92)',
            border: '1px solid #dde5ec',
            borderRadius: 8,
            padding: '8px 10px',
            fontSize: 12,
            color: '#5f6c72',
            maxWidth: '72%',
          }}
        >
          当前区域暂无带坐标的地点标记；可先查看底图，或补全地点坐标。
        </div>
      ) : null}
    </div>
  );
}
