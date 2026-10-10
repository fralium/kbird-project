const MUNICIPALITIES = new Set(['北京市', '天津市', '上海市', '重庆市']);

/** 省 · 市 · 区；相邻重复与直辖市「市=省」会去掉。 */
export function formatAddressRegion(address, separator = ' · ') {
  const parts = [address?.province, address?.city, address?.district]
    .map((part) => String(part || '').trim())
    .filter(Boolean);
  const deduped = [];
  for (const part of parts) {
    if (deduped[deduped.length - 1] !== part) deduped.push(part);
  }
  if (MUNICIPALITIES.has(deduped[0]) && deduped[1] === deduped[0]) {
    deduped.splice(1, 1);
  }
  return deduped.join(separator);
}
