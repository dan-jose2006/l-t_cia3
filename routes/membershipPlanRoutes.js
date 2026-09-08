const router = require('express').Router();
const controller = require('../controllers/membershipPlanController');
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { objectIdParam } = require('../validators/common');
const { planRules, planUpdateRules } = require('../validators/adminValidators');

router.use(authenticate);
router.get('/', controller.listPlans);
router.post('/', authorize('admin'), planRules, validate, controller.createPlan);
router.put('/:id', authorize('admin'), objectIdParam(), planUpdateRules, validate, controller.updatePlan);
router.delete('/:id', authorize('admin'), objectIdParam(), validate, controller.deletePlan);

module.exports = router;
