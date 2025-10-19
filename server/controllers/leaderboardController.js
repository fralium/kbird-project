const Bird = require('../models/birdModel');
const User = require('../models/userModel');

// @desc    获取鸟类首次发现成就榜
// @route   GET /api/leaderboard/bird-firsts
// @access  Public
const getBirdFirsts = async (req, res) => {
  try {
    // 使用聚合管道获取鸟类首次发现统计
    const pipeline = [
      { $unwind: '$sightings' },
      {
        $lookup: {
          from: 'users',
          localField: 'sightings.observer',
          foreignField: '_id',
          as: 'observer'
        }
      },
      {
        $addFields: {
          'sightings.observer': { $arrayElemAt: ['$observer', 0] }
        }
      },
      {
        $group: {
          _id: '$sightings.observer._id',
          observerName: { $first: '$sightings.observer.name' },
          observerAvatar: { $first: '$sightings.observer.avatar' },
          firstSightings: {
            $push: {
              birdId: '$_id',
              birdName: '$name',
              scientificName: '$scientificName',
              sightingDate: '$sightings.date',
              location: '$sightings.location.name'
            }
          },
          totalFirsts: { $sum: 1 }
        }
      },
      {
        $addFields: {
          // 按日期排序，获取最早的观察记录
          earliestSighting: { $min: '$firstSightings.sightingDate' }
        }
      },
      { $sort: { totalFirsts: -1, earliestSighting: 1 } },
      { $limit: 20 }
    ];

    const results = await Bird.aggregate(pipeline);

    res.status(200).json({
      success: true,
      data: results,
      count: results.length
    });
  } catch (error) {
    console.error('获取鸟类首次发现成就榜失败:', error);
    res.status(500).json({
      success: false,
      message: '获取成就榜失败',
      error: error.message
    });
  }
};

// @desc    获取地点首次发现成就榜
// @route   GET /api/leaderboard/location-firsts
// @access  Public
const getLocationFirsts = async (req, res) => {
  try {
    // 使用聚合管道获取地点首次发现统计
    const pipeline = [
      { $unwind: '$sightings' },
      {
        $lookup: {
          from: 'users',
          localField: 'sightings.observer',
          foreignField: '_id',
          as: 'observer'
        }
      },
      {
        $addFields: {
          'sightings.observer': { $arrayElemAt: ['$observer', 0] }
        }
      },
      {
        $group: {
          _id: '$sightings.observer._id',
          observerName: { $first: '$sightings.observer.name' },
          observerAvatar: { $first: '$sightings.observer.avatar' },
          firstSightings: {
            $push: {
              birdId: '$_id',
              birdName: '$name',
              scientificName: '$scientificName',
              sightingDate: '$sightings.date',
              location: '$sightings.location.name'
            }
          },
          totalFirsts: { $sum: 1 }
        }
      },
      {
        $addFields: {
          // 按日期排序，获取最早的观察记录
          earliestSighting: { $min: '$firstSightings.sightingDate' }
        }
      },
      { $sort: { totalFirsts: -1, earliestSighting: 1 } },
      { $limit: 20 }
    ];

    const results = await Bird.aggregate(pipeline);

    res.status(200).json({
      success: true,
      data: results,
      count: results.length
    });
  } catch (error) {
    console.error('获取地点首次发现成就榜失败:', error);
    res.status(500).json({
      success: false,
      message: '获取成就榜失败',
      error: error.message
    });
  }
};

module.exports = {
  getBirdFirsts,
  getLocationFirsts
};
