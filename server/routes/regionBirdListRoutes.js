const express = require('express');
const router = express.Router();
const {
  listRegionBirdLists,
  getRegionBirdList,
  createRegionBirdList,
  updateRegionBirdList,
  deleteRegionBirdList,
  previewRegionBirdListVersion,
  publishRegionBirdListVersion,
  linkRegionSpeciesToCatalog,
} = require('../controllers/regionBirdListController');
const { protect, optionalAuth, authorize } = require('../middleware/auth');
const { validateObjectIdParam, validatePagination } = require('../middleware/validation');

router.get('/', optionalAuth, validatePagination, listRegionBirdLists);
router.get('/:id', validateObjectIdParam('id'), getRegionBirdList);
router.post('/', protect, authorize('admin'), createRegionBirdList);
router.put('/:id', protect, authorize('admin'), validateObjectIdParam('id'), updateRegionBirdList);
router.delete('/:id', protect, authorize('admin'), validateObjectIdParam('id'), deleteRegionBirdList);
router.post(
  '/:id/versions/preview',
  protect,
  authorize('admin'),
  validateObjectIdParam('id'),
  previewRegionBirdListVersion
);
router.post(
  '/:id/versions',
  protect,
  authorize('admin'),
  validateObjectIdParam('id'),
  publishRegionBirdListVersion
);
router.post(
  '/:id/species/link',
  protect,
  authorize('admin'),
  validateObjectIdParam('id'),
  linkRegionSpeciesToCatalog
);

module.exports = router;
