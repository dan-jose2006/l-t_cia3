const Transaction = require('../models/Transaction');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { getPagination, paginationMeta } = require('../utils/pagination');
const { issueBook, returnBook } = require('../services/circulationService');
const { ROLES } = require('../config/constants');

const populate = [
  { path: 'book', select: 'title author isbn category coverUrl' },
  { path: 'member', select: 'name email membershipId memberType' },
  { path: 'issuedBy', select: 'name role' },
  { path: 'returnedTo', select: 'name role' },
];

const borrow = asyncHandler(async (req, res) => {
  const transaction = await issueBook({ bookId: req.body.bookId, memberId: req.user._id, actor: req.user });
  res.status(201).json({ success: true, message: 'Book borrowed successfully', data: transaction });
});

const issue = asyncHandler(async (req, res) => {
  const transaction = await issueBook({
    bookId: req.body.bookId,
    memberId: req.body.memberId,
    actor: req.user,
    requestedDueDate: req.body.dueDate,
  });
  res.status(201).json({ success: true, message: 'Book issued successfully', data: transaction });
});

const processReturn = asyncHandler(async (req, res) => {
  const result = await returnBook({
    transactionId: req.params.id,
    actor: req.user,
    condition: req.body.condition || 'good',
    returnedAt: req.body.returnDate || new Date(),
  });
  res.json({
    success: true,
    message: result.transaction.fine.assessedAmount > 0
      ? `Book returned. Fine assessed: ${result.transaction.fine.assessedAmount.toFixed(2)}`
      : 'Book returned successfully with no fine',
    data: result,
  });
});

const listMyTransactions = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const filter = { member: req.user._id };
  if (req.query.status) filter.status = req.query.status;
  const [items, total] = await Promise.all([
    Transaction.find(filter).populate(populate).sort({ issueDate: -1 }).skip(skip).limit(limit),
    Transaction.countDocuments(filter),
  ]);
  res.json({ success: true, data: items, pagination: paginationMeta(total, page, limit) });
});

const listTransactions = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.memberId) filter.member = req.query.memberId;
  if (req.query.bookId) filter.book = req.query.bookId;
  const [items, total] = await Promise.all([
    Transaction.find(filter).populate(populate).sort({ issueDate: -1 }).skip(skip).limit(limit),
    Transaction.countDocuments(filter),
  ]);
  res.json({ success: true, data: items, pagination: paginationMeta(total, page, limit) });
});

const getTransaction = asyncHandler(async (req, res) => {
  const item = await Transaction.findById(req.params.id).populate(populate);
  if (!item) throw new ApiError(404, 'Transaction not found', 'TRANSACTION_NOT_FOUND');
  const ownsItem = item.member._id.toString() === req.user._id.toString();
  if (req.user.role === ROLES.MEMBER && !ownsItem) throw new ApiError(403, 'Access denied', 'FORBIDDEN');
  res.json({ success: true, data: item });
});

const waiveFine = asyncHandler(async (req, res) => {
  const transaction = await Transaction.findById(req.params.id);
  if (!transaction) throw new ApiError(404, 'Transaction not found', 'TRANSACTION_NOT_FOUND');

  const currentBalance = Math.max(
    transaction.fine.assessedAmount - transaction.fine.waivedAmount - transaction.fine.paidAmount,
    0,
  );
  if (currentBalance <= 0) throw new ApiError(409, 'This transaction has no outstanding fine', 'NO_FINE_BALANCE');

  const amount = req.body.amount === undefined ? currentBalance : Number(req.body.amount);
  if (amount > currentBalance) throw new ApiError(409, 'Waiver cannot exceed the outstanding balance', 'WAIVER_EXCEEDS_BALANCE');

  transaction.fine.waivedAmount = Number((transaction.fine.waivedAmount + amount).toFixed(2));
  transaction.fine.waiverReason = req.body.reason;
  transaction.fine.waivedBy = req.user._id;
  transaction.fine.waivedAt = new Date();
  const remaining = currentBalance - amount;
  transaction.fine.paymentStatus = remaining <= 0
    ? (transaction.fine.paidAmount > 0 ? 'paid' : 'waived')
    : (transaction.fine.paidAmount > 0 ? 'partial' : 'unpaid');
  await transaction.save();

  res.json({ success: true, message: 'Fine waiver recorded', data: transaction });
});

module.exports = { borrow, issue, processReturn, listMyTransactions, listTransactions, getTransaction, waiveFine };
