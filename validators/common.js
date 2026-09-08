const { param, query } = require('express-validator');

const objectIdParam = (name = 'id') => param(name).isMongoId().withMessage(`${name} must be a valid MongoDB ObjectId`);

const paginationRules = [
  query('page').optional().isInt({ min: 1 }).withMessage('page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('limit must be between 1 and 100'),
];

module.exports = { objectIdParam, paginationRules };
