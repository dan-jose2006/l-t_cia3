const { body, query } = require('express-validator');

const createBookRules = [
  body('title').trim().isLength({ min: 1, max: 200 }).withMessage('title is required and must be at most 200 characters'),
  body('author').trim().isLength({ min: 1, max: 160 }).withMessage('author is required and must be at most 160 characters'),
  body('isbn').trim().isLength({ min: 5, max: 30 }).withMessage('isbn must contain 5 to 30 characters'),
  body('category').trim().isLength({ min: 1, max: 80 }).withMessage('category is required'),
  body('totalCopies').isInt({ min: 1, max: 100000 }).withMessage('totalCopies must be a positive integer'),
  body('description').optional({ checkFalsy: true }).trim().isLength({ max: 1500 }).withMessage('description is too long'),
  body('publisher').optional({ checkFalsy: true }).trim().isLength({ max: 120 }).withMessage('publisher is too long'),
  body('publishedYear').optional({ nullable: true }).isInt({ min: 1000, max: 3000 }).withMessage('publishedYear is invalid'),
  body('shelfLocation').optional({ checkFalsy: true }).trim().isLength({ max: 40 }).withMessage('shelfLocation is too long'),
  body('coverUrl').optional({ checkFalsy: true }).isURL({ protocols: ['http', 'https'], require_protocol: true }).withMessage('coverUrl must be a valid URL'),
];

const updateBookRules = [
  body('title').optional().trim().isLength({ min: 1, max: 200 }).withMessage('title cannot be empty'),
  body('author').optional().trim().isLength({ min: 1, max: 160 }).withMessage('author cannot be empty'),
  body('isbn').optional().trim().isLength({ min: 5, max: 30 }).withMessage('isbn must contain 5 to 30 characters'),
  body('category').optional().trim().isLength({ min: 1, max: 80 }).withMessage('category cannot be empty'),
  body('description').optional({ nullable: true }).trim().isLength({ max: 1500 }).withMessage('description is too long'),
  body('publisher').optional({ nullable: true }).trim().isLength({ max: 120 }).withMessage('publisher is too long'),
  body('publishedYear').optional({ nullable: true }).isInt({ min: 1000, max: 3000 }).withMessage('publishedYear is invalid'),
  body('shelfLocation').optional({ nullable: true }).trim().isLength({ max: 40 }).withMessage('shelfLocation is too long'),
  body('coverUrl').optional({ nullable: true }).custom((value) => !value || /^https?:\/\//i.test(value)).withMessage('coverUrl must be a valid URL'),
];

const inventoryRules = [
  body('action').isIn(['add', 'remove', 'mark-lost', 'mark-damaged', 'repair-damaged', 'recover-lost']).withMessage('inventory action is invalid'),
  body('quantity').isInt({ min: 1, max: 10000 }).withMessage('quantity must be a positive integer'),
];

const searchRules = [
  query('q').optional().trim().isLength({ max: 160 }).withMessage('search query is too long'),
  query('title').optional().trim().isLength({ max: 200 }),
  query('author').optional().trim().isLength({ max: 160 }),
  query('category').optional().trim().isLength({ max: 80 }),
  query('available').optional().isBoolean().withMessage('available must be true or false'),
  query('sort').optional().isIn(['title', '-title', 'author', '-author', 'createdAt', '-createdAt', 'availableCopies', '-availableCopies']).withMessage('sort is invalid'),
];

module.exports = { createBookRules, updateBookRules, inventoryRules, searchRules };
