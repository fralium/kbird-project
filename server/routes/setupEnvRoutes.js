const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { getSetupEnv, updateSetupEnv } = require('../controllers/setupEnvController');

router.use(protect);
router.use(authorize('admin'));

router.get('/', getSetupEnv);
router.put('/', updateSetupEnv);

module.exports = router;
