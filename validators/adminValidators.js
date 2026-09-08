const { body } = require('express-validator');

function makePlanRules(allOptional = false) {
  const maybe = (chain) => (allOptional ? chain.optional() : chain);
  return [
    maybe(body('key')).trim().matches(/^[a-z0-9-]+$/).withMessage('key may contain lowercase letters, numbers, and hyphens'),
    maybe(body('name')).trim().isLength({ min: 2, max: 80 }).withMessage('name must contain 2 to 80 characters'),
    maybe(body('memberType')).isIn(['student', 'faculty']).withMessage('memberType must be student or faculty'),
    maybe(body('maxBooks')).isInt({ min: 1, max: 50 }).toInt().withMessage('maxBooks must be between 1 and 50'),
    maybe(body('loanDays')).isInt({ min: 1, max: 180 }).toInt().withMessage('loanDays must be between 1 and 180'),
    maybe(body('finePerDay')).isFloat({ min: 0, max: 10000 }).toFloat().withMessage('finePerDay is invalid'),
    body('graceDays').optional().isInt({ min: 0, max: 30 }).toInt().withMessage('graceDays is invalid'),
    body('isActive').optional().isBoolean().toBoolean(),
  ];
}

const planRules = makePlanRules(false);
const planUpdateRules = makePlanRules(true);

const paymentRules = [
  body('transactionId').isMongoId().withMessage('transactionId must be a valid MongoDB ObjectId'),
  body('amount').isFloat({ min: 0.01 }).toFloat().withMessage('amount must be greater than zero'),
  body('method').isIn(['cash', 'upi', 'card', 'bank-transfer']).withMessage('payment method is invalid'),
  body('reference').optional({ checkFalsy: true }).trim().isLength({ max: 120 }).withMessage('reference is too long'),
];

const reversePaymentRules = [
  body('reason').trim().isLength({ min: 3, max: 300 }).withMessage('reason must contain 3 to 300 characters'),
];

const staffRules = [
  body('name').trim().isLength({ min: 2, max: 80 }).withMessage('name must contain 2 to 80 characters'),
  body('email').trim().isEmail().normalizeEmail().withMessage('a valid email is required'),
  body('password')
    .isLength({ min: 8, max: 72 }).withMessage('password must contain 8 to 72 characters')
    .matches(/[A-Z]/).withMessage('password must contain an uppercase letter')
    .matches(/[a-z]/).withMessage('password must contain a lowercase letter')
    .matches(/\d/).withMessage('password must contain a number'),
  body('role').optional().isIn(['librarian', 'admin']).withMessage('role must be librarian or admin'),
];

const userStatusRules = [
  body('isActive').isBoolean().toBoolean().withMessage('isActive must be true or false'),
];

const userRoleRules = [
  body('role').isIn(['librarian', 'admin']).withMessage('role must be librarian or admin'),
];

const settingsRules = [
  body('libraryName').optional().trim().isLength({ min: 2, max: 160 }).withMessage('libraryName is invalid'),
  body('currency').optional().trim().isLength({ min: 3, max: 3 }).isAlpha().withMessage('currency must be a 3-letter code'),
  body('timeZone').optional().trim().isLength({ min: 3, max: 80 }).withMessage('timeZone is invalid'),
  body('holdReadyDays').optional().isInt({ min: 1, max: 14 }).toInt().withMessage('holdReadyDays must be between 1 and 14'),
  body('allowMemberSelfBorrow').optional().isBoolean().toBoolean(),
  body('allowMemberSelfReturn').optional().isBoolean().toBoolean(),
];

module.exports = {
  planRules,
  planUpdateRules,
  paymentRules,
  reversePaymentRules,
  staffRules,
  userStatusRules,
  userRoleRules,
  settingsRules,
};
