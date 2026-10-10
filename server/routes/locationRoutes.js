const express = require('express');
const router = express.Router();
const { 
  getLocations,
  getLocation,
  getLocationByName,
  createLocation,
  updateLocation,
  deleteLocation,
  getNearbyLocations,
  getLocationStats,
  getPopularLocations,
  getLocationSummary,
  syncLocationsFromRecords,
  addLocationImage,
  updateLocationImage,
  setMainLocationImage,
  deleteLocationImage,
} = require('../controllers/locationController');
const { protect } = require('../middleware/auth');
const { locationSyncLimiter } = require('../middleware/rateLimiter');
const {
  validatePagination,
  validateObjectIdParam,
  validateLocationPayload,
  validateNearbyLocationsQuery,
  validateLocationByNameQuery,
} = require('../middleware/validation');

// 公开路由（/summary 需在 /:id 之前）
router.get('/', validatePagination, getLocations);
router.get('/summary', getLocationSummary);
router.get('/nearby', validateNearbyLocationsQuery, getNearbyLocations);
router.get('/stats', getLocationStats);
router.get('/popular', getPopularLocations);
router.get('/by-name', validateLocationByNameQuery, getLocationByName);
router.get('/:id', validateObjectIdParam('id'), getLocation);

// 需要认证的路由
router.post('/', protect, validateLocationPayload, createLocation);
router.post('/sync-from-records', protect, locationSyncLimiter, syncLocationsFromRecords);
router.post('/:id/images', protect, validateObjectIdParam('id'), addLocationImage);
router.put(
  '/:id/images/:imageIndex/set-main',
  protect,
  validateObjectIdParam('id'),
  setMainLocationImage
);
router.put(
  '/:id/images/:imageIndex',
  protect,
  validateObjectIdParam('id'),
  updateLocationImage
);
router.delete(
  '/:id/images/:imageIndex',
  protect,
  validateObjectIdParam('id'),
  deleteLocationImage
);
router.put('/:id', protect, validateObjectIdParam('id'), updateLocation);
router.delete('/:id', protect, validateObjectIdParam('id'), deleteLocation);

module.exports = router;
