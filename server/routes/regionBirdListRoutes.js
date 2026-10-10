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
const { protect, optionalAuth } = require('../middleware/auth');
const { validateObjectIdParam, validatePagination } = require('../middleware/validation');

router.get('/', optionalAuth, validatePagination, listRegionBirdLists);
router.get('/:id', validateObjectIdParam('id'), getRegionBirdList);
router.post('/', protect, createRegionBirdList);
router.put('/:id', protect, validateObjectIdParam('id'), updateRegionBirdList);
router.delete('/:id', protect, validateObjectIdParam('id'), deleteRegionBirdList);
router.post(
  '/:id/versions/preview',
  protect,
  validateObjectIdParam('id'),
  previewRegionBirdListVersion
);
router.post(
  '/:id/versions',
  protect,
  validateObjectIdParam('id'),
  publishRegionBirdListVersion
);
router.post(
  '/:id/species/link',
  protect,
  validateObjectIdParam('id'),
  linkRegionSpeciesToCatalog
);

module.exports = router;
