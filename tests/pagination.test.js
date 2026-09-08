const test = require('node:test');
const assert = require('node:assert/strict');
const { getPagination, paginationMeta } = require('../utils/pagination');

test('pagination uses safe defaults', () => {
  assert.deepEqual(getPagination({}), { page: 1, limit: 12, skip: 0 });
});

test('pagination clamps invalid and excessive values', () => {
  assert.deepEqual(getPagination({ page: '-3', limit: '1000' }), { page: 1, limit: 100, skip: 0 });
});

test('pagination computes offset and metadata', () => {
  assert.deepEqual(getPagination({ page: '3', limit: '10' }), { page: 3, limit: 10, skip: 20 });
  assert.deepEqual(paginationMeta(43, 3, 10), { total: 43, page: 3, limit: 10, pages: 5 });
});
