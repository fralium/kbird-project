/**
 * Client-side bird text match: Chinese / pinyin / initials / English / Latin.
 * For in-memory lists that may lack stored pinyin fields.
 */
import { pinyin } from 'pinyin-pro';

const metaCache = new Map();

function compactLatin(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

export function getPinyinMeta(text) {
  const key = String(text || '').trim();
  if (!key) return { full: '', compact: '', initials: '' };
  if (metaCache.has(key)) return metaCache.get(key);

  const parts = String(pinyin(key, { toneType: 'none', type: 'string' }))
    .replace(/\s+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  const full = parts.join(' ');
  const meta = {
    full,
    compact: compactLatin(full),
    initials: parts.map((part) => part.charAt(0).toLowerCase()).join(''),
  };
  metaCache.set(key, meta);
  return meta;
}

/** True if `text` matches query by substring, pinyin, or pinyin initials. */
export function textMatchesQuery(text, query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return true;
  const raw = String(text || '');
  if (!raw) return false;

  const lower = raw.toLowerCase();
  if (lower.includes(q)) return true;

  const qc = compactLatin(q);
  if (!qc) return false;

  const rc = compactLatin(raw);
  if (rc.includes(qc)) return true;

  if (!/[\u4e00-\u9fff]/.test(raw)) return false;

  const meta = getPinyinMeta(raw);
  if (!meta.initials && !meta.compact) return false;
  if (meta.initials.includes(qc) || meta.initials.startsWith(qc)) return true;
  if (meta.compact.includes(qc) || meta.compact.startsWith(qc)) return true;
  return false;
}

/**
 * Match a species-like row (catalog / region / checklist / plot).
 * @param {object} row
 * @param {string} query
 * @param {{ orderLabel?: string, familyLabel?: string }} [extra]
 */
export function speciesMatchesSearch(row, query, extra = {}) {
  const q = String(query || '').trim();
  if (!q) return true;
  const aliases = Array.isArray(row?.nameAliases)
    ? row.nameAliases
    : typeof row?.nameAliases === 'string'
      ? row.nameAliases.split(/[,，、]/).map((s) => s.trim())
      : [];
  const fields = [
    row?.name,
    row?.scientificName,
    row?.scientific,
    row?.englishName,
    row?.english,
    row?.code,
    row?.order,
    row?.family,
    row?.zone,
    row?.habitat,
    extra.orderLabel,
    extra.familyLabel,
    ...aliases,
  ];
  return fields.some((field) => textMatchesQuery(field, q));
}
