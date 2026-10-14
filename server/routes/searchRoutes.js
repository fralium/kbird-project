const express = require('express');
const Bird = require('../models/birdModel');
const Location = require('../models/locationModel');
const Record = require('../models/recordModel');
const {
  validateSearchQuery,
  validateHotSearchQuery,
} = require('../middleware/validation');
const { buildBirdSmartSearchOr } = require('../utils/birdSearch');
const { publicNonDraftRecordFilter } = require('../utils/publicRecordFilter');
const { sendControllerError } = require('../middleware/controllerError');

const router = express.Router();

const BIRD_FIELDS =
  'name scientificName englishName category images namePinyin namePinyinInitials nameAliases nameAliasPinyin nameAliasPinyinInitials scientificNamePinyin scientificNamePinyinInitials';
const SUGGESTION_LIMIT = 16;

function firstBirdImageUrl(images) {
  if (!Array.isArray(images) || images.length === 0) return '';
  const first = images.find((img) => img && (img.url || typeof img === 'string'));
  if (!first) return '';
  return typeof first === 'string' ? first : String(first.url || '').trim();
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isLatinQuery(value) {
  return /^[a-zA-Z\s'`´]+$/.test(String(value || '').trim());
}

function isSingleHanzi(value) {
  return /^[\u3400-\u9fff]$/.test(String(value || '').trim());
}

function compactPinyin(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[''`´]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function toBirdCard(bird) {
  return {
    _id: bird._id,
    name: bird.name,
    scientificName: bird.scientificName,
    category: bird.category,
    image: firstBirdImageUrl(bird.images),
  };
}

function rankHanziSuggestions(birds, q) {
  return [...birds].sort((a, b) => {
    const score = (bird) => {
      const name = String(bird.name || '');
      const aliases = Array.isArray(bird.nameAliases) ? bird.nameAliases.map(String) : [];
      if (name.startsWith(q)) return 0;
      if (aliases.some((alias) => alias.startsWith(q))) return 1;
      if (name.includes(q)) return 2;
      if (aliases.some((alias) => alias.includes(q))) return 3;
      return 4;
    };
    const aScore = score(a);
    const bScore = score(b);
    if (aScore !== bScore) return aScore - bScore;
    if (a.name.length !== b.name.length) return a.name.length - b.name.length;
    return String(a.name).localeCompare(String(b.name), 'zh');
  });
}

function pinyinRank(bird, compact) {
  const initials = String(bird.namePinyinInitials || '').toLowerCase();
  const aliasInitials = (Array.isArray(bird.nameAliasPinyinInitials) ? bird.nameAliasPinyinInitials : [])
    .map((item) => String(item || '').toLowerCase());
  const syllables = String(bird.namePinyin || '').toLowerCase().split(/\s+/).filter(Boolean);
  const aliasSyllables = (Array.isArray(bird.nameAliasPinyin) ? bird.nameAliasPinyin : [])
    .flatMap((item) => String(item || '').toLowerCase().split(/\s+/).filter(Boolean));
  const joined = syllables.join('');
  const aliasJoined = (Array.isArray(bird.nameAliasPinyin) ? bird.nameAliasPinyin : [])
    .map((item) => String(item || '').toLowerCase().replace(/\s+/g, ''));
  if (initials === compact || aliasInitials.includes(compact)) return 0;
  if (initials.startsWith(compact) || aliasInitials.some((item) => item.startsWith(compact))) return 1;
  if (joined.startsWith(compact) || aliasJoined.some((item) => item.startsWith(compact))) return 2;
  if (
    syllables.some((word) => word.startsWith(compact)) ||
    aliasSyllables.some((word) => word.startsWith(compact))
  ) {
    return 3;
  }
  return 4;
}

function rankPinyinSuggestions(birds, compact) {
  return [...birds].sort(
    (a, b) => pinyinRank(a, compact) - pinyinRank(b, compact)
      || a.name.length - b.name.length
      || String(a.name).localeCompare(String(b.name), 'zh')
  );
}

async function findBirdSuggestions(q) {
  if (isSingleHanzi(q)) {
    const hanziRe = new RegExp(escapeRegex(q));
    const birds = await Bird.find({ $or: [{ name: hanziRe }, { nameAliases: hanziRe }] })
      .select(BIRD_FIELDS)
      .limit(40)
      .lean();
    return rankHanziSuggestions(birds, q).slice(0, SUGGESTION_LIMIT);
  }

  const compact = compactPinyin(q);
  if (!compact) return [];
  const initialsRe = new RegExp(`^${escapeRegex(compact)}`, 'i');
  const syllableRe = new RegExp(
    `(^|\\s)${compact.split('').map((ch) => escapeRegex(ch)).join('\\s*')}`,
    'i'
  );
  const smartOr = buildBirdSmartSearchOr(q);
  const or = smartOr.length
    ? smartOr
    : [
        { namePinyinInitials: initialsRe },
        { nameAliasPinyinInitials: initialsRe },
        { namePinyin: syllableRe },
        { nameAliasPinyin: syllableRe },
      ];
  if (compact.length >= 2) {
    or.push(
      { englishName: new RegExp(escapeRegex(compact), 'i') },
      { scientificName: new RegExp(escapeRegex(compact), 'i') }
    );
  }
  const birds = await Bird.find({ $or: or })
    .select(BIRD_FIELDS)
    .limit(60)
    .lean();
  return rankPinyinSuggestions(birds, compact).slice(0, SUGGESTION_LIMIT);
}

// @desc    热门搜索词（热门鸟种 + 热门地点）
// @route   GET /api/search/hot
// @access  Public
router.get('/hot', validateHotSearchQuery, async (req, res) => {
  try {
    const parsedLimit = parseInt(req.query.limit, 10);
    const limit = Math.min(Math.max(Number.isFinite(parsedLimit) ? parsedLimit : 8, 1), 20);

    const [hotBirdAgg, hotLocationAgg] = await Promise.all([
      Record.aggregate([
        { $match: publicNonDraftRecordFilter() },
        { $unwind: '$birds' },
        { $group: { _id: '$birds.birdId', count: { $sum: '$birds.count' } } },
        { $sort: { count: -1 } },
        { $limit: limit * 2 },
      ]),
      Record.aggregate([
        {
          $match: publicNonDraftRecordFilter({
            'location.name': { $exists: true, $ne: '', $type: 'string' },
          }),
        },
        { $group: { _id: '$location.name', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: limit },
      ]),
    ]);

    const birdIds = hotBirdAgg.map((item) => item._id).filter(Boolean);
    const birds = birdIds.length
      ? await Bird.find({ _id: { $in: birdIds } }).select('_id name').lean()
      : [];
    const birdNameMap = new Map(birds.map((bird) => [bird._id.toString(), bird.name]));
    const hotBirds = hotBirdAgg
      .map((item) => ({
        term: birdNameMap.get(String(item._id)),
        type: 'bird',
        count: item.count || 0,
      }))
      .filter((item) => item.term)
      .slice(0, limit);

    const hotLocations = hotLocationAgg
      .map((item) => ({
        term: String(item._id || '').trim(),
        type: 'location',
        count: item.count || 0,
      }))
      .filter((item) => item.term)
      .slice(0, limit);

    const merged = [];
    const seen = new Set();
    for (const item of [...hotBirds, ...hotLocations]) {
      if (!item.term || seen.has(item.term)) continue;
      seen.add(item.term);
      merged.push(item);
      if (merged.length >= limit) break;
    }

    res.json({
      success: true,
      data: {
        keywords: merged,
        birds: hotBirds,
        locations: hotLocations,
      },
    });
  } catch (error) {
    console.error('获取热门搜索词失败:', error);
    return sendControllerError(res, error, {
      defaultMessage: '获取热门搜索词失败',
      defaultCode: 'SEARCH_HOT_FAILED',
    });
  }
});

// @desc    简单全局搜索（鸟种名、学名、地点名）
// @route   GET /api/search?q=
// @access  Public
router.get('/', validateSearchQuery, async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (!q) {
      return res.json({
        success: true,
        data: { birds: [], locations: [], suggestions: [], mode: 'match', query: q },
      });
    }

    if (isSingleHanzi(q) || isLatinQuery(q)) {
      const suggestions = await findBirdSuggestions(q);
      return res.json({
        success: true,
        data: {
          query: q,
          mode: 'suggest',
          suggestions: suggestions.map(toBirdCard),
          birds: [],
          locations: [],
        },
      });
    }

    const escaped = escapeRegex(q);
    const regex = new RegExp(escaped, 'i');
    const nameOr = buildBirdSmartSearchOr(q);
    const birds = await Bird.find({ $or: nameOr.length ? nameOr : [{ name: regex }] })
      .select(BIRD_FIELDS)
      .limit(20)
      .lean();
    birds.sort((a, b) => {
      const score = (bird) => {
        if (bird.name === q) return 0;
        if ((bird.nameAliases || []).includes(q)) return 1;
        if (String(bird.name || '').includes(q)) return 2;
        if ((bird.nameAliases || []).some((alias) => String(alias).includes(q))) return 3;
        return 4;
      };
      return score(a) - score(b);
    });
    const namedLocations = await Location.find({ name: regex }).select('name type').limit(15).lean();

    const birdIds = birds.map((bird) => bird._id);
    const birdsMissingImage = birds.filter((bird) => !firstBirdImageUrl(bird.images));
    const recordImageByBird = new Map();
    if (birdsMissingImage.length) {
      const shotRows = await Record.aggregate([
        {
          $match: publicNonDraftRecordFilter({
            'birds.birdId': { $in: birdsMissingImage.map((bird) => bird._id) },
          }),
        },
        { $unwind: '$birds' },
        {
          $match: {
            'birds.birdId': { $in: birdsMissingImage.map((bird) => bird._id) },
            'birds.images.0.url': { $exists: true, $ne: '' },
          },
        },
        {
          $group: {
            _id: '$birds.birdId',
            url: { $first: { $arrayElemAt: ['$birds.images.url', 0] } },
          },
        },
      ]);
      shotRows.forEach((row) => {
        if (row.url) recordImageByBird.set(String(row._id), String(row.url));
      });
    }
    const sightingRows = birdIds.length
      ? await Record.aggregate([
          {
            $match: publicNonDraftRecordFilter({
              'birds.birdId': { $in: birdIds },
            }),
          },
          { $unwind: '$birds' },
          { $match: { 'birds.birdId': { $in: birdIds } } },
          {
            $group: {
              _id: '$location.name',
              sightingCount: { $sum: 1 },
            },
          },
          { $match: { _id: { $type: 'string', $ne: '' } } },
          { $sort: { sightingCount: -1, _id: 1 } },
          { $limit: 15 },
        ])
      : [];

    const locationsByName = new Map();
    namedLocations.forEach((location) => {
      const name = String(location.name || '').trim();
      if (!name) return;
      locationsByName.set(name, {
        _id: location._id,
        name,
        type: location.type || '',
        sightingCount: 0,
      });
    });
    sightingRows.forEach((row) => {
      const name = String(row._id || '').trim();
      if (!name) return;
      const existing = locationsByName.get(name);
      if (existing) {
        existing.sightingCount = row.sightingCount || 0;
        return;
      }
      locationsByName.set(name, {
        _id: null,
        name,
        type: '',
        sightingCount: row.sightingCount || 0,
      });
    });

    const unresolved = [...locationsByName.values()].filter((item) => !item._id);
    if (unresolved.length) {
      const docs = await Location.find({ name: { $in: unresolved.map((item) => item.name) } })
        .select('name type')
        .lean();
      docs.forEach((doc) => {
        const item = locationsByName.get(doc.name);
        if (!item) return;
        item._id = doc._id;
        if (!item.type) item.type = doc.type || '';
      });
    }

    const locations = [...locationsByName.values()].sort(
      (a, b) => (b.sightingCount - a.sightingCount) || a.name.localeCompare(b.name, 'zh')
    );

    res.json({
      success: true,
      data: {
        query: q,
        mode: 'match',
        suggestions: [],
        birds: birds.map((bird) => ({
          _id: bird._id,
          name: bird.name,
          scientificName: bird.scientificName,
          category: bird.category,
          image: firstBirdImageUrl(bird.images) || recordImageByBird.get(String(bird._id)) || '',
        })),
        locations,
      },
    });
  } catch (error) {
    console.error('搜索失败:', error);
    return sendControllerError(res, error, {
      defaultMessage: '搜索失败',
      defaultCode: 'SEARCH_FAILED',
    });
  }
});

module.exports = router;
