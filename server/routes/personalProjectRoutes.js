const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  listProjects,
  createProject,
  getProjectById,
  updateProject,
  deleteProject,
  createFolder,
  updateFolder,
  deleteFolder,
  createAsset,
  updateAsset,
  deleteAsset,
  downloadAssetFile,
  uploadAsset,
} = require('../controllers/personalProjectController');

router.use(protect);

router.route('/').get(listProjects).post(createProject);
router.route('/:id').get(getProjectById).put(updateProject).delete(deleteProject);

router.route('/:id/folders').post(createFolder);
router.route('/:id/folders/:folderId').put(updateFolder).delete(deleteFolder);

router.route('/:id/assets').post(createAsset);
router.route('/:id/assets/:assetId').put(updateAsset).delete(deleteAsset);
router.route('/:id/assets/:assetId/file').get(downloadAssetFile);
router.route('/:id/upload').post(uploadAsset);

module.exports = router;
