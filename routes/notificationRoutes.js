const router = require('express').Router();
const controller = require('../controllers/notificationController');
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { objectIdParam } = require('../validators/common');

router.use(authenticate);
router.get('/my', authorize('member'), controller.listMyNotifications);
router.put('/read-all', authorize('member'), controller.markAllAsRead);
router.put('/:id/read', authorize('member'), objectIdParam(), validate, controller.markAsRead);
router.post('/generate-overdue', authorize('librarian', 'admin'), controller.generateOverdueNotifications);

module.exports = router;
