const { canonicalizeBirdName, aliasKeysForCanonical } = require('../../data/birdNameAliases');
const { pinyin } = require('pinyin-pro');

function escapeRegex(value = '') {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function compactPinyinQuery(value = '') {
  return String(value)
    .toLowerCase()
    .replace(/[''`´]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function buildFlexiblePinyinRegex(compact) {
  if (!compact) return null;
  return new RegExp(compact.split('').map((ch) => escapeRegex(ch)).join('\\s*'), 'i');
}

function isLatinPinyinQuery(value = '') {
  return /^[a-zA-Z\s'`´]+$/.test(String(value).trim());
}

function chinesePinyinParts(text) {
  const raw = pinyin(String(text || '').trim(), { toneType: 'none', type: 'string' });
  return String(raw)
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);
}

function collectAliasLabels(name, nameAliases = []) {
  const labels = new Set();
  const main = String(name || '').trim();
  (Array.isArray(nameAliases) ? nameAliases : []).forEach((alias) => {
    const text = String(alias || '').trim();
    if (text && text !== main) labels.add(text);
  });
  aliasKeysForCanonical(main).forEach((alias) => {
    if (alias && alias !== main) labels.add(alias);
  });
  return [...labels];
}

function buildAliasPinyinFields(name, nameAliases = []) {
  const pinyins = [];
  const initials = [];
  collectAliasLabels(name, nameAliases).forEach((label) => {
    const parts = chinesePinyinParts(label);
    if (!parts.length) return;
    pinyins.push(parts.join(' '));
    initials.push(parts.map((part) => part.charAt(0)).join(''));
  });
  return {
    nameAliasPinyin: [...new Set(pinyins)],
    nameAliasPinyinInitials: [...new Set(initials)],
  };
}

function buildBirdNameSearchOr(rawSearch) {
  const q = String(rawSearch || '').trim();
  if (!q) return [];
  const regex = new RegExp(escapeRegex(q), 'i');
  const or = [
    { name: regex },
    { nameAliases: regex },
    { scientificName: regex },
    { englishName: regex },
  ];
  const canonical = canonicalizeBirdName(q);
  if (canonical && canonical !== q) {
    const canonicalRegex = new RegExp(escapeRegex(canonical), 'i');
    or.push({ name: canonical }, { name: canonicalRegex }, { nameAliases: canonicalRegex });
  }
  return or;
}

/**
 * Full Mongo $or for bird catalog search:
 * Chinese name / aliases / English / Latin + stored pinyin + initials.
 */
function buildBirdSmartSearchOr(rawSearch) {
  const q = String(rawSearch || '').trim();
  if (!q) return [];

  const nameOr = buildBirdNameSearchOr(q);
  try {
    if (isLatinPinyinQuery(q)) {
      const compact = compactPinyinQuery(q);
      const flexiblePinyinRegex = buildFlexiblePinyinRegex(compact);
      const initialsRegex = compact ? new RegExp(escapeRegex(compact), 'i') : null;
      const searchRegex = new RegExp(escapeRegex(q), 'i');
      const or = [...nameOr];
      if (initialsRegex) {
        or.push(
          { namePinyinInitials: initialsRegex },
          { nameAliasPinyinInitials: initialsRegex },
          { scientificNamePinyinInitials: initialsRegex }
        );
      }
      if (flexiblePinyinRegex) {
        or.push(
          { namePinyin: flexiblePinyinRegex },
          { nameAliasPinyin: flexiblePinyinRegex },
          { scientificNamePinyin: flexiblePinyinRegex }
        );
      }
      if (compact.length > 2) {
        or.push(
          { scientificName: searchRegex },
          { scientificName: new RegExp(escapeRegex(compact), 'i') },
          { englishName: searchRegex },
          { englishName: new RegExp(escapeRegex(compact), 'i') }
        );
      }
      return or;
    }

    const searchPinyin = pinyin(q, { toneType: 'none', type: 'string' });
    const searchPinyinCompact = compactPinyinQuery(searchPinyin);
    const searchPinyinRegex = new RegExp(escapeRegex(searchPinyin), 'i');
    const searchPinyinInitials = String(searchPinyin)
      .split(/\s+/)
      .map((word) => word.charAt(0))
      .join('');
    const searchPinyinInitialsRegex = new RegExp(escapeRegex(searchPinyinInitials), 'i');
    const flexiblePinyinRegex = buildFlexiblePinyinRegex(searchPinyinCompact);

    const or = [
      ...nameOr,
      { namePinyin: searchPinyinRegex },
      { scientificNamePinyin: searchPinyinRegex },
      { namePinyinInitials: searchPinyinInitialsRegex },
      { nameAliasPinyinInitials: searchPinyinInitialsRegex },
      { scientificNamePinyinInitials: searchPinyinInitialsRegex },
    ];
    if (flexiblePinyinRegex) {
      or.push(
        { namePinyin: flexiblePinyinRegex },
        { nameAliasPinyin: flexiblePinyinRegex },
        { scientificNamePinyin: flexiblePinyinRegex }
      );
    }
    return or;
  } catch {
    return nameOr;
  }
}

function findMatchedAlias(bird, rawSearch) {
  const q = String(rawSearch || '').trim();
  if (!q) return '';
  const aliases = Array.isArray(bird?.nameAliases) ? bird.nameAliases : [];
  const exact = aliases.find((alias) => String(alias) === q);
  if (exact) return exact;
  const canonical = canonicalizeBirdName(q);
  if (canonical && canonical !== q) {
    const byCanonical = aliases.find((alias) => String(alias) === canonical);
    if (byCanonical) return byCanonical;
  }
  const partial = aliases.find((alias) => String(alias).includes(q));
  return partial || '';
}

const rowPinyinCache = new Map();

function textPinyinMeta(text) {
  const key = String(text || '').trim();
  if (!key) return { compact: '', initials: '' };
  if (rowPinyinCache.has(key)) return rowPinyinCache.get(key);
  const parts = chinesePinyinParts(key);
  const meta = {
    compact: compactPinyinQuery(parts.join('')),
    initials: parts.map((part) => part.charAt(0).toLowerCase()).join(''),
  };
  rowPinyinCache.set(key, meta);
  return meta;
}

function textMatchesQuery(text, query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return true;
  const raw = String(text || '');
  if (!raw) return false;
  if (raw.toLowerCase().includes(q)) return true;
  const qc = compactPinyinQuery(q);
  if (!qc) return false;
  if (compactPinyinQuery(raw).includes(qc)) return true;
  if (!/[\u4e00-\u9fff]/.test(raw)) return false;
  const meta = textPinyinMeta(raw);
  if (meta.initials.includes(qc) || meta.initials.startsWith(qc)) return true;
  if (meta.compact.includes(qc) || meta.compact.startsWith(qc)) return true;
  return false;
}

/** In-memory species row match (region lists, etc.) — no Mongo pinyin fields required. */
function speciesRowMatchesQuery(row, query, extraLabels = []) {
  const q = String(query || '').trim();
  if (!q) return true;
  const fields = [
    row?.name,
    row?.scientificName,
    row?.englishName,
    row?.code,
    row?.order,
    row?.family,
    ...(Array.isArray(row?.nameAliases) ? row.nameAliases : []),
    ...extraLabels,
  ];
  return fields.some((field) => textMatchesQuery(field, q));
}

module.exports = {
  escapeRegex,
  compactPinyinQuery,
  buildFlexiblePinyinRegex,
  isLatinPinyinQuery,
  buildBirdNameSearchOr,
  buildBirdSmartSearchOr,
  findMatchedAlias,
  buildAliasPinyinFields,
  collectAliasLabels,
  speciesRowMatchesQuery,
  textMatchesQuery,
};
