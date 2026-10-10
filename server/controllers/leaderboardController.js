const Bird = require('../models/birdModel');
const Record = require('../models/recordModel');
const Location = require('../models/locationModel');
const { sendControllerError } = require('../middleware/controllerError');
const { devError } = require('../utils/devLogger');

const sendLeaderboardError = (res, error, message = '获取成就榜失败') =>
  sendControllerError(res, error, {
    defaultMessage: message,
    defaultCode: 'LEADERBOARD_FETCH_FAILED',
    fallbackStatus: 500,
  });

// @desc    获取鸟类首次发现成就榜
// @route   GET /api/leaderboard/bird-firsts
// @access  Public
const getBirdFirsts = async (req, res) => {
  try {
    const records = await Record.find({ status: { $ne: 'draft' } })
      .populate('observer', 'name avatar')
      .sort({ date: 1 });

    const birdFirstMap = new Map();

    records.forEach((record) => {
      if (!record?.observer || !Array.isArray(record.birds)) {
        return;
      }

      record.birds.forEach((birdRecord) => {
        const birdId = String(birdRecord?.birdId || '');
        if (!birdId) return;

        const existing = birdFirstMap.get(birdId);
        if (!existing || new Date(record.date) < new Date(existing.record.date)) {
          birdFirstMap.set(birdId, {
            birdId: birdRecord.birdId,
            record,
          });
        }
      });
    });

    const birdIds = Array.from(birdFirstMap.keys());
    const birds = await Bird.find({ _id: { $in: birdIds } })
      .select('name scientificName images')
      .lean();

    const birdById = new Map(birds.map((bird) => [String(bird._id), bird]));
    const results = [];

    birdFirstMap.forEach((item, birdId) => {
      const bird = birdById.get(birdId);
      const record = item.record;
      if (!bird || !record?.observer) return;

      results.push({
        _id: `${bird._id}_${record._id}`,
        bird: {
          _id: bird._id,
          name: bird.name,
          scientificName: bird.scientificName,
          images: bird.images || [],
        },
        user: {
          _id: record.observer._id,
          name: record.observer.name,
          avatar: record.observer.avatar,
        },
        location: record.location?.name || '未知地点',
        createdAt: record.date,
      });
    });

    results.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

    res.status(200).json({
      success: true,
      data: results,
      count: results.length
    });
  } catch (error) {
    devError('获取鸟类首次发现成就榜失败:', error);
    return sendLeaderboardError(res, error, '获取成就榜失败');
  }
};

// @desc    获取地点首次发现成就榜
// @route   GET /api/leaderboard/location-firsts
// @access  Public
const getLocationFirsts = async (req, res) => {
  try {
    const records = await Record.find({ status: { $ne: 'draft' } })
      .populate('observer', 'name avatar')
      .sort({ date: 1 });

    const locationMap = new Map();

    records.forEach((record) => {
      if (!record?.observer) return;

      const locationName = String(record.location?.name || '').trim();
      if (!locationName) return;

      if (!locationMap.has(locationName)) {
        locationMap.set(locationName, {
          location: locationName,
          firstRecordDate: record.date,
          firstUser: {
            _id: record.observer._id,
            name: record.observer.name,
            avatar: record.observer.avatar,
          },
          _birdIds: new Set(),
        });
      }

      const existing = locationMap.get(locationName);
      (Array.isArray(record.birds) ? record.birds : []).forEach((birdRecord) => {
        const birdId = birdRecord?.birdId?._id || birdRecord?.birdId;
        if (birdId) existing._birdIds.add(String(birdId));
      });

      if (new Date(record.date) < new Date(existing.firstRecordDate)) {
        existing.firstRecordDate = record.date;
        existing.firstUser = {
          _id: record.observer._id,
          name: record.observer.name,
          avatar: record.observer.avatar,
        };
      }
    });

    const ranked = Array.from(locationMap.values())
      .map((item) => ({
        location: item.location,
        firstRecordDate: item.firstRecordDate,
        firstUser: item.firstUser,
        birdCount: item._birdIds.size,
      }))
      .sort((a, b) => new Date(a.firstRecordDate) - new Date(b.firstRecordDate))
      .slice(0, 50);

    const names = ranked.map((item) => item.location);
    const locationDocs = names.length
      ? await Location.find({ name: { $in: names }, status: { $ne: 'archived' } })
          .select('name type images environment')
          .lean()
      : [];
    const locationByName = new Map(
      locationDocs.map((doc) => [String(doc.name || '').trim(), doc])
    );

    const results = ranked.map((item, index) => {
      const doc = locationByName.get(item.location);
      return {
        _id: doc?._id ? String(doc._id) : `location_${index}`,
        location: item.location,
        firstRecordDate: item.firstRecordDate,
        firstUser: item.firstUser,
        birdCount: item.birdCount,
        locationId: doc?._id ? String(doc._id) : null,
        locationType: doc?.type || '',
        images: Array.isArray(doc?.images) ? doc.images : [],
        environment: doc?.environment || null,
      };
    });

    res.status(200).json({
      success: true,
      data: results,
      count: results.length
    });
  } catch (error) {
    devError('获取地点首次发现成就榜失败:', error);
    return sendLeaderboardError(res, error, '获取成就榜失败');
  }
};

module.exports = {
  getBirdFirsts,
  getLocationFirsts
};
