const Book = require('../models/Book');
const User = require('../models/User');
const Hold = require('../models/Hold');
const Transaction = require('../models/Transaction');
const FinePayment = require('../models/FinePayment');
const asyncHandler = require('../utils/asyncHandler');
const { getSettings } = require('../services/circulationService');

const dashboard = asyncHandler(async (req, res) => {
  const now = new Date();
  const [titles, members, activeLoans, overdue, activeHolds, copyTotals, fineTotals, settings] = await Promise.all([
    Book.countDocuments({ isArchived: false }),
    User.countDocuments({ role: 'member', isActive: true }),
    Transaction.countDocuments({ status: { $in: ['borrowed', 'overdue'] } }),
    Transaction.countDocuments({ status: { $in: ['borrowed', 'overdue'] }, dueDate: { $lt: now } }),
    Hold.countDocuments({ status: { $in: ['waiting', 'ready'] } }),
    Book.aggregate([
      { $match: { isArchived: false } },
      { $group: { _id: null, total: { $sum: '$totalCopies' }, available: { $sum: '$availableCopies' }, lost: { $sum: '$lostCopies' }, damaged: { $sum: '$damagedCopies' } } },
    ]),
    Transaction.aggregate([
      { $group: { _id: null, assessed: { $sum: '$fine.assessedAmount' }, waived: { $sum: '$fine.waivedAmount' }, paid: { $sum: '$fine.paidAmount' } } },
    ]),
    getSettings(),
  ]);

  const copies = copyTotals[0] || { total: 0, available: 0, lost: 0, damaged: 0 };
  const fines = fineTotals[0] || { assessed: 0, waived: 0, paid: 0 };
  fines.outstanding = Math.max(fines.assessed - fines.waived - fines.paid, 0);
  res.json({
    success: true,
    data: { titles, members, activeLoans, overdue, activeHolds, copies, fines, currency: settings.currency },
  });
});

const mostBorrowed = asyncHandler(async (req, res) => {
  const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 10, 1), 50);
  const data = await Transaction.aggregate([
    { $group: { _id: '$book', borrowCount: { $sum: 1 }, currentlyBorrowed: { $sum: { $cond: [{ $in: ['$status', ['borrowed', 'overdue']] }, 1, 0] } } } },
    { $sort: { borrowCount: -1 } },
    { $limit: limit },
    { $lookup: { from: 'books', localField: '_id', foreignField: '_id', as: 'book' } },
    { $unwind: '$book' },
    { $project: { _id: 0, bookId: '$_id', title: '$book.title', author: '$book.author', isbn: '$book.isbn', category: '$book.category', borrowCount: 1, currentlyBorrowed: 1 } },
  ]);
  res.json({ success: true, data });
});

const overdueReport = asyncHandler(async (req, res) => {
  const now = new Date();
  const data = await Transaction.find({ status: { $in: ['borrowed', 'overdue'] }, dueDate: { $lt: now } })
    .populate('book', 'title author isbn category')
    .populate('member', 'name email membershipId memberType phone')
    .sort({ dueDate: 1 });
  res.json({ success: true, data });
});

const inventoryHealth = asyncHandler(async (req, res) => {
  const books = await Book.find({ isArchived: false }).sort({ title: 1 });
  const data = books.map((book) => {
    const borrowed = Math.max(book.totalCopies - book.availableCopies - book.lostCopies - book.damagedCopies, 0);
    return {
      bookId: book._id,
      title: book.title,
      isbn: book.isbn,
      category: book.category,
      totalCopies: book.totalCopies,
      availableCopies: book.availableCopies,
      borrowedCopies: borrowed,
      lostCopies: book.lostCopies,
      damagedCopies: book.damagedCopies,
      availabilityRate: book.totalCopies ? Number(((book.availableCopies / book.totalCopies) * 100).toFixed(1)) : 0,
      health: book.lostCopies > 0 || book.damagedCopies > 0 ? 'attention' : book.availableCopies === 0 ? 'fully-borrowed' : 'healthy',
    };
  });
  res.json({ success: true, data });
});

const fineSummary = asyncHandler(async (req, res) => {
  const [totals, methods] = await Promise.all([
    Transaction.aggregate([{ $group: { _id: null, assessed: { $sum: '$fine.assessedAmount' }, waived: { $sum: '$fine.waivedAmount' }, paid: { $sum: '$fine.paidAmount' } } }]),
    FinePayment.aggregate([
      { $match: { status: 'completed' } },
      { $group: { _id: '$method', amount: { $sum: '$amount' }, payments: { $sum: 1 } } },
      { $sort: { amount: -1 } },
    ]),
  ]);
  const summary = totals[0] || { assessed: 0, waived: 0, paid: 0 };
  summary.outstanding = Math.max(summary.assessed - summary.waived - summary.paid, 0);
  res.json({ success: true, data: { summary, byPaymentMethod: methods } });
});

module.exports = { dashboard, mostBorrowed, overdueReport, inventoryHealth, fineSummary };
