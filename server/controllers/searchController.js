const Record = require('../models/recordModel');
const Bird = require('../models/birdModel');
const Location = require('../models/locationModel');

// @desc    全局搜索
// @route   GET /api/search
// @access  Private
const globalSearch = async (req, res) => {
  try {
    const userId = req.user.id;
    const { q, type, limit = 20 } = req.query;
    
    if (!q || q.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: '请输入搜索关键词',
      });
    }
    
    const searchTerm = q.trim();
    const searchType = type || 'all'; // all, birds, records, locations
    const results = {
      birds: [],
      records: [],
      locations: [],
    };
    
    // 搜索鸟类
    if (searchType === 'all' || searchType === 'birds') {
      const birdResults = await Bird.find({
        $or: [
          { name: { $regex: searchTerm, $options: 'i' } },
          { scientificName: { $regex: searchTerm, $options: 'i' } },
          { englishName: { $regex: searchTerm, $options: 'i' } },
          { family: { $regex: searchTerm, $options: 'i' } },
          { order: { $regex: searchTerm, $options: 'i' } },
        ],
      })
        .select('name scientificName englishName family order images')
        .limit(parseInt(limit))
        .lean();
      
      results.birds = birdResults.map(bird => ({
        id: bird._id,
        type: 'bird',
        name: bird.name,
        scientificName: bird.scientificName,
        englishName: bird.englishName,
        family: bird.family,
        order: bird.order,
        image: bird.images?.[0] || null,
        url: `/birds/${bird._id}`,
      }));
    }
    
    // 搜索记录
    if (searchType === 'all' || searchType === 'records') {
      const recordResults = await Record.find({
        observer: userId,
        $or: [
          { title: { $regex: searchTerm, $options: 'i' } },
          { description: { $regex: searchTerm, $options: 'i' } },
          { notes: { $regex: searchTerm, $options: 'i' } },
          { 'location.name': { $regex: searchTerm, $options: 'i' } },
        ],
      })
        .populate('birds.birdId', 'name scientificName')
        .select('title description location date birds images')
        .sort({ date: -1 })
        .limit(parseInt(limit))
        .lean();
      
      results.records = recordResults.map(record => ({
        id: record._id,
        type: 'record',
        title: record.title,
        description: record.description,
        location: record.location?.name || '',
        date: record.date,
        birds: record.birds?.map(b => ({
          name: b.birdId?.name || '',
          scientificName: b.birdId?.scientificName || '',
        })) || [],
        image: record.images?.[0] || null,
        url: `/records/${record._id}`,
      }));
    }
    
    // 搜索地点
    if (searchType === 'all' || searchType === 'locations') {
      const locationResults = await Location.find({
        $or: [
          { name: { $regex: searchTerm, $options: 'i' } },
          { province: { $regex: searchTerm, $options: 'i' } },
          { city: { $regex: searchTerm, $options: 'i' } },
          { district: { $regex: searchTerm, $options: 'i' } },
        ],
      })
        .select('name province city district coordinates')
        .limit(parseInt(limit))
        .lean();
      
      results.locations = locationResults.map(location => ({
        id: location._id,
        type: 'location',
        name: location.name,
        province: location.province,
        city: location.city,
        district: location.district,
        coordinates: location.coordinates?.coordinates || null,
        url: `/locations/${location._id}`,
      }));
    }
    
    // 统计结果数量
    const totalCount = results.birds.length + results.records.length + results.locations.length;
    
    res.json({
      success: true,
      data: {
        query: searchTerm,
        type: searchType,
        total: totalCount,
        results,
        counts: {
          birds: results.birds.length,
          records: results.records.length,
          locations: results.locations.length,
        },
      },
    });
  } catch (error) {
    console.error('全局搜索失败:', error);
    res.status(500).json({
      success: false,
      message: '搜索失败',
      error: error.message,
    });
  }
};

module.exports = {
  globalSearch,
};
