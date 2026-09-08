const router = require('express').Router();
const controller = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { registerRules, loginRules, updateProfileRules, changePasswordRules } = require('../validators/authValidators');

router.post('/register', registerRules, validate, controller.register);
router.post('/login', loginRules, validate, controller.login);
router.get('/me', authenticate, controller.getMe);
router.put('/me', authenticate, updateProfileRules, validate, controller.updateProfile);
router.put('/change-password', authenticate, changePasswordRules, validate, controller.changePassword);

module.exports = router;
