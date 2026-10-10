import { BIRD_NAME_ALIASES, aliasKeysForCanonical } from '../data/birdNameAliases';

function isKeepBirdName(name) {
  const s = String(name || '').trim();
  if (!s) return false;
  if (s.length >= 2) return true;
  return s === '鹗';
}

function isKeepLocationName(name) {
  const s = String(name || '').trim();
  return s.length >= 2;
}

/**
 * @param {string} text
 * @param {Array<{ text: string, href: string, kind?: string }>} terms
 */
export function linkifyMentions(text, terms) {
  const source = String(text ?? '');
  if (!source) return [];

  const cleaned = (Array.isArray(terms) ? terms : [])
    .map((t) => ({
      text: String(t?.text || '').trim(),
      href: String(t?.href || '').trim(),
      kind: t?.kind || 'mention',
    }))
    .filter((t) => t.text && t.href);

  if (!cleaned.length) return [{ text: source }];

  const byText = new Map();
  cleaned.forEach((t) => {
    if (!byText.has(t.text)) byText.set(t.text, t);
  });
  const unique = [...byText.values()].sort((a, b) => b.text.length - a.text.length);

  const parts = [];
  let i = 0;
  while (i < source.length) {
    let hit = null;
    for (let t = 0; t < unique.length; t += 1) {
      const term = unique[t];
      if (source.startsWith(term.text, i)) {
        hit = term;
        break;
      }
    }
    if (hit) {
      parts.push({ text: hit.text, href: hit.href, kind: hit.kind });
      i += hit.text.length;
      continue;
    }
    const start = i;
    i += 1;
    while (i < source.length) {
      let nextHit = false;
      for (let t = 0; t < unique.length; t += 1) {
        if (source.startsWith(unique[t].text, i)) {
          nextHit = true;
          break;
        }
      }
      if (nextHit) break;
      i += 1;
    }
    parts.push({ text: source.slice(start, i) });
  }
  return parts;
}

/** 别名双向：库内新旧名都能链上 */
export function buildNotepadLinkTerms({ birds = [], locations = [] } = {}) {
  const nameToHref = new Map();

  const register = (text, href) => {
    const key = String(text || '').trim();
    if (!key || !href || !isKeepBirdName(key) || nameToHref.has(key)) return;
    nameToHref.set(key, href);
  };

  birds.forEach((bird) => {
    const id = bird?._id || bird?.id || bird?.birdId;
    if (!id) return;
    const href = `/birds/${id}`;
    const mainName = String(bird.name || '').trim();
    register(mainName, href);
    (Array.isArray(bird.nameAliases) ? bird.nameAliases : []).forEach((alias) => {
      register(alias, href);
    });
    aliasKeysForCanonical(mainName).forEach((alias) => {
      register(alias, href);
    });
  });

  Object.entries(BIRD_NAME_ALIASES || {}).forEach(([alias, canonical]) => {
    const href =
      nameToHref.get(String(canonical || '').trim()) ||
      nameToHref.get(String(alias || '').trim());
    if (!href) return;
    register(alias, href);
    register(canonical, href);
  });

  const terms = [...nameToHref.entries()].map(([text, href]) => ({
    text,
    href,
    kind: 'bird',
  }));

  locations.forEach((loc) => {
    const id = loc?._id || loc?.id;
    const name = loc?.name;
    if (!id || !isKeepLocationName(name)) return;
    terms.push({
      text: String(name).trim(),
      href: `/locations/${id}`,
      kind: 'location',
    });
  });

  return terms;
}
