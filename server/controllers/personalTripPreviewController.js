const mongoose = require('mongoose');
const Bird = require('../models/birdModel');
const Record = require('../models/recordModel');
const PersonalChecklist = require('../models/personalChecklistModel');
const TripPreviewHistory = require('../models/tripPreviewHistoryModel');
const Location = require('../models/locationModel');
const { canonicalizeBirdName } = require('../../data/birdNameAliases');
const { sendControllerError } = require('../middleware/controllerError');
const {
  buildLocationRecordMatchers,
  findActiveLocationByFlexibleName,
} = require('../utils/locationName');

const MAX_SPECIES = 5000;
const MAX_HISTORY = 40;

const normalizeSciKey = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');

const sciBinomialKey = (value) => {
  const parts = normalizeSciKey(value).split(' ').filter(Boolean);
  if (parts.length >= 2) return `${parts[0]} ${parts[1]}`;
  return parts[0] || '';
};

const normalizeNameKey = (value) =>
  canonicalizeBirdName(String(value || '').trim()).replace(/\s+/g, '');

const quantile = (sorted, q) => {
  if (!sorted.length) return 0;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(q * sorted.length) - 1));
  return sorted[index];
};

const chanceFromCount = (count, highCut, midCut) => {
  if (count >= highCut && count > 0) return 'likely';
  if (count >= midCut && count > 0) return 'possible';
  return 'longshot';
};

const CHANCE_LABEL = {
  likely: '较易加新',
  possible: '可能',
  longshot: '碰运气',
};

const parseSpeciesInput = (rawList) => {
  if (!Array.isArray(rawList)) return [];
  const merged = new Map();
  rawList.forEach((item) => {
    const name = String(item?.name || item?.chineseName || '').trim();
    const scientificName = String(item?.scientificName || item?.latinName || '').trim();
    if (!name && !scientificName) return;
    const recordCount = Number.parseInt(String(item?.recordCount ?? item?.count ?? 0), 10);
    const safeCount = Number.isFinite(recordCount) && recordCount > 0 ? recordCount : 0;
    const key = `${normalizeNameKey(name)}|${sciBinomialKey(scientificName)}`;
    const prev = merged.get(key);
    if (prev) {
      prev.recordCount += safeCount;
      return;
    }
    merged.set(key, {
      code: String(item?.code || item?.id || '').trim(),
      name: name || scientificName,
      scientificName,
      englishName: String(item?.englishName || '').trim(),
      order: String(item?.order || '').trim(),
      family: String(item?.family || '').trim(),
      recordCount: safeCount,
    });
  });
  return Array.from(merged.values());
};

const buildCatalogMaps = (birds) => {
  const byName = new Map();
  const bySci = new Map();
  const byBinomial = new Map();
  const byId = new Map();
  birds.forEach((bird) => {
    const id = bird._id;
    byId.set(String(id), bird);
    const main = String(bird.name || '').trim();
    if (main && !byName.has(main)) byName.set(main, id);
    const canonical = canonicalizeBirdName(main);
    if (canonical && !byName.has(canonical)) byName.set(canonical, id);
    (bird.nameAliases || []).forEach((alias) => {
      const key = String(alias || '').trim();
      if (key && !byName.has(key)) byName.set(key, id);
    });
    const full = normalizeSciKey(bird.scientificName);
    const bin = sciBinomialKey(bird.scientificName);
    if (full && !bySci.has(full)) bySci.set(full, id);
    if (bin && !byBinomial.has(bin)) byBinomial.set(bin, id);
  });
  return { byName, bySci, byBinomial, byId };
};

const matchCatalogBird = (item, maps) => {
  const rawName = String(item.name || '').trim();
  const canonical = canonicalizeBirdName(rawName);
  const sciFull = normalizeSciKey(item.scientificName);
  const sciBin = sciBinomialKey(item.scientificName);
  return (
    maps.byName.get(rawName) ||
    maps.byName.get(canonical) ||
    maps.bySci.get(sciFull) ||
    maps.byBinomial.get(sciBin) ||
    null
  );
};

const parseTripDate = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const date = new Date(`${match[1]}-${match[2]}-${match[3]}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
};

const toHistoryListItem = (doc, seenSet) => {
  const summary = doc.summary || {};
  const newBirdIds = Array.isArray(doc.newBirdIds) ? doc.newBirdIds.filter(Boolean) : [];
  const addedCount = seenSet
    ? newBirdIds.filter((id) => seenSet.has(String(id))).length
    : 0;
  return {
    id: String(doc._id),
    comparedAt: doc.comparedAt,
    tripDate: doc.tripDate || null,
    locationLabel: doc.locationLabel || '',
    locationId: doc.locationId || '',
    fileName: doc.fileName || '',
    summary,
    outcome: {
      newCount: summary.newCount || newBirdIds.length,
      addedCount,
    },
  };
};

const formatChecklistLocation = (value) => {
  if (!value) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'object') {
    return String(value.name || value.label || value.locationName || '').trim();
  }
  return '';
};

const annotateOutcome = async (userId, history) => {
  const { seen } = await loadSeenBirdIds(userId);
  const windowStart = history.tripDate || history.comparedAt || history.createdAt;
  const newIds = (history.newBirdIds || []).map(String).filter(Boolean);
  const newIdSet = new Set(newIds);
  const objectIds = newIds
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));

  const firstAfter = new Map();
  const firstEver = new Map();
  const checklistFirst = new Map();

  if (objectIds.length) {
    const [records, checklist] = await Promise.all([
      Record.find({
        observer: userId,
        status: { $ne: 'draft' },
        'birds.birdId': { $in: objectIds },
      })
        .select('date location.name birds.birdId')
        .sort({ date: 1 })
        .lean(),
      PersonalChecklist.findOne({ userId })
        .select('observedBirds')
        .lean(),
    ]);

    records.forEach((record) => {
      (record.birds || []).forEach((entry) => {
        const id = entry?.birdId ? String(entry.birdId) : '';
        if (!id || !newIdSet.has(id)) return;
        const hit = {
          date: record.date,
          location: record.location?.name || '',
        };
        if (!firstEver.has(id)) firstEver.set(id, hit);
        if (
          windowStart &&
          record.date &&
          new Date(record.date).getTime() >= new Date(windowStart).getTime() &&
          !firstAfter.has(id)
        ) {
          firstAfter.set(id, hit);
        }
      });
    });

    (checklist?.observedBirds || []).forEach((entry) => {
      const id = entry?.birdId ? String(entry.birdId) : '';
      if (!id || !newIdSet.has(id)) return;
      checklistFirst.set(id, {
        date: entry.firstSeenDate || null,
        location: formatChecklistLocation(entry.firstSeenLocation),
      });
    });
  }

  const pickHistory = (birdId) => {
    if (!birdId) return { date: null, location: '', source: '' };
    const after = firstAfter.get(birdId);
    if (after?.date) {
      return { date: after.date, location: after.location || '', source: 'recordAfter' };
    }
    const ever = firstEver.get(birdId);
    if (ever?.date) {
      return { date: ever.date, location: ever.location || '', source: 'record' };
    }
    const fromList = checklistFirst.get(birdId);
    if (fromList?.date) {
      return {
        date: fromList.date,
        location: fromList.location || '',
        source: 'checklist',
      };
    }
    return { date: null, location: '', source: '' };
  };

  const decorate = (row) => {
    const birdId = row.birdId ? String(row.birdId) : '';
    const after = birdId ? firstAfter.get(birdId) : null;
    const historyHit = pickHistory(birdId);
    return {
      ...row,
      nowSeen: Boolean(birdId && seen.has(birdId)),
      recordedAfter: Boolean(after),
      firstRecordedAt: historyHit.date || null,
      firstRecordedLocation: historyHit.location || '',
      historySource: historyHit.source || '',
    };
  };

  const newSpecies = (history.newSpecies || []).map(decorate);
  const addedCount = newSpecies.filter((item) => item.nowSeen).length;
  const recordedAfterCount = newSpecies.filter((item) => item.recordedAfter).length;
  const withHistoryCount = newSpecies.filter(
    (item) => (item.nowSeen || item.recordedAfter) && item.firstRecordedAt
  ).length;

  return {
    newSpecies,
    seenSpecies: history.seenSpecies || [],
    unmatched: history.unmatched || [],
    outcome: {
      newCount: newSpecies.length,
      addedCount,
      recordedAfterCount,
      withHistoryCount,
      windowStart,
    },
  };
};

const pruneHistory = async (userId) => {
  const extras = await TripPreviewHistory.find({ userId })
    .sort({ comparedAt: -1 })
    .skip(MAX_HISTORY)
    .select('_id')
    .lean();
  if (!extras.length) return;
  await TripPreviewHistory.deleteMany({ _id: { $in: extras.map((item) => item._id) } });
};

const loadSeenBirdIds = async (userId) => {
  const seen = new Set();
  const personalCountById = new Map();
  const records = await Record.find({
    observer: userId,
    status: { $ne: 'draft' },
  })
    .select('birds.birdId')
    .lean();

  records.forEach((record) => {
    (record.birds || []).forEach((entry) => {
      const id = entry?.birdId ? String(entry.birdId) : '';
      if (!id) return;
      seen.add(id);
      personalCountById.set(id, (personalCountById.get(id) || 0) + 1);
    });
  });

  const checklist = await PersonalChecklist.findOne({ userId }).select('observedBirds').lean();
  (checklist?.observedBirds || []).forEach((entry) => {
    if (entry?.birdId) seen.add(String(entry.birdId));
  });

  return { seen, personalCountById };
};

const compareTripPreview = async (req, res) => {
  try {
    const speciesInput = parseSpeciesInput(req.body?.species);
    if (!speciesInput.length) {
      return res.status(400).json({
        success: false,
        message: '没有读到鸟种行，请确认表格含中文名或学名',
        code: 'TRIP_PREVIEW_EMPTY',
      });
    }
    if (speciesInput.length > MAX_SPECIES) {
      return res.status(400).json({
        success: false,
        message: `鸟种超过 ${MAX_SPECIES} 行，请先筛近期名录再上传`,
        code: 'TRIP_PREVIEW_TOO_LARGE',
      });
    }

    const userId = req.user._id || req.user.id;
    const [birds, seenPack] = await Promise.all([
      Bird.find({}).select('_id name scientificName nameAliases').lean(),
      loadSeenBirdIds(userId),
    ]);
    const maps = buildCatalogMaps(birds);
    const { seen, personalCountById } = seenPack;

    const counts = speciesInput.map((item) => item.recordCount).sort((a, b) => a - b);
    const highCut = Math.max(3, quantile(counts, 0.67));
    const midCut = Math.max(1, quantile(counts, 0.33));

    const newSpecies = [];
    const seenSpecies = [];
    const unmatched = [];

    speciesInput.forEach((item) => {
      const birdId = matchCatalogBird(item, maps);
      const catalog = birdId ? maps.byId.get(String(birdId)) : null;
      const chance = chanceFromCount(item.recordCount, highCut, midCut);
      const row = {
        code: item.code,
        name: item.name,
        scientificName: item.scientificName,
        englishName: item.englishName,
        order: item.order,
        family: item.family,
        recordCount: item.recordCount,
        chance,
        chanceLabel: CHANCE_LABEL[chance],
        birdId: birdId ? String(birdId) : '',
        catalogName: catalog?.name || '',
        catalogScientificName: catalog?.scientificName || '',
        personalCount: birdId ? personalCountById.get(String(birdId)) || 0 : 0,
      };

      if (birdId && seen.has(String(birdId))) {
        seenSpecies.push(row);
        return;
      }
      if (birdId) {
        newSpecies.push(row);
        return;
      }
      unmatched.push(row);
    });

    const byCountDesc = (a, b) => b.recordCount - a.recordCount || a.name.localeCompare(b.name, 'zh');
    newSpecies.sort(byCountDesc);
    seenSpecies.sort(byCountDesc);
    unmatched.sort(byCountDesc);

    const newCount = newSpecies.length;
    const likelyCount = newSpecies.filter((item) => item.chance === 'likely').length;
    const locationLabel = String(req.body?.locationLabel || '').trim().slice(0, 120);
    const locationId = String(req.body?.locationId || '').trim();
    const fileName = String(req.body?.fileName || '').trim().slice(0, 400);
    const tripDate = parseTripDate(req.body?.tripDate);
    const summary = {
      listCount: speciesInput.length,
      newCount,
      seenCount: seenSpecies.length,
      unmatchedCount: unmatched.length,
      lifeListCount: seen.size,
      likelyCount,
    };

    const saved = await TripPreviewHistory.create({
      userId,
      comparedAt: new Date(),
      tripDate,
      locationLabel,
      locationId,
      fileName,
      summary,
      thresholds: { highCut, midCut },
      newBirdIds: newSpecies.map((item) => item.birdId).filter(Boolean),
      newSpecies,
      seenSpecies,
      unmatched,
    });
    await pruneHistory(userId);

    return res.status(200).json({
      success: true,
      data: {
        historyId: String(saved._id),
        comparedAt: saved.comparedAt,
        tripDate: saved.tripDate,
        locationLabel,
        locationId,
        fileName,
        summary,
        thresholds: { highCut, midCut },
        newSpecies,
        seenSpecies,
        unmatched,
      },
    });
  } catch (error) {
    return sendControllerError(res, error, {
      message: '名录对照失败',
      code: 'TRIP_PREVIEW_FAILED',
    });
  }
};

const listTripPreviewHistory = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const queryText = String(req.query?.q || '').trim();
    const filter = { userId };
    if (queryText) {
      filter.$or = [
        { locationLabel: { $regex: queryText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } },
        { fileName: { $regex: queryText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } },
      ];
    }

    const [rows, seenPack] = await Promise.all([
      TripPreviewHistory.find(filter)
        .sort({ comparedAt: -1 })
        .select('comparedAt tripDate locationLabel locationId fileName summary newBirdIds')
        .limit(MAX_HISTORY)
        .lean(),
      loadSeenBirdIds(userId),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        items: rows.map((row) => toHistoryListItem(row, seenPack.seen)),
      },
    });
  } catch (error) {
    return sendControllerError(res, error, {
      message: '读取对照历史失败',
      code: 'TRIP_PREVIEW_HISTORY_LIST_FAILED',
    });
  }
};

const getTripPreviewHistory = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const history = await TripPreviewHistory.findOne({
      _id: req.params.id,
      userId,
    }).lean();
    if (!history) {
      return res.status(404).json({
        success: false,
        message: '找不到这条对照历史',
        code: 'TRIP_PREVIEW_HISTORY_NOT_FOUND',
      });
    }

    const outcomePack = await annotateOutcome(userId, history);
    return res.status(200).json({
      success: true,
      data: {
        historyId: String(history._id),
        comparedAt: history.comparedAt,
        tripDate: history.tripDate,
        locationLabel: history.locationLabel || '',
        locationId: history.locationId || '',
        fileName: history.fileName || '',
        summary: history.summary,
        thresholds: history.thresholds,
        seenSpecies: outcomePack.seenSpecies,
        unmatched: outcomePack.unmatched,
        newSpecies: outcomePack.newSpecies,
        outcome: outcomePack.outcome,
      },
    });
  } catch (error) {
    return sendControllerError(res, error, {
      message: '读取对照历史失败',
      code: 'TRIP_PREVIEW_HISTORY_GET_FAILED',
    });
  }
};

const deleteTripPreviewHistory = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const deleted = await TripPreviewHistory.findOneAndDelete({
      _id: req.params.id,
      userId,
    });
    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: '找不到这条对照历史',
        code: 'TRIP_PREVIEW_HISTORY_NOT_FOUND',
      });
    }
    return res.status(200).json({ success: true, data: { id: String(deleted._id) } });
  } catch (error) {
    return sendControllerError(res, error, {
      message: '删除对照历史失败',
      code: 'TRIP_PREVIEW_HISTORY_DELETE_FAILED',
    });
  }
};

const getTripPreviewLocationPast = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const name = String(req.query?.name || '').trim();
    const locationIdRaw = String(req.query?.locationId || '').trim();
    if (!name && !locationIdRaw) {
      return res.status(400).json({
        success: false,
        message: '请先填写地点',
        code: 'TRIP_PREVIEW_LOCATION_REQUIRED',
      });
    }

    let dictionary = null;
    if (locationIdRaw && mongoose.Types.ObjectId.isValid(locationIdRaw)) {
      dictionary = await Location.findOne({ _id: locationIdRaw, status: 'active' })
        .select('_id name address')
        .lean();
    }
    if (!dictionary && name) {
      const found = await findActiveLocationByFlexibleName(Location, name);
      dictionary = found ? (found.toObject ? found.toObject() : found) : null;
    }

    const matchName = String(dictionary?.name || name || '').trim();
    const matchers = buildLocationRecordMatchers(matchName);
    const records = matchers.length
      ? await Record.find({
          observer: userId,
          status: { $ne: 'draft' },
          $or: matchers,
        })
          .select('date location.name birds.birdId')
          .populate('birds.birdId', 'name scientificName')
          .sort({ date: -1 })
          .lean()
      : [];

    const speciesMap = new Map();
    records.forEach((record) => {
      const date = record.date || null;
      (record.birds || []).forEach((entry) => {
        const bird = entry?.birdId;
        const birdId = bird?._id ? String(bird._id) : bird ? String(bird) : '';
        if (!birdId) return;
        const prev = speciesMap.get(birdId);
        if (prev) {
          prev.count += 1;
          if (date && (!prev.lastDate || date > prev.lastDate)) prev.lastDate = date;
          return;
        }
        speciesMap.set(birdId, {
          birdId,
          name: bird?.name || '未命名',
          scientificName: bird?.scientificName || '',
          count: 1,
          lastDate: date,
        });
      });
    });

    const species = Array.from(speciesMap.values()).sort(
      (a, b) => b.count - a.count || a.name.localeCompare(b.name, 'zh')
    );

    return res.status(200).json({
      success: true,
      data: {
        locationId: dictionary?._id ? String(dictionary._id) : '',
        locationName: matchName,
        inDictionary: Boolean(dictionary),
        visitCount: records.length,
        speciesCount: species.length,
        lastDate: records[0]?.date || null,
        species: species.slice(0, 16),
      },
    });
  } catch (error) {
    return sendControllerError(res, error, {
      message: '读取地点过往观察失败',
      code: 'TRIP_PREVIEW_LOCATION_PAST_FAILED',
    });
  }
};

module.exports = {
  compareTripPreview,
  listTripPreviewHistory,
  getTripPreviewHistory,
  deleteTripPreviewHistory,
  getTripPreviewLocationPast,
};
