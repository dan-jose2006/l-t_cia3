const FinePayment = require('../models/FinePayment');
const Transaction = require('../models/Transaction');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { getPagination, paginationMeta } = require('../utils/pagination');

function balanceFor(transaction) {
  return Math.max(
    transaction.fine.assessedAmount - transaction.fine.waivedAmount - transaction.fine.paidAmount,
    0,
  );
}

const recordPayment = asyncHandler(async (req, res) => {
  const transaction = await Transaction.findById(req.body.transactionId);
  if (!transaction) throw new ApiError(404, 'Transaction not found', 'TRANSACTION_NOT_FOUND');

  const balance = balanceFor(transaction);
  if (balance <= 0) throw new ApiError(409, 'This transaction has no outstanding fine', 'NO_FINE_BALANCE');
  if (req.body.amount > balance) throw new ApiError(409, `Payment cannot exceed the balance (${balance.toFixed(2)})`, 'PAYMENT_EXCEEDS_BALANCE');

  const payment = await FinePayment.create({
    transaction: transaction._id,
    member: transaction.member,
    amount: req.body.amount,
    method: req.body.method,
    reference: req.body.reference,
    recordedBy: req.user._id,
  });

  transaction.fine.paidAmount = Number((transaction.fine.paidAmount + req.body.amount).toFixed(2));
  transaction.fine.paymentStatus = balanceFor(transaction) <= 0 ? 'paid' : 'partial';
  await transaction.save();
  await payment.populate([
    { path: 'member', select: 'name email membershipId' },
    { path: 'transaction', populate: { path: 'book', select: 'title isbn' } },
    { path: 'recordedBy', select: 'name role' },
  ]);

  res.status(201).json({ success: true, message: 'Fine payment recorded', data: { payment, remainingBalance: balanceFor(transaction) } });
});

const listMyPayments = asyncHandler(async (req, res) => {
  const payments = await FinePayment.find({ member: req.user._id })
    .populate({ path: 'transaction', populate: { path: 'book', select: 'title author isbn' } })
    .populate('recordedBy', 'name role')
    .sort({ paidAt: -1 });
  res.json({ success: true, data: payments });
});

const listPayments = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const filter = {};
  if (req.query.memberId) filter.member = req.query.memberId;
  if (req.query.status) filter.status = req.query.status;
  const [payments, total] = await Promise.all([
    FinePayment.find(filter)
      .populate('member', 'name email membershipId')
      .populate({ path: 'transaction', populate: { path: 'book', select: 'title isbn' } })
      .populate('recordedBy', 'name role')
      .sort({ paidAt: -1 }).skip(skip).limit(limit),
    FinePayment.countDocuments(filter),
  ]);
  res.json({ success: true, data: payments, pagination: paginationMeta(total, page, limit) });
});

const reversePayment = asyncHandler(async (req, res) => {
  const payment = await FinePayment.findById(req.params.id);
  if (!payment) throw new ApiError(404, 'Fine payment not found', 'PAYMENT_NOT_FOUND');
  if (payment.status === 'reversed') throw new ApiError(409, 'Payment is already reversed', 'PAYMENT_ALREADY_REVERSED');

  const transaction = await Transaction.findById(payment.transaction);
  if (!transaction) throw new ApiError(409, 'Linked transaction no longer exists', 'TRANSACTION_NOT_FOUND');

  payment.status = 'reversed';
  payment.reversedAt = new Date();
  payment.reversedBy = req.user._id;
  payment.reversalReason = req.body.reason;
  await payment.save();

  transaction.fine.paidAmount = Math.max(Number((transaction.fine.paidAmount - payment.amount).toFixed(2)), 0);
  const balance = balanceFor(transaction);
  transaction.fine.paymentStatus = balance <= 0 ? 'paid' : (transaction.fine.paidAmount > 0 ? 'partial' : 'unpaid');
  await transaction.save();

  res.json({ success: true, message: 'Payment reversed', data: { payment, remainingBalance: balance } });
});

module.exports = { recordPayment, listMyPayments, listPayments, reversePayment };
