const PersonalChecklist = require('../models/personalChecklistModel');
const Record = require('../models/recordModel');
const Location = require('../models/locationModel');
const Bird = require('../models/birdModel');
const { sendControllerError } = require('../middleware/controllerError');
const { devError } = require('../utils/devLogger');

const normalize = (value) => String(value || '').trim();
const hasRegionAddress = (address) =>
  Boolean(
    normalize(address?.province) ||
      normalize(address?.city) ||
      normalize(address?.district)
  );
const escapeRegExp = (value) =>
  String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const getLocationAddressMap = async (names = []) => {
  const normalizedNames = Array.from(new Set(names.map(normalize).filter(Boolean)));
  const result = new Map();
  if (normalizedNames.length === 0) return result;

  const exactMatched = await Location.find({
    name: { $in: normalizedNames },
  })
    .select('name address')
    .lean();

  for (const loc of exactMatched || []) {
    result.set(normalize(loc.name), loc.address || {});
  }

  const unresolved = normalizedNames.filter((name) => !result.has(name));
  if (unresolved.length === 0) return result;

  for (const name of unresolved) {
    const rx = new RegExp(`^${escapeRegExp(name)}$|${escapeRegExp(name)}$`, 'i');
    const fuzzy = await Location.findOne({ name: rx }).select('name address').lean();
    if (fuzzy) {
      result.set(name, fuzzy.address || {});
    }
  }

  return result;
};

const ensureLocationObject = (firstSeenLocation) => {
  if (!firstSeenLocation) return { name: '', address: {} };
  if (typeof firstSeenLocation === 'string') {
    return { name: normalize(firstSeenLocation), address: {} };
  }
  return {
    name: normalize(firstSeenLocation.name),
    address: firstSeenLocation.address || {},
  };
};

const toBirdIdString = (birdRef) => {
  if (!birdRef) return '';
  if (birdRef._id) return birdRef._id.toString();
  return birdRef.toString ? birdRef.toString() : String(birdRef);
};

const sameBirdSet = (checklistBirds = [], rebuiltBirds = []) => {
  if (checklistBirds.length !== rebuiltBirds.length) return false;
  const checklistSet = new Set(
    checklistBirds.map((item) => toBirdIdString(item?.birdId)).filter(Boolean)
  );
  if (checklistSet.size !== rebuiltBirds.length) return false;
  for (const item of rebuiltBirds) {
    const bid = toBirdIdString(item?.birdId);
    if (!bid || !checklistSet.has(bid)) return false;
  }
  return true;
};

const buildObservedBirdsFromRecords = async (userId) => {
  const records = await Record.find({
    observer: userId,
    status: { $ne: 'draft' },
  }).sort({ date: 1 });

  const locationNamesNeedingFallback = records
    .filter(
      (rec) =>
        !hasRegionAddress(rec.location?.address) && normalize(rec.location?.name)
    )
    .map((rec) => normalize(rec.location?.name));
  const fallbackAddressMap = await getLocationAddressMap(locationNamesNeedingFallback);

  const map = new Map();
  const buildFirstSeenLocation = (location) => {
    const name = normalize(location?.name);
    const rawAddr = location?.address || {};
    const fallbackAddr = fallbackAddressMap.get(name) || {};

    return {
      name: name || '未知地点',
      address: {
        province: normalize(rawAddr.province || fallbackAddr.province),
        city: normalize(rawAddr.city || fallbackAddr.city),
        district: normalize(rawAddr.district || fallbackAddr.district),
        detail: normalize(
          rawAddr.detail ||
            rawAddr.street ||
            fallbackAddr.detail ||
            fallbackAddr.street
        ),
      },
    };
  };

  for (const rec of records) {
    const firstSeenLocation = buildFirstSeenLocation(rec.location);
    for (const b of rec.birds || []) {
      const ref = b.birdId;
      if (!ref) continue;
      const bid = toBirdIdString(ref);
      if (!bid) continue;
      const count = b.count || 1;
      const existing = map.get(bid);
      if (!existing) {
        map.set(bid, {
          birdId: ref._id || ref,
          firstSeenDate: rec.date,
          firstSeenLocation,
          totalObservations: count,
        });
      } else {
        existing.totalObservations += count;
        if (new Date(rec.date) < new Date(existing.firstSeenDate)) {
          existing.firstSeenDate = rec.date;
          existing.firstSeenLocation = firstSeenLocation;
        }
      }
    }
  }

  return Array.from(map.values());
};

const enrichChecklistLocations = async (checklistDoc) => {
  if (!checklistDoc?.observedBirds?.length) return checklistDoc;

  const namesToResolve = checklistDoc.observedBirds
    .map((item) => ensureLocationObject(item.firstSeenLocation))
    .filter(
      (loc) => !hasRegionAddress(loc.address) && normalize(loc.name)
    )
    .map((loc) => normalize(loc.name));

  const fallbackAddressMap = await getLocationAddressMap(namesToResolve);
  if (fallbackAddressMap.size === 0) return checklistDoc;

  let changed = false;
  checklistDoc.observedBirds.forEach((item) => {
    const loc = ensureLocationObject(item.firstSeenLocation);
    if (hasRegionAddress(loc.address) || !loc.name) return;

    const fallbackAddr = fallbackAddressMap.get(loc.name);
    if (!fallbackAddr) return;

    item.firstSeenLocation = {
      name: loc.name || '未知地点',
      address: {
        province: normalize(loc.address?.province || fallbackAddr.province),
        city: normalize(loc.address?.city || fallbackAddr.city),
        district: normalize(loc.address?.district || fallbackAddr.district),
        detail: normalize(
          loc.address?.detail ||
            loc.address?.street ||
            fallbackAddr.detail ||
            fallbackAddr.street
        ),
      },
    };
    changed = true;
  });

  if (changed) {
    await checklistDoc.save();
  }
  return checklistDoc;
};

// @desc    获取或创建个人清单
// @route   GET /api/personal/checklist
// @access  Private
const getChecklist = async (req, res) => {
  try {
    let doc = await PersonalChecklist.findOne({ userId: req.user.id }).populate(
      'observedBirds.birdId',
      'name scientificName images category description habitat order'
    );
    if (!doc) {
      doc = await PersonalChecklist.create({ userId: req.user.id });
      doc = await PersonalChecklist.findById(doc._id).populate(
        'observedBirds.birdId',
        'name scientificName images category description habitat order'
      );
    }

    // 兜底一致性修复：记录与清单不一致时自动重建清单鸟种。
    const rebuiltObservedBirds = await buildObservedBirdsFromRecords(req.user.id);
    if (!sameBirdSet(doc.observedBirds, rebuiltObservedBirds)) {
      doc.observedBirds = rebuiltObservedBirds;
      await doc.save();
      doc = await PersonalChecklist.findById(doc._id).populate(
        'observedBirds.birdId',
        'name scientificName images category description habitat order'
      );
    }

    doc = await enrichChecklistLocations(doc);
    res.json({ success: true, data: doc });
  } catch (error) {
    devError('获取清单失败:', error);
    return sendControllerError(res, error, {
      defaultMessage: '获取清单失败',
      defaultCode: 'PERSONAL_CHECKLIST_OPERATION_FAILED',
    });
  }
};

// @desc    从观鸟记录同步已观察鸟种
// @route   POST /api/personal/checklist/sync
// @access  Private
const syncChecklist = async (req, res) => {
  try {
    const userId = req.user.id;
    let checklist = await PersonalChecklist.findOne({ userId });
    if (!checklist) {
      checklist = await PersonalChecklist.create({ userId });
    }

    checklist.observedBirds = await buildObservedBirdsFromRecords(userId);
    await checklist.save();

    const populated = await PersonalChecklist.findById(checklist._id).populate(
      'observedBirds.birdId',
      'name scientificName images category description habitat order'
    );

    res.json({ success: true, data: populated, message: '同步完成' });
  } catch (error) {
    devError('同步清单失败:', error);
    return sendControllerError(res, error, {
      defaultMessage: '同步清单失败',
      defaultCode: 'PERSONAL_CHECKLIST_OPERATION_FAILED',
    });
  }
};

// @desc    清单统计摘要
// @route   GET /api/personal/checklist/stats
// @access  Private
const getChecklistStats = async (req, res) => {
  try {
    const userId = req.user.id;
    const checklist = await PersonalChecklist.findOne({ userId });
    const observed = checklist?.observedBirds?.length || 0;

    const now = new Date();
    const y = now.getFullYear();
    const yearStart = new Date(`${y}-01-01`);
    const yearEnd = new Date(`${y}-12-31`);

    const yearRecords = await Record.find({
      observer: userId,
      status: { $ne: 'draft' },
      date: { $gte: yearStart, $lte: yearEnd },
    }).select('birds date');

    const yearSpecies = new Set();
    yearRecords.forEach((rec) => {
      (rec.birds || []).forEach((b) => {
        if (b.birdId) yearSpecies.add(b.birdId.toString());
      });
    });

    res.json({
      success: true,
      data: {
        totalSpecies: observed,
        yearSpeciesCount: yearSpecies.size,
        yearRecordsCount: yearRecords.length,
      },
    });
  } catch (error) {
    devError('清单统计失败:', error);
    return sendControllerError(res, error, {
      defaultMessage: '获取统计失败',
      defaultCode: 'PERSONAL_CHECKLIST_OPERATION_FAILED',
    });
  }
};

// @desc    更新清单设置
// @route   PUT /api/personal/checklist/settings
// @access  Private
const updateSettings = async (req, res) => {
  try {
    const userId = req.user.id;
    let checklist = await PersonalChecklist.findOne({ userId });
    if (!checklist) {
      checklist = await PersonalChecklist.create({ userId });
    }
    const { autoSync, sortBy } = req.body || {};
    if (typeof autoSync === 'boolean') checklist.settings.autoSync = autoSync;
    if (typeof sortBy === 'string' && sortBy.trim()) {
      const allowed = ['firstSeenDate', 'name', 'totalObservations'];
      const v = sortBy.trim();
      if (allowed.includes(v)) {
        checklist.settings.sortBy = v;
      }
    }
    await checklist.save();
    res.json({ success: true, data: checklist.settings });
  } catch (error) {
    devError('更新清单设置失败:', error);
    return sendControllerError(res, error, {
      defaultMessage: '更新设置失败',
      defaultCode: 'PERSONAL_CHECKLIST_OPERATION_FAILED',
    });
  }
};

// @desc    全名录 × 已观察（轻量，供观鸟目标「名录进度」）
// @route   GET /api/personal/checklist/taxonomy
// @access  Private
const getChecklistTaxonomy = async (req, res) => {
  try {
    const userId = req.user.id;
    let checklist = await PersonalChecklist.findOne({ userId });
    if (!checklist) {
      checklist = await PersonalChecklist.create({ userId });
    }

    // 与 GET /checklist 一致：对照观察记录自动重建，避免「只看未见」因清单未同步而显示全部
    const rebuiltObservedBirds = await buildObservedBirdsFromRecords(userId);
    if (!sameBirdSet(checklist.observedBirds, rebuiltObservedBirds)) {
      checklist.observedBirds = rebuiltObservedBirds;
      await checklist.save();
    }

    const observedMap = new Map();
    (checklist.observedBirds || []).forEach((item) => {
      const bid = toBirdIdString(item?.birdId);
      if (!bid) return;
      observedMap.set(bid, item.firstSeenDate || null);
    });

    const birds = await Bird.find({})
      .select('name scientificName order family')
      .limit(5000)
      .lean();

    const species = birds
      .map((bird) => {
        const id = bird._id.toString();
        const observed = observedMap.has(id);
        return {
          _id: bird._id,
          name: bird.name || '',
          scientificName: bird.scientificName || '',
          order: bird.order || '未分类',
          family: bird.family || '未分类',
          observed,
          firstSeenDate: observed ? observedMap.get(id) : null,
          // 预留：季节 / 地点 / 概率（AI、eBird 等）
          hint: null,
        };
      })
      .sort((a, b) => {
        const orderCmp = String(a.order).localeCompare(String(b.order), 'zh-CN');
        if (orderCmp !== 0) return orderCmp;
        const familyCmp = String(a.family).localeCompare(String(b.family), 'zh-CN');
        if (familyCmp !== 0) return familyCmp;
        return String(a.name).localeCompare(String(b.name), 'zh-CN');
      });

    const observedCount = species.filter((item) => item.observed).length;

    res.json({
      success: true,
      data: {
        total: species.length,
        observedCount,
        species,
      },
    });
  } catch (error) {
    devError('获取名录进度失败:', error);
    return sendControllerError(res, error, {
      defaultMessage: '获取名录进度失败',
      defaultCode: 'PERSONAL_CHECKLIST_TAXONOMY_FAILED',
    });
  }
};

module.exports = {
  getChecklist,
  syncChecklist,
  getChecklistStats,
  updateSettings,
  getChecklistTaxonomy,
};
