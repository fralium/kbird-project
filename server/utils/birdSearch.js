const { canonicalizeBirdName, aliasKeysForCanonical } = require('../../data/birdNameAliases');
const { pinyin } = require('pinyin-pro');

function escapeRegex(value = '') {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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

module.exports = {
  escapeRegex,
  buildBirdNameSearchOr,
  findMatchedAlias,
  buildAliasPinyinFields,
  collectAliasLabels,
};
