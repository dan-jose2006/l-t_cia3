const router = require('express').Router();
const controller = require('../controllers/transactionController');
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { objectIdParam, paginationRules } = require('../validators/common');
const { borrowRules, issueRules, returnRules, waiveFineRules } = require('../validators/circulationValidators');

router.use(authenticate);
router.post('/borrow', authorize('member'), borrowRules, validate, controller.borrow);
router.post('/issue', authorize('librarian', 'admin'), issueRules, validate, controller.issue);
router.get('/my', authorize('member'), paginationRules, validate, controller.listMyTransactions);
router.get('/', authorize('librarian', 'admin'), paginationRules, validate, controller.listTransactions);
router.get('/:id', objectIdParam(), validate, controller.getTransaction);
router.put('/:id/return', objectIdParam(), returnRules, validate, controller.processReturn);
router.put('/:id/waive-fine', authorize('librarian', 'admin'), objectIdParam(), waiveFineRules, validate, controller.waiveFine);

module.exports = router;
