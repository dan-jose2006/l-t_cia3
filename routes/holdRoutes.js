const router = require('express').Router();
const controller = require('../controllers/holdController');
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { objectIdParam } = require('../validators/common');
const { holdRules, holdStatusRules } = require('../validators/circulationValidators');

router.use(authenticate);
router.post('/', authorize('member'), holdRules, validate, controller.placeHold);
router.get('/my', authorize('member'), controller.listMyHolds);
router.post('/expire-ready', authorize('librarian', 'admin'), controller.expireReadyHolds);
router.get('/', authorize('librarian', 'admin'), controller.listHolds);
router.get('/book/:bookId/queue', authorize('librarian', 'admin'), objectIdParam('bookId'), validate, controller.getBookQueue);
router.put('/:id/cancel', objectIdParam(), validate, controller.cancelHold);
router.put('/:id/status', authorize('librarian', 'admin'), objectIdParam(), holdStatusRules, validate, controller.updateHoldStatus);

module.exports = router;
