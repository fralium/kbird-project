const express = require('express');
const router = express.Router();
const { 
  getLocations,
  getLocation,
  createLocation,
  updateLocation,
  deleteLocation,
  getNearbyLocations,
  getLocationStats
} = require('../controllers/locationController');
const { protect } = require('../middleware/auth');

// 公开路由
router.get('/', getLocations);
router.get('/nearby', getNearbyLocations);
router.get('/stats', getLocationStats);
router.get('/:id', getLocation);

// 需要认证的路由
router.post('/', protect, createLocation);
router.put('/:id', protect, updateLocation);
router.delete('/:id', protect, deleteLocation);

module.exports = router;
