const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  getGoals,
  updateGoals,
  completeGoal,
  createGoalList,
  deleteGoalList,
  appendTargetLocation,
} = require('../controllers/personalGoalsController');
const { validateGoalCompletionParams, validateGoalsPayload } = require('../middleware/validation');

router.use(protect);

router.get('/', getGoals);
router.put('/', validateGoalsPayload, updateGoals);
router.post('/lists', createGoalList);
router.delete('/lists/:listId', deleteGoalList);
router.post('/locations', appendTargetLocation);
router.post('/:type/:id/complete', validateGoalCompletionParams, completeGoal);

module.exports = router;
