const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  compareTripPreview,
  listTripPreviewHistory,
  getTripPreviewHistory,
  deleteTripPreviewHistory,
  getTripPreviewLocationPast,
} = require('../controllers/personalTripPreviewController');

router.use(protect);
router.post('/', compareTripPreview);
router.get('/location-past', getTripPreviewLocationPast);
router.get('/history', listTripPreviewHistory);
router.get('/history/:id', getTripPreviewHistory);
router.delete('/history/:id', deleteTripPreviewHistory);

module.exports = router;
