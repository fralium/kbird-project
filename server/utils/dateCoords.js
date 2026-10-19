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

/** 本地时区整年区间 [Y-01-01 00:00:00.000, Y-12-31 23:59:59.999] */
function localYearRange(yearLike) {
  const y = Number.parseInt(String(yearLike), 10);
  const year = Number.isFinite(y) ? y : new Date().getFullYear();
  return {
    startDate: new Date(year, 0, 1, 0, 0, 0, 0),
    endDate: new Date(year, 11, 31, 23, 59, 59, 999),
  };
}

/** 本地时区整月区间 (month: 1..12) [Y-M-01 00:00:00.000, 月末 23:59:59.999] */
function localMonthRange(yearLike, monthLike) {
  const y = Number.parseInt(String(yearLike), 10);
  const m = Number.parseInt(String(monthLike), 10);
  const year = Number.isFinite(y) ? y : new Date().getFullYear();
  const month = Number.isFinite(m) && m >= 1 && m <= 12 ? m : new Date().getMonth() + 1;
  return {
    startDate: new Date(year, month - 1, 1, 0, 0, 0, 0),
    endDate: new Date(year, month, 0, 23, 59, 59, 999),
  };
}

module.exports = {
  formatLocalDateKey,
  todayLocalDateKey,
  formatDisplayDateShort,
  extractValidLngLat,
  localYearRange,
  localMonthRange,
};
