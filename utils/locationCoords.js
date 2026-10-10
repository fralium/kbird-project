/** 从地点对象提取 [lng, lat]；无效则返回 null */
export function extractLngLatPair(locationOrCoords) {
  if (!locationOrCoords) return null;
  const c = locationOrCoords.coordinates ?? locationOrCoords;
  const pair = Array.isArray(c) ? c : c?.coordinates;
  if (!Array.isArray(pair) || pair.length < 2) return null;
  const lng = Number(pair[0]);
  const lat = Number(pair[1]);
  if (!Number.isFinite(lng) || !Number.isFinite(lat) || (lng === 0 && lat === 0)) {
    return null;
  }
  return [lng, lat];
}
