const router = require('express').Router();
const controller = require('../controllers/finePaymentController');
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { objectIdParam, paginationRules } = require('../validators/common');
const { paymentRules, reversePaymentRules } = require('../validators/adminValidators');

router.use(authenticate);
router.get('/my', authorize('member'), controller.listMyPayments);
router.get('/', authorize('librarian', 'admin'), paginationRules, validate, controller.listPayments);
router.post('/', authorize('librarian', 'admin'), paymentRules, validate, controller.recordPayment);
router.put('/:id/reverse', authorize('admin'), objectIdParam(), reversePaymentRules, validate, controller.reversePayment);

module.exports = router;
