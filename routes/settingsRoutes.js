const router = require('express').Router();
const controller = require('../controllers/settingsController');
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { settingsRules } = require('../validators/adminValidators');

router.get('/', authenticate, controller.getSettings);
router.put('/', authenticate, authorize('admin'), settingsRules, validate, controller.updateSettings);

module.exports = router;
