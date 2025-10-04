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
  getRecordsByBird
} = require('../controllers/recordController');
const { protect } = require('../middleware/auth');

// 获取所有观鸟记录
router.get('/', getRecords);

// 获取特定鸟类的观鸟记录
router.get('/bird/:birdId', getRecordsByBird);

// 获取单个观鸟记录
router.get('/:id', getRecord);

// 获取用户的观鸟记录
router.get('/user/:userId', protect, getUserRecords);

// 创建观鸟记录
router.post('/', protect, createRecord);

// 编辑观鸟记录
router.put('/:id', protect, editRecord);

// 从观鸟记录中删除特定鸟类
router.delete('/:id/bird/:birdId', protect, deleteBirdFromRecord);

// 删除观鸟记录
router.delete('/:id', protect, deleteRecord);

module.exports = router;
