'use client';

import dynamic from 'next/dynamic';

const BirdMapBaidu = dynamic(() => import('./BirdMapBaidu'), { ssr: false });
const BirdMapTianditu = dynamic(() => import('./BirdMapTianditu'), { ssr: false });
const BirdMap = dynamic(() => import('./BirdMap'), { ssr: false });

/**
 * 统一地图入口：优先百度 → 天地图 → Leaflet 兜底
 * 配置其一即可：
 * - NEXT_PUBLIC_BAIDU_MAP_AK
 * - NEXT_PUBLIC_TIANDITU_TK
 */
export default function BirdMapProvider(props) {
  const baiduAk =
    typeof process !== 'undefined' ? String(process.env.NEXT_PUBLIC_BAIDU_MAP_AK || '').trim() : '';
  const tiandituTk =
    typeof process !== 'undefined' ? String(process.env.NEXT_PUBLIC_TIANDITU_TK || '').trim() : '';

  if (baiduAk) {
    return <BirdMapBaidu {...props} />;
  }
  if (tiandituTk) {
    return <BirdMapTianditu {...props} />;
  }
  return <BirdMap {...props} />;
}
