/** 本地日历日与展示日期（避免 toISOString 在 UTC+8 凌晨变成昨天） */

function toValidDate(dateLike) {
  if (dateLike == null || dateLike === '') return null;
  const d = dateLike instanceof Date ? dateLike : new Date(dateLike);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

/** YYYY-MM-DD（本地时区） */
export function formatLocalDateKey(dateLike = new Date()) {
  const d = toValidDate(dateLike);
  if (!d) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayLocalDateKey() {
  return formatLocalDateKey(new Date());
}

/**
 * 展示用日期（中文环境）
 * @param {'short'|'medium'|'long'|'monthDay'|'weekday'} [style='medium']
 *   short    → 2026/10/11
 *   medium   → 2026年10月11日（默认）
 *   long     → 2026年10月11日（含 long 月份）
 *   monthDay → 10月11日
 *   weekday  → 周日
 */
export function formatDisplayDate(dateLike, style = 'medium') {
  const d = toValidDate(dateLike);
  if (!d) return '—';
  if (style === 'short') {
    return d.toLocaleDateString('zh-CN');
  }
  if (style === 'monthDay') {
    return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
  }
  if (style === 'weekday') {
    return d.toLocaleDateString('zh-CN', { weekday: 'short' });
  }
  return d.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: style === 'long' ? 'long' : 'numeric',
    day: 'numeric',
  });
}

/**
 * 展示用日期时间
 * @param {{ withSeconds?: boolean, compact?: boolean }} [opts]
 *   默认 → 2026/10/11 14:30
 *   compact → 10/11 14:30
 */
export function formatDisplayDateTime(dateLike, { withSeconds = false, compact = false } = {}) {
  const d = toValidDate(dateLike);
  if (!d) return '—';
  if (compact) {
    return d.toLocaleString('zh-CN', {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      ...(withSeconds ? { second: '2-digit' } : {}),
    });
  }
  const date = d.toLocaleDateString('zh-CN');
  const time = d.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    ...(withSeconds ? { second: '2-digit' } : {}),
  });
  return `${date} ${time}`;
}

/** 兼容旧名：与 formatDisplayDate(…, 'medium') 相同 */
export function formatDate(dateLike) {
  return formatDisplayDate(dateLike, 'medium');
}
