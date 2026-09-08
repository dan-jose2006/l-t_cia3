const ROLES = Object.freeze({
  MEMBER: 'member',
  LIBRARIAN: 'librarian',
  ADMIN: 'admin',
});

const MEMBER_TYPES = Object.freeze({
  STUDENT: 'student',
  FACULTY: 'faculty',
});

const ACTIVE_TRANSACTION_STATUSES = ['borrowed', 'overdue'];
const ACTIVE_HOLD_STATUSES = ['waiting', 'ready'];

module.exports = { ROLES, MEMBER_TYPES, ACTIVE_TRANSACTION_STATUSES, ACTIVE_HOLD_STATUSES };
