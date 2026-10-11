import { useEffect, useId, useRef, useState } from 'react';
import { api } from '@/utils/api';
import { bd09ToWgs84, wgs84ToBd09 } from '@/utils/mapCoords';
import { createBaiduBirdMarker } from '@/utils/baiduMapMarker';

/**
 * 地点编辑页地图选点
 * 优先百度地图（NEXT_PUBLIC_BAIDU_MAP_AK）：点击/拖拽选点 + 本地搜索
 * 否则天地图（NEXT_PUBLIC_TIANDITU_TK）+ 服务端地理编码
 * 库内坐标按近似 WGS84 存；百度底图用 BD-09 展示并做双向转换
 */
export default function LocationMapPicker({
  latitude = '',
  longitude = '',
  onCoordinatesChange,
  onAddressFromSearch,
  height = '360px',
}) {
  const baiduAk =
    typeof process !== 'undefined' ? String(process.env.NEXT_PUBLIC_BAIDU_MAP_AK || '').trim() : '';
  const tiandituTk =
    typeof process !== 'undefined' ? String(process.env.NEXT_PUBLIC_TIANDITU_TK || '').trim() : '';

  if (baiduAk) {
    return (
      <BaiduLocationPicker
        apiKey={baiduAk}
        latitude={latitude}
        longitude={longitude}
        onCoordinatesChange={onCoordinatesChange}
        onAddressFromSearch={onAddressFromSearch}
        height={height}
      />
    );
  }

  if (tiandituTk) {
    return (
      <TiandituLocationPicker
        apiKey={tiandituTk}
        latitude={latitude}
        longitude={longitude}
        onCoordinatesChange={onCoordinatesChange}
        onAddressFromSearch={onAddressFromSearch}
        height={height}
      />
    );
  }

  return (
    <div className="location-map-picker" style={{ padding: '16px', background: '#f5f5f5', borderRadius: 8 }}>
      <p style={{ margin: 0, color: 'var(--text-muted)'}}>
        请配置 <code>NEXT_PUBLIC_BAIDU_MAP_AK</code>（推荐）或 <code>NEXT_PUBLIC_TIANDITU_TK</code> 后使用地图选点。
      </p>
    </div>
  );
}

function parseCoords(latitude, longitude) {
  const lat = latitude !== '' && latitude !== undefined ? parseFloat(latitude) : null;
  const lng = longitude !== '' && longitude !== undefined ? parseFloat(longitude) : null;
  const hasCoords =
    lat != null &&
    !Number.isNaN(lat) &&
    lng != null &&
    !Number.isNaN(lng) &&
    (lat !== 0 || lng !== 0);
  return {
    lat: hasCoords ? lat : null,
    lng: hasCoords ? lng : null,
    hasCoords,
    centerLat: hasCoords ? lat : 30.2741,
    centerLng: hasCoords ? lng : 120.1551,
  };
}

function SearchBar({ searchKeyword, setSearchKeyword, onSearch, searching, searchError, buttonLabel }) {
  return (
    <>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
        <input
          type="text"
          value={searchKeyword}
          onChange={(e) => setSearchKeyword(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              onSearch();
            }
          }}
          placeholder="输入地名或地址搜索（如：映月台、西湖）"
          style={{ flex: '1', minWidth: 200, padding: '8px 12px', border: '1px solid #ddd', borderRadius: 6 }}
        />
        <button
          type="button"
          onClick={onSearch}
          disabled={searching}
          style={{
            padding: '8px 16px',
            background: '#219EBC',
            color: 'var(--text-white)',
            border: 'none',
            borderRadius: 6,
            cursor: searching ? 'wait' : 'pointer',
          }}
        >
          {searching ? '搜索中…' : buttonLabel}
        </button>
      </div>
      {searchError ? <p style={{ margin: '0 0 8px 0', fontSize: 12, color: '#c00'}}>{searchError}</p> : null}
    </>
  );
}

function BaiduLocationPicker({
  apiKey,
  latitude,
  longitude,
  onCoordinatesChange,
  onAddressFromSearch,
  height,
}) {
  const { hasCoords, centerLat, centerLng, lat, lng } = parseCoords(latitude, longitude);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState('');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const initRef = useRef(false);
  const onCoordinatesChangeRef = useRef(onCoordinatesChange);
  const onAddressFromSearchRef = useRef(onAddressFromSearch);
  const reactId = useId().replace(/:/g, '');
  const containerId = `location-edit-baidu-${reactId}`;
  const containerRef = useRef(null);

  useEffect(() => {
    onCoordinatesChangeRef.current = onCoordinatesChange;
  }, [onCoordinatesChange]);

  useEffect(() => {
    onAddressFromSearchRef.current = onAddressFromSearch;
  }, [onAddressFromSearch]);

  useEffect(() => {
    if (typeof window === 'undefined' || !apiKey) return undefined;

    if (window.BMap) {
      setMapError('');
      setMapLoaded(true);
      return undefined;
    }

    const callbackName = `__initBaiduLocPicker_${reactId}`;
    const scriptUrl = `https://api.map.baidu.com/api?v=3.0&ak=${encodeURIComponent(apiKey)}&callback=${callbackName}`;
    let timeoutId = null;

    window[callbackName] = () => {
      if (timeoutId) clearTimeout(timeoutId);
      setMapError('');
      setMapLoaded(true);
    };

    const existing = document.querySelector(`script[data-baidu-map="${apiKey}"]`);
    if (existing) {
      if (window.BMap) setMapLoaded(true);
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
        setMapError('百度地图加载超时，请确认 AK 为「浏览器端」且已放行 localhost。');
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
    if (!mapLoaded || !window.BMap || !apiKey || initRef.current) return undefined;

    const timer = setTimeout(() => {
      const el = containerRef.current || document.getElementById(containerId);
      if (!el || initRef.current) return;

      initRef.current = true;
      const BMap = window.BMap;
      const display = wgs84ToBd09(centerLng, centerLat);
      const map = new BMap.Map(el);
      map.centerAndZoom(new BMap.Point(display.lng, display.lat), 15);
      map.enableScrollWheelZoom(true);
      map.addControl(new BMap.NavigationControl({ anchor: window.BMAP_ANCHOR_TOP_RIGHT }));
      mapRef.current = map;

      const marker = createBaiduBirdMarker(BMap, new BMap.Point(display.lng, display.lat), {
        markerOptions: { enableDragging: true },
      });
      map.addOverlay(marker);
      markerRef.current = marker;

      const emitFromBd09 = (point) => {
        if (!point || !onCoordinatesChangeRef.current) return;
        const wgs = bd09ToWgs84(point.lng, point.lat);
        onCoordinatesChangeRef.current({
          latitude: Number(wgs.lat.toFixed(6)),
          longitude: Number(wgs.lng.toFixed(6)),
        });
      };

      marker.addEventListener('dragend', () => {
        const pos = marker.getPosition();
        if (pos) emitFromBd09(pos);
      });

      map.addEventListener('click', (e) => {
        const point = e.point;
        if (!point) return;
        marker.setPosition(point);
        emitFromBd09(point);
      });
    }, 0);

    return () => clearTimeout(timer);
    // 仅在脚本就绪时初始化一次；坐标变化由下方 effect 同步标记，避免点选后整图重建
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey, containerId, mapLoaded]);

  useEffect(() => {
    return () => {
      initRef.current = false;
      mapRef.current = null;
      markerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current || !markerRef.current || !window.BMap || !hasCoords) return;
    const display = wgs84ToBd09(lng, lat);
    const point = new window.BMap.Point(display.lng, display.lat);
    markerRef.current.setPosition(point);
    mapRef.current.centerAndZoom(point, mapRef.current.getZoom() || 15);
  }, [hasCoords, lat, lng]);

  const handleSearch = () => {
    const keyword = searchKeyword.trim();
    if (!keyword) return;
    if (!mapRef.current || !window.BMap) {
      setSearchError('地图尚未就绪，请稍后再试');
      return;
    }

    setSearching(true);
    setSearchError('');

    const BMap = window.BMap;
    const local = new BMap.LocalSearch(mapRef.current, {
      onSearchComplete: (results) => {
        setSearching(false);
        const status = local.getStatus();
        if (status !== window.BMAP_STATUS_SUCCESS || !results || results.getCurrentNumPois() < 1) {
          setSearchError('未找到该地点，请换关键词试试');
          return;
        }
        const poi = results.getPoi(0);
        if (!poi?.point) {
          setSearchError('未解析出坐标');
          return;
        }

        if (markerRef.current) markerRef.current.setPosition(poi.point);
        mapRef.current.centerAndZoom(poi.point, 16);

        const wgs = bd09ToWgs84(poi.point.lng, poi.point.lat);
        if (onCoordinatesChangeRef.current) {
          onCoordinatesChangeRef.current({
            latitude: Number(wgs.lat.toFixed(6)),
            longitude: Number(wgs.lng.toFixed(6)),
          });
        }
        if (onAddressFromSearchRef.current) {
          onAddressFromSearchRef.current(poi.address || poi.title || keyword);
        }
      },
    });
    local.search(keyword);
  };

  if (mapError) {
    return (
      <div className="location-map-picker" style={{ padding: '16px', background: '#f5f5f5', borderRadius: 8 }}>
        <p style={{ margin: 0, color: '#c00'}}>{mapError}</p>
      </div>
    );
  }

  return (
    <div className="location-map-picker" style={{ marginTop: 8, position: 'relative' }}>
      <SearchBar
        searchKeyword={searchKeyword}
        setSearchKeyword={setSearchKeyword}
        onSearch={handleSearch}
        searching={searching}
        searchError={searchError}
        buttonLabel="百度搜索"
      />
      <div
        style={{
          position: 'relative',
          height,
          width: '100%',
          borderRadius: 8,
          border: '1px solid #ddd',
          overflow: 'hidden',
        }}
      >
        <div ref={containerRef} id={containerId} style={{ height: '100%', width: '100%' }} />
        {!mapLoaded && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(255,255,255,0.9)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 14,
              color: 'var(--text-muted)',
            }}
          >
            百度地图加载中…
          </div>
        )}
      </div>
      <p style={{ margin: '8px 0 0 0', fontSize: 12, color: 'var(--text-muted)'}}>
        点击地图或拖拽标记设点；下方经纬度为库内坐标（WGS84 近似）。
      </p>
    </div>
  );
}

function TiandituLocationPicker({
  apiKey,
  latitude,
  longitude,
  onCoordinatesChange,
  onAddressFromSearch,
  height,
}) {
  const CONTAINER_ID = 'location-edit-map-container';
  const { hasCoords, centerLat, centerLng, lat, lng } = parseCoords(latitude, longitude);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const initRef = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !apiKey) return;
    if (window.T && window.T.Map) {
      setMapLoaded(true);
      return;
    }
    const script = document.createElement('script');
    script.src = `https://api.tianditu.gov.cn/api?v=4.0&tk=${apiKey}`;
    script.async = true;
    script.onload = () => setMapLoaded(true);
    script.onerror = () => setMapLoaded(false);
    document.head.appendChild(script);
  }, [apiKey]);

  useEffect(() => {
    if (!mapLoaded || !window.T || !apiKey) return;
    const containerEl = document.getElementById(CONTAINER_ID);
    if (!containerEl || initRef.current) return;

    initRef.current = true;
    const T = window.T;
    const map = new T.Map(containerEl);
    map.centerAndZoom(new T.LngLat(centerLng, centerLat), 15);
    mapRef.current = map;

    const marker = new T.Marker(new T.LngLat(centerLng, centerLat));
    markerRef.current = marker;
    map.addOverLay(marker);

    const updateFromPosition = (lngLat) => {
      const lon = typeof lngLat.getLng === 'function' ? lngLat.getLng() : lngLat.lng;
      const latVal = typeof lngLat.getLat === 'function' ? lngLat.getLat() : lngLat.lat;
      if (onCoordinatesChange) onCoordinatesChange({ latitude: latVal, longitude: lon });
    };

    if (typeof marker.addEventListener === 'function') {
      marker.addEventListener('dragend', () => {
        const pos = marker.getPosition ? marker.getPosition() : marker.getLngLat?.();
        if (pos) updateFromPosition(pos);
      });
    }

    map.addEventListener('click', (e) => {
      const lngLat = e.lnglat || e.lngLat;
      if (lngLat) {
        if (marker.setPosition) marker.setPosition(lngLat);
        else if (marker.setLngLat) marker.setLngLat(lngLat);
        updateFromPosition(lngLat);
      }
    });

    return () => {
      initRef.current = false;
      if (mapRef.current) {
        try {
          mapRef.current.destroy?.();
        } catch {
          // ignore
        }
        mapRef.current = null;
      }
      markerRef.current = null;
    };
  }, [apiKey, centerLat, centerLng, mapLoaded, onCoordinatesChange]);

  useEffect(() => {
    if (!mapRef.current || !markerRef.current || !window.T) return;
    if (!hasCoords) return;
    const T = window.T;
    const pt = new T.LngLat(lng, lat);
    const marker = markerRef.current;
    if (marker.setPosition) marker.setPosition(pt);
    else if (marker.setLngLat) marker.setLngLat(pt);
    mapRef.current.centerAndZoom(pt, mapRef.current.getZoom() || 15);
  }, [lat, lng, hasCoords]);

  const handleSearch = async () => {
    const keyword = searchKeyword.trim();
    if (!keyword) return;
    setSearching(true);
    setSearchError('');
    try {
      const data = await api.tianditu.geocode(keyword);
      if (data.status === 0 && data.location) {
        const { lon, lat: latVal } = data.location;
        if (lon != null && latVal != null) {
          if (onCoordinatesChange) onCoordinatesChange({ latitude: latVal, longitude: lon });
          if (onAddressFromSearch && data.address) onAddressFromSearch(data.address);
          if (markerRef.current && mapRef.current && window.T) {
            const T = window.T;
            const pt = new T.LngLat(lon, latVal);
            const marker = markerRef.current;
            if (marker.setPosition) marker.setPosition(pt);
            else if (marker.setLngLat) marker.setLngLat(pt);
            mapRef.current.centerAndZoom(pt, 16);
          }
        } else {
          setSearchError('未解析出坐标');
        }
      } else {
        const msg = data.msg || '未找到该地点，请换关键词试试';
        setSearchError(
          msg.includes('权限') || msg.includes('key') || msg.includes('Key')
            ? `${msg}。请检查：是否已配置服务器端 Key（.env 中的 TIANDITU_SERVER_TK），并在天地图官网申请「服务器端」应用。`
            : msg
        );
      }
    } catch {
      setSearchError('搜索请求失败，请检查网络');
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="location-map-picker" style={{ marginTop: 8, position: 'relative' }}>
      <SearchBar
        searchKeyword={searchKeyword}
        setSearchKeyword={setSearchKeyword}
        onSearch={handleSearch}
        searching={searching}
        searchError={searchError}
        buttonLabel="天地图搜索"
      />
      <div
        style={{
          position: 'relative',
          height,
          width: '100%',
          borderRadius: 8,
          border: '1px solid #ddd',
          overflow: 'hidden',
        }}
      >
        <div id={CONTAINER_ID} style={{ height: '100%', width: '100%' }} />
        {!mapLoaded && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(255,255,255,0.9)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 14,
              color: 'var(--text-muted)',
            }}
          >
            加载地图中…
          </div>
        )}
      </div>
    </div>
  );
}
