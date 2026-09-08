const { body } = require('express-validator');

const borrowRules = [
  body('bookId').isMongoId().withMessage('bookId must be a valid MongoDB ObjectId'),
];

const issueRules = [
  body('bookId').isMongoId().withMessage('bookId must be a valid MongoDB ObjectId'),
  body('memberId').isMongoId().withMessage('memberId must be a valid MongoDB ObjectId'),
  body('dueDate').optional().isISO8601().toDate().withMessage('dueDate must be an ISO date'),
];

const returnRules = [
  body('condition').optional().isIn(['good', 'damaged', 'lost']).withMessage('condition must be good, damaged, or lost'),
  body('returnDate').optional().isISO8601().toDate().withMessage('returnDate must be an ISO date'),
];

const waiveFineRules = [
  body('amount').optional().isFloat({ min: 0.01 }).toFloat().withMessage('amount must be greater than zero'),
  body('reason').trim().isLength({ min: 3, max: 300 }).withMessage('reason must contain 3 to 300 characters'),
];

const holdRules = [
  body('bookId').isMongoId().withMessage('bookId must be a valid MongoDB ObjectId'),
];

const holdStatusRules = [
  body('status').isIn(['waiting', 'ready', 'fulfilled', 'cancelled', 'expired']).withMessage('hold status is invalid'),
];

module.exports = { borrowRules, issueRules, returnRules, waiveFineRules, holdRules, holdStatusRules };
