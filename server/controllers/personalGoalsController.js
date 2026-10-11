const mongoose = require('mongoose');
const PersonalChecklist = require('../models/personalChecklistModel');
const Record = require('../models/recordModel');
const Bird = require('../models/birdModel');
const { sendControllerError } = require('../middleware/controllerError');
const { devError } = require('../utils/devLogger');
const { resolveCanonicalLocationName, normalizeLocationName } = require('../utils/locationName');
const { formatDisplayDateShort } = require('../utils/dateCoords');

const LOOSE_LIST_TITLE = '许愿目标';
const LOOSE_LIST_LEGACY_TITLES = new Set(['散装目标', '许愿目标']);

const isLooseListTitle = (title) => LOOSE_LIST_LEGACY_TITLES.has(String(title || '').trim());

const findLooseList = (lists = []) =>
  lists.find((list) => isLooseListTitle(list?.title));

const toMonthKey = (dateLike) => {
  const d = new Date(dateLike);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const getBirdIdString = (birdIdLike) => {
  if (!birdIdLike) return null;
  if (birdIdLike._id) return birdIdLike._id.toString();
  if (typeof birdIdLike === 'string') return birdIdLike;
  if (typeof birdIdLike.toString === 'function') return birdIdLike.toString();
  return null;
};

const sendGoalsError = (res, error, message, code) =>
  sendControllerError(res, error, {
    defaultMessage: message,
    defaultCode: code,
    fallbackStatus: error?.statusCode || 500,
  });

const ensureChecklist = async (userId) => {
  let checklist = await PersonalChecklist.findOne({ userId });
  if (!checklist) {
    checklist = await PersonalChecklist.create({ userId });
  }
  if (!checklist.goals) checklist.goals = {};
  if (!Array.isArray(checklist.goals.targetBirds)) checklist.goals.targetBirds = [];
  if (!Array.isArray(checklist.goals.targetLists)) checklist.goals.targetLists = [];
  if (!Array.isArray(checklist.goals.targetLocations)) checklist.goals.targetLocations = [];
  return checklist;
};

/** 把旧 targetBirds 收进「许愿目标」列表；顺带把「散装目标」改名 */
const migrateTargetBirdsIntoLists = (checklist) => {
  const birds = Array.isArray(checklist.goals?.targetBirds) ? checklist.goals.targetBirds : [];
  const lists = Array.isArray(checklist.goals.targetLists) ? checklist.goals.targetLists : [];
  let dirty = false;

  let loose = findLooseList(lists);
  if (loose && String(loose.title || '') !== LOOSE_LIST_TITLE) {
    loose.title = LOOSE_LIST_TITLE;
    dirty = true;
  }

  if (!birds.length) {
    if (dirty) checklist.goals.targetLists = lists;
    return dirty;
  }

  if (!loose) {
    loose = {
      title: LOOSE_LIST_TITLE,
      locationLabel: '',
      sourceHistoryId: '',
      createdAt: new Date(),
      species: [],
    };
    lists.unshift(loose);
  }
  const existingIds = new Set(
    (loose.species || []).map((item) => getBirdIdString(item.birdId)).filter(Boolean)
  );
  birds.forEach((bird) => {
    const birdId = getBirdIdString(bird.birdId);
    if (!birdId || existingIds.has(birdId)) return;
    existingIds.add(birdId);
    loose.species.push({
      birdId,
      notes: bird.notes || '',
      completed: Boolean(bird.completed),
      completedDate: bird.completedDate || null,
    });
  });
  checklist.goals.targetLists = lists;
  checklist.goals.targetBirds = [];
  return true;
};

const flattenListSpecies = (lists = []) => {
  const rows = [];
  lists.forEach((list) => {
    const listId = list?._id ? String(list._id) : '';
    const title = String(list?.title || '').trim() || '未命名列表';
    (list?.species || []).forEach((item) => {
      // 子文档不能直接 {...item}，否则 birdId（含 populate）会丢
      const plain = item?.toObject
        ? item.toObject({ depopulate: false })
        : {
            _id: item?._id,
            birdId: item?.birdId,
            notes: item?.notes || '',
            completed: Boolean(item?.completed),
            completedDate: item?.completedDate || null,
          };
      rows.push({
        ...plain,
        listId,
        listTitle: title,
      });
    });
  });
  return rows;
};

const enrichSpeciesRows = async (checklist, speciesRows) => {
  const unresolvedBirdIds = new Set();
  speciesRows.forEach((target) => {
    const birdId = getBirdIdString(target?.birdId);
    const hasPopulatedName = Boolean(target?.birdId?.name);
    if (birdId && !hasPopulatedName) unresolvedBirdIds.add(birdId);
  });

  const birdDocs = unresolvedBirdIds.size
    ? await Bird.find({ _id: { $in: Array.from(unresolvedBirdIds) } }).select('name scientificName')
    : [];
  const birdDocMap = new Map(birdDocs.map((bird) => [bird._id.toString(), bird]));

  return speciesRows.map((target) => {
    const targetBirdId = getBirdIdString(target?.birdId);
    if (!targetBirdId) {
      return target.toObject ? target.toObject() : { ...target };
    }

    const populatedBird = target?.birdId?.name ? target.birdId : birdDocMap.get(targetBirdId);
    const normalizedBirdId = populatedBird
      ? {
          _id: populatedBird._id || targetBirdId,
          name: populatedBird.name || '',
          scientificName: populatedBird.scientificName || '',
        }
      : targetBirdId;

    const observedEntry = (checklist.observedBirds || []).find(
      (bird) => getBirdIdString(bird.birdId) === targetBirdId
    );
    const autoCompleted = Boolean(observedEntry);
    const manualCompleted = target.completed === true;
    const completed = autoCompleted || manualCompleted;
    let completedDate = null;
    if (autoCompleted && observedEntry) {
      completedDate = observedEntry.firstSeenDate;
    } else if (manualCompleted && target.completedDate) {
      completedDate = target.completedDate;
    }
    const plain = target.toObject ? target.toObject() : { ...target };
    return {
      ...plain,
      birdId: normalizedBirdId,
      birdName: populatedBird?.name || plain.birdName || '',
      scientificName: populatedBird?.scientificName || plain.scientificName || '',
      completed,
      completedDate,
      listId: plain.listId || '',
      listTitle: plain.listTitle || '',
    };
  });
};

const getGoalsData = async (userId) => {
  const checklist = await ensureChecklist(userId);
  let dirty = migrateTargetBirdsIntoLists(checklist);
  if (dirty) {
    await checklist.save();
  }

  await checklist.populate([
    { path: 'goals.targetBirds.birdId', select: 'name scientificName' },
    { path: 'goals.targetLists.species.birdId', select: 'name scientificName' },
  ]);

  const currentYear = new Date().getFullYear();
  const yearStart = new Date(`${currentYear}-01-01`);
  const yearEnd = new Date(`${currentYear}-12-31`);
  const yearRecords = await Record.find({
    observer: userId,
    status: { $ne: 'draft' },
    date: { $gte: yearStart, $lte: yearEnd },
  }).populate('birds.birdId', '_id');

  const yearSpecies = new Set();
  yearRecords.forEach((record) => {
    (record.birds || []).forEach((bird) => {
      const id = getBirdIdString(bird.birdId);
      if (id) yearSpecies.add(id);
    });
  });

  const goals = checklist.goals || {};
  const rawLists = Array.isArray(goals.targetLists) ? goals.targetLists : [];
  const flatSpecies = await enrichSpeciesRows(checklist, flattenListSpecies(rawLists));

  const speciesByListId = new Map();
  flatSpecies.forEach((row) => {
    const key = row.listId || '';
    if (!speciesByListId.has(key)) speciesByListId.set(key, []);
    speciesByListId.get(key).push(row);
  });

  const targetLists = rawLists.map((list) => {
    const plain = list.toObject ? list.toObject() : { ...list };
    const listId = plain._id ? String(plain._id) : '';
    const species = speciesByListId.get(listId) || [];
    const completedCount = species.filter((item) => item.completed).length;
    return {
      ...plain,
      _id: listId,
      species,
      stats: {
        total: species.length,
        completed: completedCount,
        pending: Math.max(0, species.length - completedCount),
        completionRate: species.length
          ? Math.round((completedCount / species.length) * 100)
          : 0,
      },
    };
  });

  // 兼容旧 UI：扁平鸟种视图
  const targetBirds = flatSpecies;

  if (goals.targetLocations) {
    const targetCanonicalSet = new Set(
      goals.targetLocations
        .map((target) => normalizeLocationName(target.locationName))
        .filter(Boolean)
    );
    const visitedLocations = new Set();
    const firstVisitByCanonical = new Map();
    yearRecords.forEach((record) => {
      const canonical = resolveCanonicalLocationName(
        record?.location?.name,
        record?.location?.address?.detail,
        targetCanonicalSet
      );
      if (!targetCanonicalSet.has(canonical)) return;
      visitedLocations.add(canonical);
      if (!firstVisitByCanonical.has(canonical)) {
        firstVisitByCanonical.set(canonical, record.date);
      }
    });

    goals.targetLocations = goals.targetLocations.map((target) => {
      const targetName = normalizeLocationName(target.locationName);
      const visited = visitedLocations.has(targetName);
      const manualCompleted = target.completed === true;
      const completed = visited || manualCompleted;
      let completedDate = null;
      if (visited) {
        completedDate = firstVisitByCanonical.get(targetName) || null;
      } else if (manualCompleted && target.completedDate) {
        completedDate = target.completedDate;
      }
      const plain = target.toObject ? target.toObject() : { ...target };
      return {
        ...plain,
        completed,
        completedDate,
      };
    });
  }

  const targetLocations = goals.targetLocations || [];
  const completedBirdCount = targetBirds.filter((item) => item.completed).length;
  const completedLocationCount = targetLocations.filter((item) => item.completed).length;
  const birdCompletionRate = targetBirds.length
    ? Math.round((completedBirdCount / targetBirds.length) * 100)
    : 0;
  const locationCompletionRate = targetLocations.length
    ? Math.round((completedLocationCount / targetLocations.length) * 100)
    : 0;

  const targetLocationNameSet = new Set(
    targetLocations.map((item) => normalizeLocationName(item.locationName)).filter(Boolean)
  );
  const targetLocationVisitedSet = new Set();
  const targetLocationMonthlyMap = {};
  yearRecords.forEach((record) => {
    const canonical = resolveCanonicalLocationName(
      record?.location?.name,
      record?.location?.address?.detail,
      targetLocationNameSet
    );
    if (!canonical || !targetLocationNameSet.has(canonical)) return;
    targetLocationVisitedSet.add(canonical);
    const monthKey = toMonthKey(record?.date);
    if (!monthKey) return;
    targetLocationMonthlyMap[monthKey] = (targetLocationMonthlyMap[monthKey] || 0) + 1;
  });

  const birdCompletionMonthlyMap = {};
  targetBirds.forEach((item) => {
    if (!item.completedDate) return;
    const monthKey = toMonthKey(item.completedDate);
    if (!monthKey) return;
    birdCompletionMonthlyMap[monthKey] = (birdCompletionMonthlyMap[monthKey] || 0) + 1;
  });

  return {
    success: true,
    data: {
      year: {
        ...goals.year,
        currentYear: goals.year?.currentYear || currentYear,
        current: {
          species: yearSpecies.size,
        },
        progress: goals.year?.targetSpecies
          ? {
              species: Math.min(
                100,
                Math.round((yearSpecies.size / goals.year.targetSpecies) * 100)
              ),
            }
          : null,
      },
      targetLists,
      targetBirds,
      targetLocations,
      challenge: {
        birds: {
          total: targetBirds.length,
          completed: completedBirdCount,
          pending: Math.max(0, targetBirds.length - completedBirdCount),
          completionRate: birdCompletionRate,
          monthlyCompleted: Object.entries(birdCompletionMonthlyMap)
            .map(([month, count]) => ({ month, count }))
            .sort((a, b) => a.month.localeCompare(b.month)),
        },
        locations: {
          total: targetLocations.length,
          completed: completedLocationCount,
          pending: Math.max(0, targetLocations.length - completedLocationCount),
          completionRate: locationCompletionRate,
          visitedThisYear: targetLocationVisitedSet.size,
          monthlyVisits: Object.entries(targetLocationMonthlyMap)
            .map(([month, count]) => ({ month, count }))
            .sort((a, b) => a.month.localeCompare(b.month)),
        },
        lists: {
          total: targetLists.length,
          speciesTotal: targetBirds.length,
          speciesCompleted: completedBirdCount,
        },
      },
    },
  };
};

const getGoals = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const result = await getGoalsData(userId);
    res.json(result);
  } catch (error) {
    devError('获取目标失败:', error);
    return sendGoalsError(res, error, '获取目标失败', 'PERSONAL_GOALS_OPERATION_FAILED');
  }
};

const updateGoals = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const { year, targetBirds, targetLocations, targetLists } = req.body;
    const checklist = await ensureChecklist(userId);
    migrateTargetBirdsIntoLists(checklist);

    if (year) {
      checklist.goals.year = {
        ...checklist.goals.year,
        ...year,
        currentYear: year.currentYear || new Date().getFullYear(),
        startDate: year.startDate
          ? new Date(year.startDate)
          : new Date(`${year.currentYear || new Date().getFullYear()}-01-01`),
        endDate: year.endDate
          ? new Date(year.endDate)
          : new Date(`${year.currentYear || new Date().getFullYear()}-12-31`),
      };
    }

    if (targetLists !== undefined) {
      checklist.goals.targetLists = (Array.isArray(targetLists) ? targetLists : []).map((list) => ({
        title: String(list.title || '').trim() || '未命名列表',
        locationLabel: String(list.locationLabel || '').trim(),
        sourceHistoryId: String(list.sourceHistoryId || '').trim(),
        createdAt: list.createdAt ? new Date(list.createdAt) : new Date(),
        species: (Array.isArray(list.species) ? list.species : [])
          .map((item) => {
            const birdId = getBirdIdString(item.birdId);
            if (!birdId || !mongoose.Types.ObjectId.isValid(birdId)) return null;
            return {
              birdId,
              notes: String(item.notes || '').trim(),
              completed: Boolean(item.completed),
              completedDate: item.completed
                ? item.completedDate
                  ? new Date(item.completedDate)
                  : null
                : null,
            };
          })
          .filter(Boolean),
      }));
      checklist.goals.targetBirds = [];
    } else if (targetBirds !== undefined) {
      // 兼容旧客户端：仍写入许愿列表
      migrateTargetBirdsIntoLists(checklist);
      let loose = findLooseList(checklist.goals.targetLists);
      if (!loose) {
        checklist.goals.targetLists.unshift({
          title: LOOSE_LIST_TITLE,
          locationLabel: '',
          sourceHistoryId: '',
          createdAt: new Date(),
          species: [],
        });
        loose = checklist.goals.targetLists[0];
      } else if (String(loose.title || '') !== LOOSE_LIST_TITLE) {
        loose.title = LOOSE_LIST_TITLE;
      }
      const previous = [...(loose.species || [])];
      loose.species = (Array.isArray(targetBirds) ? targetBirds : [])
        .map((target) => {
          const birdIdStr = getBirdIdString(target.birdId);
          if (!birdIdStr) return null;
          const existing = previous.find((item) => getBirdIdString(item?.birdId) === birdIdStr);
          const completed =
            typeof target.completed === 'boolean'
              ? target.completed
              : Boolean(existing?.completed);
          const completedDateRaw = completed
            ? target.completedDate || existing?.completedDate || null
            : null;
          return {
            birdId: birdIdStr,
            notes: target.notes || '',
            completed,
            completedDate: completedDateRaw ? new Date(completedDateRaw) : null,
          };
        })
        .filter(Boolean);
      checklist.goals.targetBirds = [];
    }

    if (targetLocations !== undefined) {
      const previousLocations = [...(checklist.goals.targetLocations || [])];
      checklist.goals.targetLocations = targetLocations.map((target) => {
        const name = String(target.locationName || '').trim();
        const existing = previousLocations.find((item) => {
          if (target._id && item._id && String(item._id) === String(target._id)) return true;
          return String(item.locationName || '').trim() === name;
        });
        const completed =
          typeof target.completed === 'boolean'
            ? target.completed
            : Boolean(existing?.completed);
        const completedDateRaw = completed
          ? target.completedDate || existing?.completedDate || null
          : null;
        return {
          locationName: target.locationName,
          notes: target.notes || '',
          completed,
          completedDate: completedDateRaw ? new Date(completedDateRaw) : null,
        };
      });
    }

    await checklist.save();
    const updatedGoals = await getGoalsData(userId);
    res.json(updatedGoals);
  } catch (error) {
    devError('更新目标失败:', error);
    return sendGoalsError(res, error, '更新目标失败', 'PERSONAL_GOALS_OPERATION_FAILED');
  }
};

const createGoalList = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const title = String(req.body?.title || '').trim();
    const locationLabel = String(req.body?.locationLabel || '').trim();
    const sourceHistoryId = String(req.body?.sourceHistoryId || '').trim();
    const birdIds = [
      ...new Set(
        (Array.isArray(req.body?.birdIds) ? req.body.birdIds : [])
          .map((id) => String(id || '').trim())
          .filter((id) => mongoose.Types.ObjectId.isValid(id))
      ),
    ];
    if (!birdIds.length) {
      const err = new Error('请至少选择一种鸟');
      err.statusCode = 400;
      err.code = 'EMPTY_GOAL_LIST';
      return sendGoalsError(res, err, err.message, err.code);
    }

    const birds = await Bird.find({ _id: { $in: birdIds } }).select('_id');
    const validIds = new Set(birds.map((bird) => String(bird._id)));
    const species = birdIds
      .filter((id) => validIds.has(id))
      .map((birdId) => ({
        birdId,
        notes: locationLabel ? `加新预测：${locationLabel}` : '加新预测',
        completed: false,
      }));
    if (!species.length) {
      const err = new Error('所选鸟种不在本机名录中');
      err.statusCode = 400;
      err.code = 'INVALID_GOAL_BIRDS';
      return sendGoalsError(res, err, err.message, err.code);
    }

    const checklist = await ensureChecklist(userId);
    migrateTargetBirdsIntoLists(checklist);
    const listDoc = {
      title: title || locationLabel || `加新目标 ${formatDisplayDateShort(new Date())}`,
      locationLabel,
      sourceHistoryId,
      createdAt: new Date(),
      species,
    };
    checklist.goals.targetLists.unshift(listDoc);
    await checklist.save();

    const refreshed = await getGoalsData(userId);
    const created = (refreshed.data?.targetLists || [])[0] || null;
    res.status(201).json({
      success: true,
      message: `已创建目标列表，共 ${species.length} 种`,
      data: refreshed.data,
      list: created,
    });
  } catch (error) {
    devError('创建目标列表失败:', error);
    return sendGoalsError(res, error, '创建目标列表失败', 'PERSONAL_GOALS_OPERATION_FAILED');
  }
};

const deleteGoalList = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const listId = String(req.params.listId || '');
    const checklist = await ensureChecklist(userId);
    const before = checklist.goals.targetLists.length;
    checklist.goals.targetLists = checklist.goals.targetLists.filter(
      (list) => String(list._id) !== listId
    );
    if (checklist.goals.targetLists.length === before) {
      const err = new Error('未找到该目标列表');
      err.statusCode = 404;
      err.code = 'GOAL_LIST_NOT_FOUND';
      return sendGoalsError(res, err, err.message, err.code);
    }
    await checklist.save();
    const refreshed = await getGoalsData(userId);
    res.json({ success: true, message: '已删除目标列表', data: refreshed.data });
  } catch (error) {
    devError('删除目标列表失败:', error);
    return sendGoalsError(res, error, '删除目标列表失败', 'PERSONAL_GOALS_OPERATION_FAILED');
  }
};

const completeGoal = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const { type, id } = req.params;
    const listId = String(req.query.listId || req.body?.listId || '');

    const checklist = await ensureChecklist(userId);
    migrateTargetBirdsIntoLists(checklist);

    let updated = false;
    if (type === 'bird') {
      const lists = checklist.goals.targetLists || [];
      for (const list of lists) {
        if (listId && String(list._id) !== listId) continue;
        const target = (list.species || []).find((t) => getBirdIdString(t.birdId) === id);
        if (target) {
          target.completed = true;
          target.completedDate = new Date();
          updated = true;
          break;
        }
      }
      if (!updated) {
        const target = (checklist.goals.targetBirds || []).find(
          (t) => getBirdIdString(t.birdId) === id
        );
        if (target) {
          target.completed = true;
          target.completedDate = new Date();
          updated = true;
        }
      }
      if (!updated) {
        const err = new Error('未找到该鸟类目标');
        err.statusCode = 404;
        err.code = 'GOAL_NOT_FOUND';
        return sendGoalsError(res, err, err.message, err.code);
      }
    } else if (type === 'location') {
      const target = checklist.goals.targetLocations.find((t) => t._id.toString() === id);
      if (!target) {
        const err = new Error('未找到该地点目标');
        err.statusCode = 404;
        err.code = 'GOAL_NOT_FOUND';
        return sendGoalsError(res, err, err.message, err.code);
      }
      target.completed = true;
      target.completedDate = new Date();
      updated = true;
    } else {
      const err = new Error('无效的类型');
      err.statusCode = 400;
      err.code = 'INVALID_GOAL_TYPE';
      return sendGoalsError(res, err, err.message, err.code);
    }

    if (updated) await checklist.save();
    const refreshed = await getGoalsData(userId);
    res.json({
      success: true,
      message: '目标已标记为完成',
      data: refreshed.data,
    });
  } catch (error) {
    devError('完成目标失败:', error);
    return sendGoalsError(res, error, '完成目标失败', 'PERSONAL_GOALS_OPERATION_FAILED');
  }
};

module.exports = {
  getGoals,
  updateGoals,
  completeGoal,
  createGoalList,
  deleteGoalList,
};
