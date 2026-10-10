/**
 * 无空格行政前缀剥离：省市区长地址 → 短地名
 * （CBRC 报告观测地点常无空格）
 */
function stripCompactAdminPrefix(name) {
  let rest = String(name || '').trim();
  if (!rest) return '';

  const provinceMatch = rest.match(
    /^(北京市|天津市|上海市|重庆市|[^省]+省|[^自治区]+自治区|[^特别行政区]+特别行政区)/
  );
  if (provinceMatch) rest = rest.slice(provinceMatch[1].length);

  // 可能重复出现「市」层级（地级市 + 县级市…）
  for (let i = 0; i < 3; i++) {
    const cityMatch = rest.match(/^([^市]+市|[^州]+自治州|[^地区]+地区|[^盟]+盟)/);
    if (!cityMatch) break;
    const next = rest.slice(cityMatch[1].length);
    if (!next) break;
    rest = next;
  }

  const districtMatch = rest.match(/^(.+?(?:区|县|旗|自治县|自治旗))/);
  if (districtMatch && rest.length > districtMatch[1].length) {
    rest = rest.slice(districtMatch[1].length);
  }

  return rest.trim();
}

/**
 * 去掉地点名中的「省市区」前缀。
 * 例：「浙江省杭州市临安区 西天目山」→「西天目山」
 * 例：「浙江省杭州市西湖区灵隐」→「灵隐」
 */
function stripLocationRegionPrefix(name) {
  const raw = String(name || '').trim();
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

  const compact = stripCompactAdminPrefix(raw);
  if (compact && compact !== raw) return compact;

  return raw;
}

function normalizeLocationName(name) {
  return String(name || '').trim();
}

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** 短地名无空格后缀匹配的最小长度，避免「公园」等过短词误匹配 */
const MIN_SUFFIX_MATCH_LEN = 3;

/**
 * 将记录中的地点名归一到地点名录 canonical 名（精确 / 去前缀 / 后缀 / address）
 */
function resolveCanonicalLocationName(recordName, detail, canonicalNames) {
  const n = normalizeLocationName(recordName);
  const d = normalizeLocationName(detail);
  if (!n && !d) return '';

  const nStripped = stripLocationRegionPrefix(n);
  if (canonicalNames.has(n)) return n;
  if (nStripped && canonicalNames.has(nStripped)) return nStripped;
  if (d && canonicalNames.has(d)) return d;

  const sorted = [...canonicalNames].filter(Boolean).sort((a, b) => b.length - a.length);
  for (const c of sorted) {
    if (n === c || nStripped === c || d === c) return c;
    if (n.endsWith(` ${c}`) || (nStripped && nStripped.endsWith(` ${c}`))) return c;
    if (
      c.length >= MIN_SUFFIX_MATCH_LEN &&
      n.endsWith(c) &&
      n.length > c.length
    ) {
      return c;
    }
  }
  return n;
}

/**
 * 查询「属于某地点名录条目」的观鸟记录所用的 $or 条件
 * （精确名、去前缀名、名称后缀、地址字段）
 */
function buildLocationRecordMatchers(locationName) {
  const name = normalizeLocationName(locationName);
  if (!name) return [];

  const names = [...new Set([name, stripLocationRegionPrefix(name)].filter(Boolean))];
  const matchers = [];

  names.forEach((n) => {
    const escaped = escapeRegex(n);
    matchers.push(
      { 'location.name': n },
      { 'location.name': { $regex: `(^|\\s)${escaped}$` } },
      { 'location.address.detail': n },
      { 'location.address.street': n }
    );
  });

  return matchers;
}

/**
 * 按灵活规则查找地点名录中的地点（精确 → 去前缀 → 名录名作为查询后缀）
 */
async function findActiveLocationByFlexibleName(LocationModel, name) {
  const n = normalizeLocationName(name);
  if (!n) return null;

  const stripped = stripLocationRegionPrefix(n);
  const compact = stripCompactAdminPrefix(n);
  const exactCandidates = [...new Set([n, stripped, compact].filter(Boolean))];

  let location = await LocationModel.findOne({
    name: { $in: exactCandidates },
    status: 'active',
  });
  if (location) return location;

  // 查询名较短时：匹配「…… 短名」形式的名录条目（少见）；过短词跳过以免误匹配
  if (n.length < MIN_SUFFIX_MATCH_LEN) return null;
  const escaped = escapeRegex(n);
  location = await LocationModel.findOne({
    status: 'active',
    name: { $regex: `(^|\\s)${escaped}$` },
  });
  if (location) return location;

  // 查询名较长时：名录短名是查询后缀（无空格长地址 → 短地名）
  if (compact && compact !== n && compact.length >= MIN_SUFFIX_MATCH_LEN) {
    location = await LocationModel.findOne({
      name: compact,
      status: 'active',
    });
    if (location) return location;
  }

  return location;
}

module.exports = {
  stripLocationRegionPrefix,
  stripCompactAdminPrefix,
  normalizeLocationName,
  escapeRegex,
  resolveCanonicalLocationName,
  buildLocationRecordMatchers,
  findActiveLocationByFlexibleName,
  MIN_SUFFIX_MATCH_LEN,
};
