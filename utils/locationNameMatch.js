/**
 * 前端地点名灵活匹配（与 server/utils/locationName.js 规则对齐）
 */

export function normalizeLocationName(name) {
  return String(name || '').trim();
}

export function stripLocationRegionPrefix(name) {
  const raw = normalizeLocationName(name);
  if (!raw) return '';

  const m = raw.match(
    /^(?:[\u4e00-\u9fa5]{2,}?(?:省|市|自治区|特别行政区|自治州|地区|盟))+[\u4e00-\u9fa5]{1,}?(?:市|区|县|旗|自治县|自治旗)?\s+(.+)$/
  );
  if (m && m[1] && m[1].trim()) return m[1].trim();

  const idx = raw.lastIndexOf(' ');
  if (idx > 0) {
    const left = raw.slice(0, idx);
    const right = raw.slice(idx + 1).trim();
    if (right && /[省市县区州旗]$/.test(left)) return right;
  }
  return raw;
}

const MIN_SUFFIX_MATCH_LEN = 3;

/** 判断填写名是否对得上名录中的某条名称 */
export function locationNamesMatch(inputName, catalogName) {
  const a = normalizeLocationName(inputName);
  const b = normalizeLocationName(catalogName);
  if (!a || !b) return false;
  if (a === b) return true;

  const sa = stripLocationRegionPrefix(a);
  const sb = stripLocationRegionPrefix(b);
  if (sa === sb || sa === b || a === sb) return true;
  if (a.endsWith(` ${b}`) || b.endsWith(` ${a}`)) return true;
  if (b.length >= MIN_SUFFIX_MATCH_LEN && a.endsWith(b) && a.length > b.length) return true;
  if (a.length >= MIN_SUFFIX_MATCH_LEN && b.endsWith(a) && b.length > a.length) return true;
  return false;
}

export function isLocationInCatalog(inputName, catalogNames) {
  const list = Array.isArray(catalogNames) ? catalogNames : [];
  return list.some((name) => locationNamesMatch(inputName, name));
}
