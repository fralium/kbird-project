import { normalizeRegionLabel } from '@/data/chinaRegions';

/** 省/直辖市视角中心（筛选后地图落到对应区域） */
export const REGION_VIEW_CENTERS = {
  北京: { lat: 39.9042, lng: 116.4074 },
  天津: { lat: 39.0842, lng: 117.2009 },
  上海: { lat: 31.2304, lng: 121.4737 },
  重庆: { lat: 29.563, lng: 106.5516 },
  河北: { lat: 38.0428, lng: 114.5149 },
  山西: { lat: 37.8706, lng: 112.5489 },
  内蒙古: { lat: 40.8173, lng: 111.7656 },
  辽宁: { lat: 41.8057, lng: 123.4315 },
  吉林: { lat: 43.8171, lng: 125.3235 },
  黑龙江: { lat: 45.8038, lng: 126.5349 },
  江苏: { lat: 32.0603, lng: 118.7969 },
  浙江: { lat: 30.2741, lng: 120.1551 },
  安徽: { lat: 31.8612, lng: 117.2857 },
  福建: { lat: 26.0745, lng: 119.2965 },
  江西: { lat: 28.6757, lng: 115.9092 },
  山东: { lat: 36.6512, lng: 117.1201 },
  河南: { lat: 34.7466, lng: 113.6254 },
  湖北: { lat: 30.5928, lng: 114.3055 },
  湖南: { lat: 28.2282, lng: 112.9388 },
  广东: { lat: 23.1291, lng: 113.2644 },
  广西: { lat: 22.817, lng: 108.3669 },
  海南: { lat: 20.0174, lng: 110.3492 },
  四川: { lat: 30.5728, lng: 104.0668 },
  贵州: { lat: 26.647, lng: 106.6302 },
  云南: { lat: 25.0389, lng: 102.7183 },
  西藏: { lat: 29.652, lng: 91.1721 },
  陕西: { lat: 34.3416, lng: 108.9398 },
  甘肃: { lat: 36.0611, lng: 103.8343 },
  青海: { lat: 36.6171, lng: 101.7782 },
  宁夏: { lat: 38.4872, lng: 106.2309 },
  新疆: { lat: 43.793, lng: 87.6271 },
  香港: { lat: 22.3193, lng: 114.1694 },
  澳门: { lat: 22.1987, lng: 113.5439 },
  台湾: { lat: 25.033, lng: 121.5654 },
};

export function getRegionViewCenter(provinceName, cityName) {
  const cityKey = normalizeRegionLabel(cityName);
  const provinceKey = normalizeRegionLabel(provinceName);
  if (cityKey && REGION_VIEW_CENTERS[cityKey]) {
    return { ...REGION_VIEW_CENTERS[cityKey], zoom: 10 };
  }
  if (provinceKey && REGION_VIEW_CENTERS[provinceKey]) {
    return { ...REGION_VIEW_CENTERS[provinceKey], zoom: provinceKey.length <= 2 ? 9 : 7 };
  }
  return { lat: 35.8, lng: 104.2, zoom: 5 };
}
