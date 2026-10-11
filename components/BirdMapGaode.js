import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { formatDisplayDate } from '@/utils/localDate';

/**
 * 高德地图组件（使用高德地图API，需要API key）
 * 如果用户有高德地图API key，可以使用这个组件
 * 
 * 申请地址：https://console.amap.com/dev/key/app
 * 个人开发者免费额度：每天30万次调用
 */
export default function BirdMapGaode({ 
  locations = [], 
  center = { lat: 30.2741, lng: 120.1551 },
  zoom = 10,
  height = '400px',
  apiKey = '' // 需要传入高德地图API key
}) {
  const [mapLoaded, setMapLoaded] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !apiKey) return;

    // 动态加载高德地图JS API
    if (!window.AMap) {
      const script = document.createElement('script');
      script.src = `https://webapi.amap.com/maps?v=2.0&key=${apiKey}&callback=initAMap`;
      script.async = true;
      window.initAMap = () => {
        setMapLoaded(true);
      };
      document.head.appendChild(script);
    } else {
      setMapLoaded(true);
    }

    return () => {
      if (window.initAMap) {
        delete window.initAMap;
      }
    };
  }, [apiKey]);

  useEffect(() => {
    if (!mapLoaded || typeof window === 'undefined' || !window.AMap) return;

    const mapCenter = locations.length > 0 
      ? [locations[0].lng || locations[0].coordinates?.[0] || 120.1551, 
         locations[0].lat || locations[0].coordinates?.[1] || 30.2741]
      : [center.lng, center.lat];

    const map = new window.AMap.Map('gaode-map-container', {
      zoom: zoom,
      center: mapCenter,
      viewMode: '3D'
    });

    // 添加标记
    locations.forEach((location, index) => {
      const lng = location.lng || location.coordinates?.[0] || location.location?.coordinates?.coordinates?.[0];
      const lat = location.lat || location.coordinates?.[1] || location.location?.coordinates?.coordinates?.[1];
      
      if (!lat || !lng) return;

      const marker = new window.AMap.Marker({
        position: [lng, lat],
        title: location.name || location.location?.name || '未知地点'
      });

      const infoWindow = new window.AMap.InfoWindow({
        content: `
          <div style="min-width: 150px; padding: 8px;">
            <strong>${location.name || location.location?.name || '未知地点'}</strong>
            ${location.records ? `<div>📝 ${location.records} 条记录</div>` : ''}
            ${location.birds ? `<div>🦜 ${location.birds} 种鸟类</div>` : ''}
            ${location.date ? `<div>📅 ${formatDisplayDate(location.date, 'short')}</div>` : ''}
          </div>
        `
      });

      marker.on('click', () => {
        infoWindow.open(map, marker.getPosition());
      });

      map.add(marker);
    });

    return () => {
      if (map) {
        map.destroy();
      }
    };
  }, [mapLoaded, locations, center, zoom]);

  if (!apiKey) {
    return (
      <div style={{ 
        height, 
        background: '#f0f0f0', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        borderRadius: '8px',
        border: '1px solid #ddd'
      }}>
        <div style={{ textAlign: 'center', color: 'var(--text-muted)'}}>
          <p>地图功能需要高德地图API key</p>
          <p style={{ fontSize: 'var(--type-caption)', marginTop: '8px' }}>
            <a href="https://console.amap.com/dev/key/app" target="_blank" rel="noopener noreferrer">
              免费申请API key
            </a>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ height, width: '100%', borderRadius: '8px', overflow: 'hidden', border: '1px solid #ddd' }}>
      <div id="gaode-map-container" style={{ height: '100%', width: '100%' }} />
      {!mapLoaded && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: '#f0f0f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          加载地图中...
        </div>
      )}
    </div>
  );
}
