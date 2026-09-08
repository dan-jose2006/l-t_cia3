const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateFine, calculateOverdueDays, addDays } = require('../utils/fineCalculator');

test('returns zero fine when a book is returned before its due date', () => {
  const result = calculateFine({
    dueDate: '2026-09-10T10:00:00.000Z',
    returnedAt: '2026-09-08T10:00:00.000Z',
    finePerDay: 5,
  });
  assert.deepEqual(result, { overdueDays: 0, amount: 0 });
});

test('calculates overdue days by calendar day and applies daily rate', () => {
  const result = calculateFine({
    dueDate: '2026-09-01T18:00:00.000Z',
    returnedAt: '2026-09-04T07:00:00.000Z',
    finePerDay: 5,
  });
  assert.deepEqual(result, { overdueDays: 3, amount: 15 });
});

test('subtracts grace days without producing a negative fine', () => {
  assert.equal(calculateOverdueDays('2026-09-01', '2026-09-03', 1), 1);
  assert.equal(calculateOverdueDays('2026-09-01', '2026-09-02', 5), 0);
});

test('handles decimal fine rates without floating-point noise', () => {
  const result = calculateFine({ dueDate: '2026-09-01', returnedAt: '2026-09-04', finePerDay: 2.75 });
  assert.equal(result.amount, 8.25);
});

test('addDays does not mutate its input date', () => {
  const input = new Date('2026-09-01T00:00:00.000Z');
  const output = addDays(input, 14);
  assert.equal(input.toISOString(), '2026-09-01T00:00:00.000Z');
  assert.equal(output.toISOString(), '2026-09-15T00:00:00.000Z');
});
