const router = require('express').Router();
const controller = require('../controllers/reportController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate, authorize('librarian', 'admin'));
router.get('/dashboard', controller.dashboard);
router.get('/most-borrowed', controller.mostBorrowed);
router.get('/overdue', controller.overdueReport);
router.get('/inventory-health', controller.inventoryHealth);
router.get('/fines', controller.fineSummary);

module.exports = router;
