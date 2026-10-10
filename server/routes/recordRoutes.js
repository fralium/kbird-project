const express = require('express');
const router = express.Router();
const { 
  getRecords,
  getRecord,
  createRecord,
  editRecord,
  deleteBirdFromRecord,
  deleteRecord,
  getUserRecords,
  getRecordsByBird,
  syncRecordLocation,
  getRecordLocationOptions,
  getRecordMapPoints,
  getMonthlyObservationRecommendations,
} = require('../controllers/recordController');
const { protect } = require('../middleware/auth');
const {
  validateObjectIdParam,
  validatePagination,
  validateRecordPayload,
} = require('../middleware/validation');

// 获取所有观鸟记录
router.get('/', validatePagination, getRecords);

// 获取特定鸟类的观鸟记录
router.get('/bird/:birdId', validateObjectIdParam('birdId'), getRecordsByBird);

// 获取地点筛选选项（省市）
router.get('/location-options', getRecordLocationOptions);

// 获取地图聚合点（必须在 /:id 之前）
router.get('/map-points', getRecordMapPoints);

// 获取本月推荐观察鸟类
router.get('/monthly-observation', getMonthlyObservationRecommendations);

// 获取用户的观鸟记录（必须在 /:id 之前）
router.get('/user/:userId', protect, validateObjectIdParam('userId'), getUserRecords);

// 获取单个观鸟记录
router.get('/:id', validateObjectIdParam('id'), getRecord);

// 创建观鸟记录
router.post('/', protect, validateRecordPayload, createRecord);

// 从地点名录同步坐标到记录（按地点名称）
router.put('/:id/sync-location', protect, validateObjectIdParam('id'), syncRecordLocation);

// 编辑观鸟记录
router.put('/:id', protect, validateObjectIdParam('id'), validateRecordPayload, editRecord);

// 从观鸟记录中删除特定鸟类
router.delete('/:id/bird/:birdId', protect, validateObjectIdParam('id'), validateObjectIdParam('birdId'), deleteBirdFromRecord);

// 删除观鸟记录
router.delete('/:id', protect, validateObjectIdParam('id'), deleteRecord);

module.exports = router;
