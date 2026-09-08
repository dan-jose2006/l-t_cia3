const router = require('express').Router();
const controller = require('../controllers/adminController');
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { objectIdParam, paginationRules } = require('../validators/common');
const { staffRules, userStatusRules, userRoleRules } = require('../validators/adminValidators');

router.use(authenticate, authorize('admin'));
router.get('/users', paginationRules, validate, controller.listUsers);
router.post('/users/staff', staffRules, validate, controller.createStaff);
router.put('/users/:id/status', objectIdParam(), userStatusRules, validate, controller.updateUserStatus);
router.put('/users/:id/role', objectIdParam(), userRoleRules, validate, controller.updateUserRole);

module.exports = router;
