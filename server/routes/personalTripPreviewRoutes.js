const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
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
router.post('/from-url', previewBirdreportLink);
router.get('/location-past', getTripPreviewLocationPast);
router.get('/history', listTripPreviewHistory);
router.get('/history/:id', getTripPreviewHistory);
router.delete('/history/:id', deleteTripPreviewHistory);

module.exports = router;
