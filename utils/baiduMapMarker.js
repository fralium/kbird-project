/**
 * 百度地图自定义鸟类标记（BMap JS API 3.0）
 * 使用 PNG + 绝对地址：百度 Icon 对相对路径 / SVG 支持很差
 */
export function getBaiduBirdIconUrl() {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/map-marker-bird.png`;
  }
  return '/map-marker-bird.png';
}

/** 默认略瘦；密集足迹可传 { width: 16, height: 20 } */
export function createBaiduBirdIcon(BMap, { width = 22, height = 27 } = {}) {
  if (!BMap?.Icon || !BMap?.Size) return null;
  const size = new BMap.Size(width, height);
  return new BMap.Icon(getBaiduBirdIconUrl(), size, {
    imageSize: size,
    // 尖角对准坐标点
    anchor: new BMap.Size(Math.round(width / 2), height - 1),
  });
}

export function createBaiduBirdMarker(BMap, point, options = {}) {
  const opts = options || {};
  const icon = createBaiduBirdIcon(BMap, opts.iconSize);
  if (icon) {
    return new BMap.Marker(point, { icon, ...(opts.markerOptions || {}) });
  }
  return new BMap.Marker(point, opts.markerOptions || {});
}
