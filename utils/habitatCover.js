/**
 * 观察记录封面：
 * - 生境浏览：优先插画生境（按地点语义 + 记录打散），避免鸟种库图刷屏
 * - 仅当本条记录自带现场图时用真实照片
 */
import { useEffect, useState } from 'react';
import habitatFilterData from '../data/habitatFilters';

const HABITAT_KEYS = ['wetland', 'forest', 'mountain', 'coastal', 'urban', 'farmland'];

function coverMap(folder) {
  return Object.fromEntries(HABITAT_KEYS.map((key) => [key, `/habitat/${folder}/${key}.jpg`]));
}

/**
 * 生境封面套图。以后再加一套：在此追加一项，并把 6 张图放到 public/habitat/<id>/。
 * id 会写入本地偏好，不要改已有 id。
 */
export const HABITAT_COVER_SETS = [
  { id: 'anime', label: '动漫', covers: coverMap('anime') },
  { id: 'flat', label: '插画', covers: coverMap('flat') },
  { id: 'watercolor', label: '水彩', covers: coverMap('watercolor') },
];

export const DEFAULT_HABITAT_COVER_SET = 'anime';
export const HABITAT_COVER_SET_KEY = 'kbird.habitat.coverSet';

export const BIRD_COVER_GUILDS = [
  { key: 'raptor', label: '猛禽' },
  { key: 'flyer', label: '飞禽' },
  { key: 'songbird', label: '鸣禽' },
  { key: 'waterfowl', label: '水鸟' },
  { key: 'wader', label: '涉鸟' },
  { key: 'woodland', label: '林鸟' },
];

function birdCoverMap(folder) {
  return Object.fromEntries(
    BIRD_COVER_GUILDS.map(({ key }) => [key, `/cover/${folder}/${key}.jpg`])
  );
}

/** 记录页画风封面：重点是鸟，不是生境。 */
export const BIRD_COVER_SETS = {
  anime: birdCoverMap('anime'),
  flat: birdCoverMap('flat'),
  watercolor: birdCoverMap('watercolor'),
};

export const RECORD_COVER_MODES = [
  { id: 'photo', label: '照片' },
  ...HABITAT_COVER_SETS.map(({ id, label }) => ({ id, label })),
];

export const DEFAULT_RECORD_COVER_SET = 'anime';
export const RECORD_COVER_SET_KEY = 'kbird.records.coverSet';

export function normalizeHabitatCoverSet(id) {
  return HABITAT_COVER_SETS.some((set) => set.id === id) ? id : DEFAULT_HABITAT_COVER_SET;
}

export function normalizeRecordCoverSet(id) {
  if (id === 'photo') return 'photo';
  return normalizeHabitatCoverSet(id);
}

export function getHabitatCovers(setId) {
  const id = normalizeHabitatCoverSet(setId);
  return HABITAT_COVER_SETS.find((set) => set.id === id).covers;
}

export function getBirdCovers(setId) {
  const id = normalizeHabitatCoverSet(setId);
  return BIRD_COVER_SETS[id] || BIRD_COVER_SETS.anime;
}

/** 默认套，兼容旧调用。新代码请传 coverSet。 */
export const HABITAT_ILLUSTRATIONS = getHabitatCovers(DEFAULT_HABITAT_COVER_SET);

const HABITAT_FILTERS = habitatFilterData.HABITAT_FILTERS || habitatFilterData;

const HABITAT_RULES = HABITAT_FILTERS.map(({ key, keywords }) => ({ key, keywords }));

function hashString(input) {
  const text = String(input || '');
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  }
  return hash;
}

/** 地点关键词命中的生境（可多个） */
export function matchHabitatKeys(locationName = '', habitatTags = []) {
  const haystack = [locationName, ...(Array.isArray(habitatTags) ? habitatTags : [])]
    .map((v) => String(v || '').trim())
    .filter(Boolean)
    .join(' ');

  if (!haystack) return [];
  return HABITAT_RULES.filter((rule) => rule.keywords.some((kw) => haystack.includes(kw))).map(
    (rule) => rule.key
  );
}

export function pickHabitatKey(locationName = '', habitatTags = [], salt = '') {
  const matched = matchHabitatKeys(locationName, habitatTags);
  const pool = matched.length > 0 ? matched : HABITAT_KEYS;
  const idx = hashString(`${salt}|${locationName}|${pool.join(',')}`) % pool.length;
  return pool[idx];
}

/**
 * 在页面内打散：优先语义池，若该 url 已用过则换池内其它/全库其它
 */
export function pickDiversifiedHabitatKey(locationName, habitatTags, salt, usedUrls, setId) {
  const matched = matchHabitatKeys(locationName, habitatTags);
  const primaryPool = matched.length > 0 ? matched : HABITAT_KEYS;
  const start = hashString(`${salt}|${locationName}`) % primaryPool.length;

  const tryKeys = [];
  for (let i = 0; i < primaryPool.length; i += 1) {
    tryKeys.push(primaryPool[(start + i) % primaryPool.length]);
  }
  // 语义池用尽后再扫全部，进一步降低同图连刷
  HABITAT_KEYS.forEach((key) => {
    if (!tryKeys.includes(key)) tryKeys.push(key);
  });

  const covers = getHabitatCovers(setId);
  const used = usedUrls instanceof Set ? usedUrls : null;
  for (const key of tryKeys) {
    const url = covers[key];
    if (!used || !used.has(url)) return key;
  }
  return tryKeys[0];
}

const BIRD_GUILD_KEYS = BIRD_COVER_GUILDS.map((item) => item.key);

const BIRD_GUILD_RULES = [
  { key: 'raptor', re: /Accipitr|Falcon|Strigiform|鹰|隼|鸮|鵟|鹞|鹗|猛禽/i },
  { key: 'wader', re: /Ardeid|Scolopac|Charadri|Recurvirostr|Threskiornith|Ciconi|Gruid|Haematopod|鹭|鸻|鹬|鹳|鹤|鹮|涉/i },
  { key: 'waterfowl', re: /Anseriform|Podiciped|Anatid|雁|鸭|鹅|天鹅|鸊鷉|游禽/i },
  { key: 'flyer', re: /Apodid|Hirundin|Larid|雨燕|家燕|鸥|飞禽/i },
  { key: 'woodland', re: /Piciform|Picid|啄木|林鸟/i },
  { key: 'songbird', re: /Passeriform|雀形|鸣禽|鹎|鸫|鹛|雀|鸦|鹊/i },
];

function birdCoverHaystack(record) {
  const birds = Array.isArray(record?.birds) ? record.birds : [];
  return birds
    .map((item) => {
      const species = item?.birdId && typeof item.birdId === 'object' ? item.birdId : item;
      const tags = Array.isArray(species?.tags) ? species.tags : [];
      return [species?.order, species?.family, species?.category, species?.name, ...tags]
        .map((v) => String(v || '').trim())
        .filter(Boolean)
        .join(' ');
    })
    .filter(Boolean)
    .join(' ');
}

export function matchBirdGuildKeys(record) {
  const haystack = birdCoverHaystack(record);
  if (!haystack) return [];
  return BIRD_GUILD_RULES.filter((rule) => rule.re.test(haystack)).map((rule) => rule.key);
}

export function pickDiversifiedBirdGuildKey(record, salt, usedUrls, setId) {
  const matched = matchBirdGuildKeys(record);
  const primaryPool = matched.length > 0 ? matched : BIRD_GUILD_KEYS;
  const start = hashString(`${salt}|bird-guild`) % primaryPool.length;
  const tryKeys = [];
  for (let i = 0; i < primaryPool.length; i += 1) {
    tryKeys.push(primaryPool[(start + i) % primaryPool.length]);
  }
  BIRD_GUILD_KEYS.forEach((key) => {
    if (!tryKeys.includes(key)) tryKeys.push(key);
  });

  const covers = getBirdCovers(setId);
  const used = usedUrls instanceof Set ? usedUrls : null;
  for (const key of tryKeys) {
    const url = covers[key];
    if (!used || !used.has(url)) return key;
  }
  return tryKeys[0];
}

function resolveBirdGuildCover(record, usedUrls, setId) {
  const locationName = String(record?.location?.name || '').trim();
  const salt = String(record?._id || record?.id || locationName || 'kbird');
  const key = pickDiversifiedBirdGuildKey(record, salt, usedUrls, setId);
  const covers = getBirdCovers(setId);
  const url = covers[key] || covers.songbird;
  if (usedUrls instanceof Set) usedUrls.add(url);
  return { url, source: 'bird-illustration', isIllustration: true, guildKey: key };
}

export function getHabitatIllustration(locationName = '', habitatTags = [], salt = '', setId) {
  const covers = getHabitatCovers(setId);
  const key = pickHabitatKey(locationName, habitatTags, salt);
  return {
    key,
    url: covers[key] || covers.wetland,
    isIllustration: true,
  };
}

function firstImageUrl(images) {
  if (!Array.isArray(images) || images.length === 0) return '';
  const first = images.find((img) => img && (img.url || typeof img === 'string'));
  if (!first) return '';
  return typeof first === 'string' ? first : String(first.url || '');
}

const LOCATION_TYPE_HABITAT = {
  公园: 'urban',
  自然保护区: 'forest',
  湿地: 'wetland',
  森林: 'forest',
  山区: 'mountain',
  城市: 'urban',
  乡村: 'farmland',
  海岸: 'coastal',
  湖泊: 'wetland',
  河流: 'wetland',
};

/** 「其他」类型暂用自然环境插画，避开城市街景 */
const OTHER_NATURAL_KEYS = ['wetland', 'forest', 'mountain', 'coastal', 'farmland'];

/**
 * 地点列表封面：
 * - 有生境库实拍则用
 * - 否则按类型/地名语义选插画生境
 * - type=其他：在自然环境图中打散
 */
export function resolveLocationCover(location, usedUrls, setId) {
  const real = firstImageUrl(location?.images);
  if (real) {
    if (usedUrls instanceof Set) usedUrls.add(real);
    return { url: real, source: 'photo', isIllustration: false };
  }

  const name = String(location?.name || '').trim();
  const type = String(location?.type || '').trim();
  const habitatTags = [
    ...(Array.isArray(location?.environment?.habitat) ? location.environment.habitat : []),
    type && type !== '其他' ? type : '',
  ].filter(Boolean);
  const salt = String(location?._id || location?.id || name || 'location');

  if (!type || type === '其他') {
    const start = hashString(`${salt}|other-nature`) % OTHER_NATURAL_KEYS.length;
    const tryKeys = [];
    for (let i = 0; i < OTHER_NATURAL_KEYS.length; i += 1) {
      tryKeys.push(OTHER_NATURAL_KEYS[(start + i) % OTHER_NATURAL_KEYS.length]);
    }
    const covers = getHabitatCovers(setId);
    const used = usedUrls instanceof Set ? usedUrls : null;
    let key = tryKeys[0];
    for (const candidate of tryKeys) {
      const candidateUrl = covers[candidate];
      if (!used || !used.has(candidateUrl)) {
        key = candidate;
        break;
      }
    }
    const url = covers[key] || covers.forest;
    if (usedUrls instanceof Set) usedUrls.add(url);
    return { url, source: 'illustration', isIllustration: true, habitatKey: key };
  }

  const covers = getHabitatCovers(setId);
  const mapped = LOCATION_TYPE_HABITAT[type];
  if (mapped && covers[mapped]) {
    const mappedUrl = covers[mapped];
    if (!(usedUrls instanceof Set) || !usedUrls.has(mappedUrl)) {
      if (usedUrls instanceof Set) usedUrls.add(mappedUrl);
      return { url: mappedUrl, source: 'illustration', isIllustration: true, habitatKey: mapped };
    }
  }

  const key = pickDiversifiedHabitatKey(name, habitatTags, salt, usedUrls, setId);
  const url = covers[key] || covers.wetland;
  if (usedUrls instanceof Set) usedUrls.add(url);
  return { url, source: 'illustration', isIllustration: true, habitatKey: key };
}

/**
 * 自留地列表封面：
 * - 有真实生境图时优先（未来字段 coverHabitatUrl / habitatImageUrl）
 * - 否则在「国一/国二鸟种图」与「插画生境」间按 plotId 稳定二选一
 * - 无保护鸟图时退回插画生境
 *
 * @param {object} plot
 * @param {Set<string>} [usedUrls]
 */
export function resolvePlotCover(plot, usedUrls, setId) {
  const locationName = [plot?.title, plot?.spot, plot?.city, plot?.district, plot?.province]
    .map((v) => String(v || '').trim())
    .filter(Boolean)
    .join(' ');
  const salt = String(plot?._id || plot?.id || locationName || 'plot');

  const realHabitat =
    String(plot?.coverHabitatUrl || plot?.habitatImageUrl || '').trim() ||
    firstImageUrl(plot?.habitatImages);
  if (realHabitat) {
    if (usedUrls instanceof Set) usedUrls.add(realHabitat);
    return {
      url: realHabitat,
      source: 'habitat',
      isIllustration: false,
    };
  }

  const birds = Array.isArray(plot?.coverBirds)
    ? plot.coverBirds.filter((b) => b && String(b.url || '').trim())
    : [];
  const preferBird = birds.length > 0 && hashString(`${salt}|cover-mode`) % 2 === 0;

  if (preferBird) {
    const idx = hashString(`${salt}|cover-bird`) % birds.length;
    const bird = birds[idx];
    const url = String(bird.url).trim();
    if (usedUrls instanceof Set) usedUrls.add(url);
    return {
      url,
      source: 'bird',
      isIllustration: false,
      birdName: bird.name || '',
      level: bird.level || '',
    };
  }

  const key = pickDiversifiedHabitatKey(locationName, [], salt, usedUrls, setId);
  const covers = getHabitatCovers(setId);
  const url = covers[key] || covers.wetland;
  if (usedUrls instanceof Set) usedUrls.add(url);
  return {
    url,
    source: 'illustration',
    isIllustration: true,
    habitatKey: key,
  };
}

/**
 * 各地鸟种封面：
 * - 照片：鸟点生境实拍 / 省市区国一国二鸟种图；没有则退回画风鸟图
 * - 动漫/插画/水彩：与观察记录相同的代表性鸟类画风图
 */
export function resolveRegionListCover(item, usedUrls, setId) {
  const coverSet = normalizeRecordCoverSet(setId);
  const locationName = [item?.regionName, item?.spot, item?.city, item?.district, item?.province]
    .map((v) => String(v || '').trim())
    .filter(Boolean)
    .join(' ');
  const salt = String(item?._id || item?.id || locationName || 'region');
  const guildRecord = {
    _id: salt,
    location: { name: locationName },
    birds: Array.isArray(item?.coverBirds)
      ? item.coverBirds.map((bird) => ({ birdId: { name: bird?.name || '' } }))
      : [],
  };

  if (coverSet !== 'photo') {
    return resolveBirdGuildCover(guildRecord, usedUrls, coverSet);
  }

  const isSpot = Boolean(String(item?.spot || '').trim());
  if (isSpot) {
    const realHabitat =
      String(item?.habitatImageUrl || item?.coverHabitatUrl || '').trim() ||
      firstImageUrl(item?.habitatImages);
    if (realHabitat) {
      if (usedUrls instanceof Set) usedUrls.add(realHabitat);
      return { url: realHabitat, source: 'habitat', isIllustration: false };
    }
  }

  const birds = Array.isArray(item?.coverBirds)
    ? item.coverBirds.filter((b) => b && String(b.url || '').trim())
    : [];
  if (birds.length) {
    const firsts = birds.filter((b) => b.level === '国家一级');
    const pool = firsts.length ? firsts : birds;
    const idx = hashString(`${salt}|cover-bird`) % pool.length;
    const bird = pool[idx];
    const url = String(bird.url).trim();
    if (usedUrls instanceof Set) usedUrls.add(url);
    return {
      url,
      source: 'bird',
      isIllustration: false,
      birdName: bird.name || '',
      level: bird.level || '',
    };
  }

  return resolveBirdGuildCover(guildRecord, usedUrls, DEFAULT_HABITAT_COVER_SET);
}

/**
 * @param {object} record
 * @param {{ allowSpeciesImages?: boolean }} [options]
 */
export function getRecordPhotoUrl(record, options = {}) {
  const allowSpeciesImages = options.allowSpeciesImages !== false;
  if (!record) return '';

  const top = firstImageUrl(record.images);
  if (top) return top;

  if (!allowSpeciesImages) return '';

  const birds = Array.isArray(record.birds) ? record.birds : [];
  for (const bird of birds) {
    const fromEntry = firstImageUrl(bird?.images);
    if (fromEntry) return fromEntry;
    const species = bird?.birdId;
    if (species && typeof species === 'object') {
      const fromSpecies = firstImageUrl(species.images);
      if (fromSpecies) return fromSpecies;
    }
  }
  return '';
}

/**
 * 记录封面：
 * - 照片：现场图 > 鸟种库图 > 地点封面 > 画风鸟图兜底
 * - 动漫/插画/水彩：代表性鸟类画风图（猛禽/飞禽/鸣禽/水鸟/涉鸟/林鸟），与浏览方式无关
 */
export function resolveRecordCover(record, locationCoverMap, options = {}) {
  const usedUrls = options.usedUrls;
  const coverSet = normalizeRecordCoverSet(options.coverSet);
  const locationName = String(record?.location?.name || '').trim();

  if (coverSet !== 'photo') {
    return resolveBirdGuildCover(record, usedUrls, coverSet);
  }

  const photo = getRecordPhotoUrl(record, { allowSpeciesImages: true });
  if (photo) {
    return { url: photo, source: 'photo', isIllustration: false };
  }

  if (locationName && locationCoverMap) {
    const mapped =
      typeof locationCoverMap.get === 'function'
        ? locationCoverMap.get(locationName)
        : locationCoverMap[locationName];
    if (mapped) {
      return { url: mapped, source: 'location', isIllustration: false };
    }
  }

  return resolveBirdGuildCover(record, usedUrls, DEFAULT_HABITAT_COVER_SET);
}

export const RECORDS_VIEW_STORAGE_KEY = 'kbird.records.view';
export const RECORDS_CARD_STYLE_KEY = 'kbird.records.cardStyle';

export function readHabitatCoverSet() {
  if (typeof window === 'undefined') return DEFAULT_HABITAT_COVER_SET;
  try {
    return normalizeHabitatCoverSet(localStorage.getItem(HABITAT_COVER_SET_KEY));
  } catch {
    return DEFAULT_HABITAT_COVER_SET;
  }
}

export function writeHabitatCoverSet(setId) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(HABITAT_COVER_SET_KEY, normalizeHabitatCoverSet(setId));
  } catch {
    // ignore
  }
}

export function useHabitatCoverSet() {
  const [coverSet, setCoverSet] = useState(DEFAULT_HABITAT_COVER_SET);
  useEffect(() => {
    setCoverSet(readHabitatCoverSet());
  }, []);
  const updateCoverSet = (setId) => {
    const next = normalizeHabitatCoverSet(setId);
    setCoverSet(next);
    writeHabitatCoverSet(next);
  };
  return [coverSet, updateCoverSet];
}

export function readRecordCoverSet() {
  if (typeof window === 'undefined') return DEFAULT_RECORD_COVER_SET;
  try {
    const raw = localStorage.getItem(RECORD_COVER_SET_KEY);
    if (raw) return normalizeRecordCoverSet(raw);
    return normalizeHabitatCoverSet(localStorage.getItem(HABITAT_COVER_SET_KEY));
  } catch {
    return DEFAULT_RECORD_COVER_SET;
  }
}

export function writeRecordCoverSet(setId) {
  if (typeof window === 'undefined') return;
  const next = normalizeRecordCoverSet(setId);
  try {
    localStorage.setItem(RECORD_COVER_SET_KEY, next);
  } catch {
    // ignore
  }
  if (next !== 'photo') writeHabitatCoverSet(next);
}

export function useRecordCoverSet() {
  const [coverSet, setCoverSet] = useState(DEFAULT_RECORD_COVER_SET);
  useEffect(() => {
    setCoverSet(readRecordCoverSet());
  }, []);
  const updateCoverSet = (setId) => {
    const next = normalizeRecordCoverSet(setId);
    setCoverSet(next);
    writeRecordCoverSet(next);
  };
  return [coverSet, updateCoverSet];
}
/** @deprecated 已合并为 filterPanel */
export const RECORDS_REGION_FOLD_KEY = 'kbird.records.regionFold';
/** @deprecated 已合并为 filterPanel */
export const RECORDS_FILTER_FOLD_KEY = 'kbird.records.filterFold';
export const RECORDS_FILTER_PANEL_KEY = 'kbird.records.filterPanel';
export const RECORDS_MAP_TOOLBOX_KEY = 'kbird.records.mapToolbox';
export const RECORDS_BATCH_PANEL_KEY = 'kbird.records.batchPanel';

export function readRecordsViewMode() {
  if (typeof window === 'undefined') return 'habitat';
  try {
    const raw = localStorage.getItem(RECORDS_VIEW_STORAGE_KEY);
    if (raw === 'map' || raw === 'habitat') return raw;
  } catch {
    // ignore
  }
  return 'habitat';
}

export function writeRecordsViewMode(mode) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(RECORDS_VIEW_STORAGE_KEY, mode === 'map' ? 'map' : 'habitat');
  } catch {
    // ignore
  }
}

export function readRecordsCardStyle() {
  if (typeof window === 'undefined') return 'field';
  try {
    const raw = localStorage.getItem(RECORDS_CARD_STYLE_KEY);
    if (raw === 'scrap' || raw === 'field') return raw;
  } catch {
    // ignore
  }
  return 'field';
}

export function writeRecordsCardStyle(style) {
  if (typeof window === 'undefined') return;
  try {
    const next = style === 'scrap' ? 'scrap' : 'field';
    localStorage.setItem(RECORDS_CARD_STYLE_KEY, next);
  } catch {
    // ignore
  }
}

function readFoldOpen(key, fallback = false) {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (raw === '1') return true;
    if (raw === '0') return false;
  } catch {
    // ignore
  }
  return fallback;
}

function writeFoldOpen(key, open) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, open ? '1' : '0');
  } catch {
    // ignore
  }
}

export function readRecordsFilterPanelOpen() {
  // 兼容旧键：任一曾展开过则视为展开偏好
  if (typeof window === 'undefined') return false;
  try {
    const raw = localStorage.getItem(RECORDS_FILTER_PANEL_KEY);
    if (raw === '1') return true;
    if (raw === '0') return false;
    if (localStorage.getItem(RECORDS_REGION_FOLD_KEY) === '1') return true;
    if (localStorage.getItem(RECORDS_FILTER_FOLD_KEY) === '1') return true;
  } catch {
    // ignore
  }
  return false;
}

export function writeRecordsFilterPanelOpen(open) {
  writeFoldOpen(RECORDS_FILTER_PANEL_KEY, Boolean(open));
}

export function readRecordsMapToolboxOpen() {
  return readFoldOpen(RECORDS_MAP_TOOLBOX_KEY, false);
}

export function writeRecordsMapToolboxOpen(open) {
  writeFoldOpen(RECORDS_MAP_TOOLBOX_KEY, Boolean(open));
}

export function readRecordsBatchPanelOpen() {
  return readFoldOpen(RECORDS_BATCH_PANEL_KEY, false);
}

export function writeRecordsBatchPanelOpen(open) {
  writeFoldOpen(RECORDS_BATCH_PANEL_KEY, Boolean(open));
}
