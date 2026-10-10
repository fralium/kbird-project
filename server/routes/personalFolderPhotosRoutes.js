const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  pickFolderPhotos,
  previewFolderPhotos,
  applyFolderPhotos,
} = require('../controllers/personalFolderPhotosController');

router.use(protect);
router.post('/pick', pickFolderPhotos);
router.post('/preview', previewFolderPhotos);
router.post('/apply', applyFolderPhotos);

module.exports = router;
