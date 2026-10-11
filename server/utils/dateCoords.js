/** 本地日历日 YYYY-MM-DD（避免 toISOString 在 UTC+8 凌晨变成昨天） */
function formatLocalDateKey(dateLike = new Date()) {
  const d = dateLike instanceof Date ? dateLike : new Date(dateLike);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function todayLocalDateKey() {
  return formatLocalDateKey(new Date());
}

/** 展示用短日期（中文环境），与前端 formatDisplayDate(…, 'short') 对齐 */
function formatDisplayDateShort(dateLike = new Date()) {
  const d = dateLike instanceof Date ? dateLike : new Date(dateLike);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('zh-CN');
}

/** 解析记录坐标；无效或 [0,0] 返回 null */
function extractValidLngLat(locationLike) {
  if (!locationLike) return null;
  const raw = locationLike.coordinates ?? locationLike;
  const pair = Array.isArray(raw) ? raw : raw?.coordinates;
  if (!Array.isArray(pair) || pair.length < 2) return null;
  const lng = Number(pair[0]);
  const lat = Number(pair[1]);
  if (!Number.isFinite(lng) || !Number.isFinite(lat) || (lng === 0 && lat === 0)) {
    return null;
  }
  if (lng < -180 || lng > 180 || lat < -90 || lat > 90) return null;
  return [lng, lat];
}

module.exports = {
  formatLocalDateKey,
  todayLocalDateKey,
  formatDisplayDateShort,
  extractValidLngLat,
};
