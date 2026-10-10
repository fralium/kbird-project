const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  listPlots,
  createPlot,
  getPlotById,
  updatePlot,
  updatePlotReport,
  deletePlot,
  addSpecies,
  updateSpecies,
  deleteSpecies,
  addEntry,
  deleteEntry,
  importCbrcToPlot,
} = require('../controllers/personalPlotController');

router.use(protect);

router.route('/').get(listPlots).post(createPlot);
router.route('/:id').get(getPlotById).put(updatePlot).delete(deletePlot);
router.route('/:id/reports/:reportId').put(updatePlotReport);

router.route('/:id/species').post(addSpecies);
router.route('/:id/species/:speciesId').put(updateSpecies).delete(deleteSpecies);
router.route('/:id/species/:speciesId/entries/:entryId').delete(deleteEntry);

router.route('/:id/entries').post(addEntry);
router.route('/:id/import/cbrc').post(importCbrcToPlot);

module.exports = router;
