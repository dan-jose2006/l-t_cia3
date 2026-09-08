const MS_PER_DAY = 24 * 60 * 60 * 1000;

function startOfUtcDay(value) {
  const date = new Date(value);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function calculateOverdueDays(dueDate, returnedAt = new Date(), graceDays = 0) {
  const difference = startOfUtcDay(returnedAt) - startOfUtcDay(dueDate);
  const rawDays = Math.max(Math.ceil(difference / MS_PER_DAY), 0);
  return Math.max(rawDays - Math.max(Number(graceDays) || 0, 0), 0);
}

function calculateFine({ dueDate, returnedAt = new Date(), finePerDay = 0, graceDays = 0 }) {
  const overdueDays = calculateOverdueDays(dueDate, returnedAt, graceDays);
  const amount = Number((overdueDays * Math.max(Number(finePerDay) || 0, 0)).toFixed(2));
  return { overdueDays, amount };
}

function addDays(date, days) {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + Number(days));
  return result;
}

module.exports = { calculateOverdueDays, calculateFine, addDays };
