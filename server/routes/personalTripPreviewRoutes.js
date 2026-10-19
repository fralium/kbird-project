const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { birdreportLinkLimiter } = require('../middleware/rateLimiter');
const {
  compareTripPreview,
  previewBirdreportLink,
  listTripPreviewHistory,
  getTripPreviewHistory,
  deleteTripPreviewHistory,
  getTripPreviewLocationPast,
} = require('../controllers/personalTripPreviewController');

router.use(protect);
router.post('/', compareTripPreview);
router.post('/from-url', birdreportLinkLimiter, previewBirdreportLink);
router.get('/location-past', getTripPreviewLocationPast);
router.get('/history', listTripPreviewHistory);
router.get('/history/:id', getTripPreviewHistory);
router.delete('/history/:id', deleteTripPreviewHistory);

module.exports = router;
