/** 本地日历日 YYYY-MM-DD（避免 toISOString 在 UTC+8 凌晨变成昨天） */
export function formatLocalDateKey(dateLike = new Date()) {
  const d = dateLike instanceof Date ? dateLike : new Date(dateLike);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayLocalDateKey() {
  return formatLocalDateKey(new Date());
}
