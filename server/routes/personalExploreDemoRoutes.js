const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  listExploreDemoProjects,
  getExploreDemoProject,
} = require('../controllers/personalExploreDemoController');

router.use(protect);
router.get('/projects', listExploreDemoProjects);
router.get('/projects/:id', getExploreDemoProject);

module.exports = router;
