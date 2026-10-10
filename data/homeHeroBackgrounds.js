/**
 * 插画生境背景。public/background 里有照片时首页优先用那些，不分类；
 * 文件夹为空时才回到这一组。
 */
export const HOME_HERO_BACKGROUNDS = [
  { id: 'rainforest', src: '/hero-rainforest-bg.png', label: '雨林' },
  { id: 'wetland', src: '/hero-wetland-bg.png', label: '湿地' },
  { id: 'mudflat', src: '/hero-mudflat-bg.png', label: '滩涂' },
  { id: 'woodland', src: '/hero-woodland-bg.png', label: '林地' },
  { id: 'paddy', src: '/hero-paddy-bg.png', label: '稻田' },
  { id: 'lake', src: '/hero-lake-bg.png', label: '湖泊' },
  { id: 'grassland', src: '/hero-grassland-bg.png', label: '草甸' },
  { id: 'bamboo', src: '/hero-bamboo-bg.png', label: '竹林' },
  { id: 'coast', src: '/hero-coast-bg.png', label: '海岸' },
  { id: 'highland', src: '/hero-highland-bg.png', label: '高原' },
  { id: 'reedbed', src: '/hero-reedbed-bg.png', label: '芦苇荡' },
  { id: 'park', src: '/hero-park-bg.png', label: '城郊公园' },
];

export function pickRandomHeroBackground(excludeId, pool) {
  const source = Array.isArray(pool) && pool.length ? pool : HOME_HERO_BACKGROUNDS;
  const candidates = excludeId ? source.filter((item) => item.id !== excludeId) : source;
  const list = candidates.length ? candidates : source;
  const index = Math.floor(Math.random() * list.length);
  return list[index];
}
