const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  exportBackup,
  previewRestore,
  applyRestore,
} = require('../controllers/personalBackupController');

router.use(protect);
router.get('/export', exportBackup);
router.post('/restore/preview', previewRestore);
router.post('/restore/apply', applyRestore);

module.exports = router;
