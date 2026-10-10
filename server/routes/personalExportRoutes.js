const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { exportCbrc, exportEbird } = require('../controllers/personalExportController');

router.use(protect);

router.get('/cbrc', exportCbrc);
router.post('/cbrc', exportCbrc);
router.get('/ebird', exportEbird);
router.post('/ebird', exportEbird);

module.exports = router;
