const express = require('express');
const { protect } = require('../middleware/auth');
const {
  getChecklist,
  syncChecklist,
  getChecklistStats,
  updateSettings,
  getChecklistTaxonomy,
} = require('../controllers/personalChecklistController');

const router = express.Router();

router.use(protect);

router.get('/', getChecklist);
router.get('/stats', getChecklistStats);
router.get('/taxonomy', getChecklistTaxonomy);
router.post('/sync', syncChecklist);
router.put('/settings', updateSettings);

module.exports = router;
