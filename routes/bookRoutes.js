const router = require('express').Router();
const controller = require('../controllers/bookController');
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { objectIdParam, paginationRules } = require('../validators/common');
const { createBookRules, updateBookRules, inventoryRules, searchRules } = require('../validators/bookValidators');

router.get('/', searchRules, paginationRules, validate, controller.listBooks);
router.get('/search', searchRules, paginationRules, validate, controller.searchBooks);
router.get('/categories', controller.listCategories);
router.get('/:id', objectIdParam(), validate, controller.getBook);
router.post('/', authenticate, authorize('librarian', 'admin'), createBookRules, validate, controller.createBook);
router.put('/:id', authenticate, authorize('librarian', 'admin'), objectIdParam(), updateBookRules, validate, controller.updateBook);
router.patch('/:id/inventory', authenticate, authorize('librarian', 'admin'), objectIdParam(), inventoryRules, validate, controller.updateInventory);
router.delete('/:id', authenticate, authorize('librarian', 'admin'), objectIdParam(), validate, controller.archiveBook);

module.exports = router;
