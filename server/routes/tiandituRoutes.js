const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { geocode } = require('../controllers/tiandituController');

// 地理编码会消耗服务端 Key，需登录后调用
router.get('/geocode', protect, geocode);

module.exports = router;
