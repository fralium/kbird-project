const express = require('express');
const router = express.Router();
const { 
  getBirdFirsts, 
  getLocationFirsts 
} = require('../controllers/leaderboardController');

// 获取鸟类首次发现成就榜
router.get('/bird-firsts', getBirdFirsts);

// 获取地点首次发现成就榜
router.get('/location-firsts', getLocationFirsts);

module.exports = router;
