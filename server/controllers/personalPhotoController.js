const Record = require('../models/recordModel');
const Bird = require('../models/birdModel');
const { sendControllerError } = require('../middleware/controllerError');
const { devError } = require('../utils/devLogger');

// @desc    获取个人照片库
// @route   GET /api/personal/photos
// @access  Private
const getPersonalPhotos = async (req, res) => {
  try {
    const userId = req.user.id;
    const { 
      birdId, 
      location, 
      dateFrom, 
      dateTo, 
      search,
      organize,
      page = 1, 
      limit = 50,
      sortBy = 'date',
      sortOrder = 'desc'
    } = req.query;
    
    // 获取用户的所有已审核记录
    const recordQuery = {
      observer: userId,
      status: { $ne: 'draft' },
    };
    
    if (dateFrom || dateTo) {
      recordQuery.date = {};
      if (dateFrom) recordQuery.date.$gte = new Date(dateFrom);
      if (dateTo) {
        const end = new Date(dateTo);
        if (!Number.isNaN(end.getTime())) {
          end.setHours(23, 59, 59, 999);
          recordQuery.date.$lte = end;
        }
      }
    }
    
    if (location) {
      recordQuery['location.name'] = { $regex: location, $options: 'i' };
    }
    
    const records = await Record.find(recordQuery)
      .populate('birds.birdId', 'name scientificName images')
      .sort({ date: -1 });
    
    // 收集所有照片：观鸟记录中的照片 + 鸟类图鉴中当前用户上传的照片（主图等）
    let allPhotos = [];
    const seenUrls = new Set(); // 用于去重（同一张图可能既在记录里又在图鉴里）
    
    records.forEach(record => {
      const locationName = record.location?.name || '';
      const recordBirds = Array.isArray(record.birds) ? record.birds.filter((b) => b?.birdId) : [];
      const singleBird = recordBirds.length === 1 ? recordBirds[0] : null;
      const inferredBirdId = singleBird?.birdId?._id || singleBird?.birdId || null;
      const inferredBirdName = singleBird?.birdId?.name || null;
      const inferredScientific = singleBird?.birdId?.scientificName || null;

      // 记录级别的照片
      if (record.images && record.images.length > 0) {
        record.images.forEach(image => {
          const url = image.url && String(image.url).replace(/^\/+/, '');
          if (url && seenUrls.has(url)) return;
          if (url) seenUrls.add(url);
          allPhotos.push({
            url: image.url,
            caption: image.caption || '',
            date: record.date,
            location: locationName,
            recordId: record._id,
            recordTitle: record.title,
            birdId: inferredBirdId,
            birdName: inferredBirdName,
            birdScientificName: inferredScientific,
            source: 'record',
            uploadedAt: image.uploadedAt || record.createdAt,
          });
        });
      }
      
      // 鸟类级别的照片（观鸟记录中的鸟图）
      record.birds.forEach(birdRecord => {
        if (!birdRecord?.birdId) return;
        if (birdRecord.images && birdRecord.images.length > 0) {
          birdRecord.images.forEach(image => {
            const url = image.url && String(image.url).replace(/^\/+/, '');
            if (url && seenUrls.has(url)) return;
            if (url) seenUrls.add(url);
            allPhotos.push({
              url: image.url,
              caption: image.caption || '',
              date: record.date,
              location: locationName,
              recordId: record._id,
              recordTitle: record.title,
              birdId: birdRecord.birdId._id,
              birdName: birdRecord.birdId.name,
              birdScientificName: birdRecord.birdId.scientificName,
              source: 'bird',
              uploadedAt: image.uploadedAt || record.createdAt,
            });
          });
        }
      });
    });
    
    // 鸟类图鉴中当前用户上传的照片（图片栏/主图，不在观鸟记录里的也纳入照片库）
    const birdsWithMyPhotos = await Bird.find({ 'images.photographer': userId })
      .select('name scientificName images')
      .lean();
    birdsWithMyPhotos.forEach(bird => {
      if (!bird.images || !bird.images.length) return;
      bird.images.forEach((img) => {
        if (!img.photographer || img.photographer.toString() !== userId) return;
        const url = img.url && String(img.url).replace(/^\/+/, '');
        if (url && seenUrls.has(url)) return; // 与记录中重复则跳过
        if (url) seenUrls.add(url);
        allPhotos.push({
          url: img.url,
          caption: img.caption || '',
          date: img.date || bird.updatedAt,
          location: img.location || '',
          recordId: null,
          recordTitle: null,
          birdId: bird._id,
          birdName: bird.name,
          birdScientificName: bird.scientificName,
          source: 'bird_gallery',
          uploadedAt: img.date || bird.updatedAt,
        });
      });
    });
    
    // 筛选
    if (birdId) {
      allPhotos = allPhotos.filter(photo => 
        photo.birdId && photo.birdId.toString() === birdId
      );
    }
    
    if (dateFrom || dateTo) {
      const fromTs = dateFrom ? new Date(dateFrom).getTime() : null;
      const toEnd = dateTo ? new Date(dateTo) : null;
      if (toEnd && !Number.isNaN(toEnd.getTime())) {
        toEnd.setHours(23, 59, 59, 999);
      }
      const toTs = toEnd && !Number.isNaN(toEnd.getTime()) ? toEnd.getTime() : null;
      allPhotos = allPhotos.filter((photo) => {
        const d = photo.date || photo.uploadedAt;
        if (!d) return true;
        const t = new Date(d).getTime();
        if (fromTs != null && !Number.isNaN(fromTs) && t < fromTs) return false;
        if (toTs != null && t > toTs) return false;
        return true;
      });
    }
    
    if (search) {
      const searchLower = search.toLowerCase();
      allPhotos = allPhotos.filter(photo =>
        (photo.caption || '').toLowerCase().includes(searchLower) ||
        (photo.birdName || '').toLowerCase().includes(searchLower) ||
        (photo.location || '').toLowerCase().includes(searchLower)
      );
    }

    // 整理筛选：待补种 / 未挂记录 / 已关联记录
    if (organize === 'needsSpecies') {
      allPhotos = allPhotos.filter((photo) => !photo.birdId);
    } else if (organize === 'unlinked') {
      allPhotos = allPhotos.filter((photo) => !photo.recordId);
    } else if (organize === 'linked') {
      allPhotos = allPhotos.filter((photo) => Boolean(photo.recordId));
    }
    
    // 排序
    allPhotos.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'date':
          comparison = new Date(a.date) - new Date(b.date);
          break;
        case 'uploadedAt':
          comparison = new Date(a.uploadedAt) - new Date(b.uploadedAt);
          break;
        case 'location':
          comparison = (a.location || '').localeCompare(b.location || '');
          break;
        case 'birdName':
          comparison = (a.birdName || '').localeCompare(b.birdName || '');
          break;
        default:
          comparison = 0;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });
    
    // 分页
    const total = allPhotos.length;
    const startIndex = (parseInt(page) - 1) * parseInt(limit);
    const endIndex = startIndex + parseInt(limit);
    const paginatedPhotos = allPhotos.slice(startIndex, endIndex);
    
    res.json({
      success: true,
      data: paginatedPhotos,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    devError('获取照片库失败:', error);
    return sendControllerError(res, error, {
      defaultMessage: '获取照片库失败',
      defaultCode: 'PERSONAL_PHOTO_OPERATION_FAILED',
    });
  }
};

// @desc    获取照片统计信息
// @route   GET /api/personal/photos/stats
// @access  Private
const getPhotoStats = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const records = await Record.find({
      observer: userId,
      status: { $ne: 'draft' },
    })
      .populate('birds.birdId', 'name');
    
    let totalPhotos = 0;
    let needsSpeciesCount = 0;
    let recordsWithoutPhotos = 0;
    const photosByBird = new Set(); // 使用 Set 来去重，统计有照片的鸟类ID
    const photosByLocation = new Set(); // 使用 Set 来去重，统计有照片的地点
    const photosByMonth = {};
    const birdPhotoCounts = {}; // 用于统计每个鸟类的照片数量
    const locationPhotoCounts = {}; // 用于统计每个地点的照片数量
    
    records.forEach(record => {
      const locationName = record.location?.name || '';
      const hasRecordImages = Array.isArray(record.images) && record.images.length > 0;
      const hasBirdImages = (record.birds || []).some(
        (birdRecord) => Array.isArray(birdRecord?.images) && birdRecord.images.length > 0
      );
      if (!hasRecordImages && !hasBirdImages) {
        recordsWithoutPhotos += 1;
      }

      // 记录级别照片：仅当记录没有可推断的单一鸟种时计为「待补种」
      if (hasRecordImages) {
        totalPhotos += record.images.length;
        const recordBirds = Array.isArray(record.birds) ? record.birds.filter((b) => b?.birdId) : [];
        if (recordBirds.length !== 1) {
          needsSpeciesCount += record.images.length;
        }
        const monthKey = `${new Date(record.date).getFullYear()}-${String(new Date(record.date).getMonth() + 1).padStart(2, '0')}`;
        photosByMonth[monthKey] = (photosByMonth[monthKey] || 0) + record.images.length;
        
        // 记录地点（只要该记录有照片，就记录这个地点）
        if (locationName) {
          photosByLocation.add(locationName);
          locationPhotoCounts[locationName] = (locationPhotoCounts[locationName] || 0) + record.images.length;
        }
      }
      
      // 鸟类级别照片（观鸟记录中的）
      record.birds.forEach(birdRecord => {
        if (!birdRecord?.birdId) return;
        if (birdRecord.images && birdRecord.images.length > 0) {
          totalPhotos += birdRecord.images.length;
          const monthKey = `${new Date(record.date).getFullYear()}-${String(new Date(record.date).getMonth() + 1).padStart(2, '0')}`;
          photosByMonth[monthKey] = (photosByMonth[monthKey] || 0) + birdRecord.images.length;
          
          // 记录地点
          if (locationName) {
            photosByLocation.add(locationName);
            locationPhotoCounts[locationName] = (locationPhotoCounts[locationName] || 0) + birdRecord.images.length;
          }
          
          // 记录有照片的鸟类（使用birdId来去重）
          if (birdRecord.birdId && birdRecord.birdId._id) {
            const birdId = birdRecord.birdId._id.toString();
            photosByBird.add(birdId);
            const birdName = birdRecord.birdId.name;
            if (!birdPhotoCounts[birdId]) {
              birdPhotoCounts[birdId] = { name: birdName, count: 0 };
            }
            birdPhotoCounts[birdId].count += birdRecord.images.length;
          }
        }
      });
    });
    
    // 鸟类图鉴中当前用户上传的照片（主图/图片栏）
    let unlinkedCount = 0;
    const birdsWithMyPhotos = await Bird.find({ 'images.photographer': userId })
      .select('name images')
      .lean();
    birdsWithMyPhotos.forEach((bird) => {
      const userImages = (bird.images || []).filter(
        (img) => img.photographer && img.photographer.toString() === userId
      );
      if (userImages.length === 0) return;
      totalPhotos += userImages.length;
      unlinkedCount += userImages.length;
      const birdId = bird._id.toString();
      photosByBird.add(birdId);
      if (!birdPhotoCounts[birdId]) birdPhotoCounts[birdId] = { name: bird.name, count: 0 };
      birdPhotoCounts[birdId].count += userImages.length;
      userImages.forEach((img) => {
        const d = img.date || bird.updatedAt;
        if (d) {
          const monthKey = `${new Date(d).getFullYear()}-${String(new Date(d).getMonth() + 1).padStart(2, '0')}`;
          photosByMonth[monthKey] = (photosByMonth[monthKey] || 0) + 1;
        }
        if (img.location) {
          photosByLocation.add(img.location);
          locationPhotoCounts[img.location] = (locationPhotoCounts[img.location] || 0) + 1;
        }
      });
    });
    
    // 转换为数组并排序（用于显示Top列表）
    const topBirds = Array.from(photosByBird)
      .map(birdId => birdPhotoCounts[birdId])
      .filter(Boolean)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
      .map(({ name, count }) => ({ name, count }));
    
    const topLocations = Array.from(photosByLocation)
      .map(locationName => ({
        name: locationName,
        count: locationPhotoCounts[locationName] || 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
    
    res.json({
      success: true,
      data: {
        totalPhotos,
        needsSpeciesCount,
        unlinkedCount,
        recordsWithoutPhotos,
        photosByBird: topBirds, // 返回Top列表，但前端应该使用 photosByBird.length 来显示总数
        photosByLocation: topLocations, // 返回Top列表，但前端应该使用 photosByLocation.length 来显示总数
        uniqueBirdCount: photosByBird.size, // 添加唯一鸟类数量
        uniqueLocationCount: photosByLocation.size, // 添加唯一地点数量
        photosByMonth: Object.entries(photosByMonth)
          .map(([month, count]) => ({ month, count }))
          .sort((a, b) => a.month.localeCompare(b.month)),
      },
    });
  } catch (error) {
    devError('获取照片统计失败:', error);
    return sendControllerError(res, error, {
      defaultMessage: '获取照片统计失败',
      defaultCode: 'PERSONAL_PHOTO_OPERATION_FAILED',
    });
  }
};

// @desc    获取照片的鸟类列表（用于筛选）
// @route   GET /api/personal/photos/birds
// @access  Private
const getPhotoBirds = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const birdSet = new Set();
    
    // 观鸟记录中有照片的鸟类
    const records = await Record.find({
      observer: userId,
      status: { $ne: 'draft' },
    })
      .populate('birds.birdId', 'name scientificName');
    records.forEach(record => {
      record.birds.forEach(birdRecord => {
        if (birdRecord.birdId && birdRecord.images && birdRecord.images.length > 0) {
          birdSet.add(JSON.stringify({
            _id: birdRecord.birdId._id,
            name: birdRecord.birdId.name,
            scientificName: birdRecord.birdId.scientificName,
          }));
        }
      });
    });
    
    // 鸟类图鉴中当前用户上传过照片的鸟类（主图/图片栏）
    const birdsWithMyPhotos = await Bird.find({ 'images.photographer': userId })
      .select('name scientificName')
      .lean();
    birdsWithMyPhotos.forEach((bird) => {
      birdSet.add(JSON.stringify({
        _id: bird._id,
        name: bird.name,
        scientificName: bird.scientificName || '',
      }));
    });
    
    const birds = Array.from(birdSet).map(b => JSON.parse(b));
    
    res.json({
      success: true,
      data: birds.sort((a, b) => (a.name || '').localeCompare(b.name || '')),
    });
  } catch (error) {
    devError('获取鸟类列表失败:', error);
    return sendControllerError(res, error, {
      defaultMessage: '获取鸟类列表失败',
      defaultCode: 'PERSONAL_PHOTO_OPERATION_FAILED',
    });
  }
};

module.exports = {
  getPersonalPhotos,
  getPhotoStats,
  getPhotoBirds,
};
