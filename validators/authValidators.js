const { body } = require('express-validator');

const registerRules = [
  body('name').trim().isLength({ min: 2, max: 80 }).withMessage('name must contain 2 to 80 characters'),
  body('email').trim().isEmail().normalizeEmail().withMessage('a valid email is required'),
  body('password')
    .isLength({ min: 8, max: 72 }).withMessage('password must contain 8 to 72 characters')
    .matches(/[A-Z]/).withMessage('password must contain an uppercase letter')
    .matches(/[a-z]/).withMessage('password must contain a lowercase letter')
    .matches(/\d/).withMessage('password must contain a number'),
  body('memberType').isIn(['student', 'faculty']).withMessage('memberType must be student or faculty'),
  body('phone').optional({ checkFalsy: true }).trim().isLength({ min: 7, max: 20 }).withMessage('phone must contain 7 to 20 characters'),
];

const loginRules = [
  body('email').trim().isEmail().normalizeEmail().withMessage('a valid email is required'),
  body('password').notEmpty().withMessage('password is required'),
];

const updateProfileRules = [
  body('name').optional().trim().isLength({ min: 2, max: 80 }).withMessage('name must contain 2 to 80 characters'),
  body('phone').optional({ nullable: true }).trim().isLength({ min: 7, max: 20 }).withMessage('phone must contain 7 to 20 characters'),
];

const changePasswordRules = [
  body('currentPassword').notEmpty().withMessage('currentPassword is required'),
  body('newPassword')
    .isLength({ min: 8, max: 72 }).withMessage('newPassword must contain 8 to 72 characters')
    .matches(/[A-Z]/).withMessage('newPassword must contain an uppercase letter')
    .matches(/[a-z]/).withMessage('newPassword must contain a lowercase letter')
    .matches(/\d/).withMessage('newPassword must contain a number'),
];

module.exports = { registerRules, loginRules, updateProfileRules, changePasswordRules };
