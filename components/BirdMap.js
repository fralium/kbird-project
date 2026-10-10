import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useMap } from 'react-leaflet';
import layerStyles from '../styles/BirdMapBaidu.module.css';

// 动态导入Leaflet，避免SSR问题
const MapContainer = dynamic(() => import('react-leaflet').then(mod => mod.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import('react-leaflet').then(mod => mod.TileLayer), { ssr: false });
const Marker = dynamic(() => import('react-leaflet').then(mod => mod.Marker), { ssr: false });
const Popup = dynamic(() => import('react-leaflet').then(mod => mod.Popup), { ssr: false });
const CircleMarker = dynamic(() => import('react-leaflet').then(mod => mod.CircleMarker), { ssr: false });
const Polyline = dynamic(() => import('react-leaflet').then(mod => mod.Polyline), { ssr: false });

// 导入Leaflet CSS
import 'leaflet/dist/leaflet.css';

// 修复默认图标路径问题
import L from 'leaflet';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
import { splitPathIntoProgressSegments } from '../utils/mapPathSegments';

// 修复默认图标
const DefaultIcon = L.icon({
  iconUrl: icon.src || icon,
  shadowUrl: iconShadow.src || iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

function makeMarkerIcon(markerSize) {
  if (!markerSize?.width || !markerSize?.height) return DefaultIcon;
  const w = Number(markerSize.width) || 16;
  const h = Number(markerSize.height) || 20;
  return L.icon({
    iconUrl: icon.src || icon,
    shadowUrl: iconShadow.src || iconShadow,
    iconSize: [w, h],
    iconAnchor: [Math.round(w / 2), h],
    popupAnchor: [0, -Math.round(h * 0.8)],
    shadowSize: [Math.round(w * 1.2), Math.round(h * 0.9)],
    shadowAnchor: [Math.round(w * 0.35), Math.round(h * 0.9)],
  });
}

L.Marker.prototype.options.icon = DefaultIcon;

function SelectableMarker({ selected, children, ...markerProps }) {
  const markerRef = useRef(null);
  useEffect(() => {
    const marker = markerRef.current;
    if (!marker) return;
    if (selected) marker.openPopup();
    else marker.closePopup();
  }, [selected]);
  return (
    <Marker ref={markerRef} {...markerProps}>
      {children}
    </Marker>
  );
}

function FitFocus({ positions, minZoom }) {
  const map = useMap();
  useEffect(() => {
    if (!map || !Array.isArray(positions) || positions.length < 2) return;
    try {
      const bounds = L.latLngBounds(positions);
      map.fitBounds(bounds, { padding: [24, 32], maxZoom: 14 });
      if (Number.isFinite(minZoom) && map.getZoom() < minZoom) {
        map.setZoom(minZoom);
      }
    } catch {
      // ignore
    }
  }, [map, minZoom, positions]);
  return null;
}

/**
 * 观鸟地图组件
 * @param {Array} locations - 位置数组，格式: [{ lat, lng, name, records?, birds? }]
 * @param {Object} center - 中心点 { lat, lng }
 * @param {Number} zoom - 缩放级别
 * @param {Boolean} showMarkers - 是否显示标记
 * @param {Boolean} showCircles - 是否显示圆圈（用于热力图效果）
 * @param {String} height - 地图高度
 */
export default function BirdMap({ 
  locations = [], 
  center = { lat: 30.2741, lng: 120.1551 }, // 默认杭州
  zoom = 10,
  showMarkers = true,
  showCircles = false,
  height = '400px',
  mapProvider = 'cartodb', // 'cartodb' | 'osm' | 'esri'
  onMarkerClick,
  markerSize = null,
  maxBounds,
  path = [],
  /** gradient = 五色实线表早晚；solid/dashed 单色 */
  pathStyle = 'gradient',
  minFitZoom = null,
  fitMode = 'auto',
  showInfoWindow = true,
  selectedKey = '',
}) {
  const [mapLayer, setMapLayer] = useState('normal');
  // 如果没有位置数据，使用默认中心点；(0,0) 视为未选有效地点
  const getLocationCoords = (location) => {
    let lat, lng;
    if (location.lat != null && location.lng != null) {
      lat = location.lat; lng = location.lng;
    } else if (location.coordinates && Array.isArray(location.coordinates)) {
      lat = location.coordinates[1] ?? location.coordinates[0];
      lng = location.coordinates[0] ?? location.coordinates[1];
    } else if (location.location?.coordinates?.coordinates) {
      const c = location.location.coordinates.coordinates;
      lat = c[1]; lng = c[0];
    } else return null;
    if (Number(lat) === 0 && Number(lng) === 0) return null;
    return [lat, lng];
  };

  const validLocations = locations.filter(loc => getLocationCoords(loc) !== null);
  const mapCenter =
    fitMode === 'china' || validLocations.length === 0
      ? [center.lat, center.lng]
      : getLocationCoords(validLocations[0]);

  // 计算合适的缩放级别
  const mapZoom = fitMode === 'china' ? zoom : locations.length > 1 ? zoom : (zoom > 12 ? 12 : zoom);
  const fitPositions =
    fitMode === 'china'
      ? []
      : Array.isArray(path) && path.length >= 2
        ? path.map((c) => (Array.isArray(c) ? c : [c.lat, c.lng]))
        : validLocations.map((loc) => getLocationCoords(loc)).filter(Boolean);

  // 检查是否在客户端
  if (typeof window === 'undefined') {
    return <div style={{ height, background: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px', border: '1px solid #ddd' }}>加载地图中...</div>;
  }

  // 如果没有有效位置，显示提示
  if (validLocations.length === 0) {
    return (
      <div style={{ 
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
        color: '#666'
      }}>
        <p style={{ margin: '0 0 8px 0' }}>📍 暂无位置信息</p>
        <p style={{ margin: 0, fontSize: '12px' }}>请确保记录包含有效的地理坐标</p>
        <p style={{ margin: '10px 0 0 0', fontSize: '12px', color: '#888' }}>
          编辑本记录，在「地点」中从下拉列表<strong>选择</strong>带坐标的地点，地图即可显示
        </p>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', height, width: '100%', borderRadius: '8px', overflow: 'hidden', border: '1px solid #ddd' }}>
      <MapContainer
        center={mapCenter}
        zoom={mapZoom}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={true}
        maxBounds={maxBounds}
        maxBoundsViscosity={maxBounds ? 0.8 : undefined}
        minZoom={Number.isFinite(minFitZoom) ? minFitZoom : undefined}
      >
        {fitPositions.length >= 2 ? (
          <FitFocus positions={fitPositions} minZoom={minFitZoom} />
        ) : null}
        {mapLayer === 'normal' ? (
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
            subdomains="abcd"
            maxZoom={20}
          />
        ) : null}
        {mapLayer === 'hybrid' ? (
          <TileLayer
            attribution="Tiles &copy; Esri"
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            maxZoom={19}
          />
        ) : null}
        {mapLayer === 'terrain' ? (
          <TileLayer
            attribution='Map data: &copy; OpenStreetMap, SRTM | Map style: &copy; OpenTopoMap'
            url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
            maxZoom={17}
          />
        ) : null}
        
        {Array.isArray(path) && path.length >= 2
          ? (pathStyle === 'gradient'
              ? splitPathIntoProgressSegments(path, 5)
              : splitPathIntoProgressSegments(path, 1)
            ).map((seg) => (
              <Polyline
                key={`path-seg-${seg.index}-${seg.color}`}
                positions={seg.positions.map((p) => [p.lat, p.lng])}
                pathOptions={{
                  color: pathStyle === 'gradient' ? seg.color : '#219EBC',
                  weight: 4,
                  opacity: 0.9,
                  dashArray: pathStyle === 'dashed' ? '8 10' : undefined,
                }}
              />
            ))
          : null}

        {showMarkers && validLocations.map((location, index) => {
          const coords = getLocationCoords(location);
          if (!coords) return null;
          const [lat, lng] = coords;

          const name = location.name || location.location?.name || '未知地点';
          const recordCount = location.records || location.recordCount || 0;
          const birdCount = location.birds || location.birdCount || 0;
          const locKey = String(location.key || location._id || '');
          const selected = Boolean(selectedKey && locKey && locKey === String(selectedKey));

          return (
            <SelectableMarker
              key={location._id || location.key || index}
              selected={selected && showInfoWindow}
              position={[lat, lng]}
              icon={makeMarkerIcon(markerSize)}
              eventHandlers={{
                click: () => {
                  if (typeof onMarkerClick === 'function') {
                    onMarkerClick(location);
                  }
                },
              }}
            >
              {showInfoWindow ? (
                <Popup>
                  <div style={{ minWidth: 160, borderLeft: '3px solid #219EBC', paddingLeft: 10 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#219EBC' }}>足迹点位</div>
                    <strong style={{ color: '#023047' }}>{name}</strong>
                    {birdCount > 0 ? <div style={{ fontSize: 12, color: '#5c6b7a' }}>{birdCount} 种</div> : null}
                    {recordCount > 0 ? <div style={{ fontSize: 12, color: '#5c6b7a' }}>{recordCount} 次</div> : null}
                  </div>
                </Popup>
              ) : null}
            </SelectableMarker>
          );
        })}

        {showCircles && validLocations.map((location, index) => {
          const coords = getLocationCoords(location);
          if (!coords) return null;
          const [lat, lng] = coords;

          const recordCount = location.records || location.recordCount || 1;
          const radius = Math.min(20, Math.max(5, recordCount * 2));

          return (
            <CircleMarker
              key={`circle-${index}`}
              center={[lat, lng]}
              radius={radius}
              eventHandlers={{
                click: () => {
                  if (typeof onMarkerClick === 'function') {
                    onMarkerClick(location);
                  }
                },
              }}
              pathOptions={{
                fillColor: '#219EBC',
                fillOpacity: 0.6,
                color: '#1780a0',
                weight: 2
              }}
            >
              <Popup>
                <div style={{ minWidth: '150px' }}>
                  <strong>{location.name || location.location?.name || '未知地点'}</strong>
                  <div>📝 {recordCount} 条记录</div>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>
      <div className={layerStyles.layerSwitch} role="group" aria-label="地图图层">
        <button
          type="button"
          className={mapLayer === 'normal' ? layerStyles.layerOn : ''}
          onClick={() => setMapLayer('normal')}
        >
          地图
        </button>
        <button
          type="button"
          className={mapLayer === 'hybrid' ? layerStyles.layerOn : ''}
          onClick={() => setMapLayer('hybrid')}
        >
          卫星
        </button>
        <button
          type="button"
          className={mapLayer === 'terrain' ? layerStyles.layerOn : ''}
          onClick={() => setMapLayer('terrain')}
        >
          地形
        </button>
      </div>
    </div>
  );
}
