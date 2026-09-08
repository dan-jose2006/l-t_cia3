const router = require('express').Router();
const controller = require('../controllers/memberController');
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { objectIdParam, paginationRules } = require('../validators/common');

router.use(authenticate);
router.get('/', authorize('librarian', 'admin'), paginationRules, validate, controller.listMembers);
router.get('/:id/history', objectIdParam(), validate, controller.getBorrowingHistory);
router.get('/:id', authorize('librarian', 'admin'), objectIdParam(), validate, controller.getMember);

module.exports = router;
