const Hold = require('../models/Hold');
const Book = require('../models/Book');
const Transaction = require('../models/Transaction');
const Notification = require('../models/Notification');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { addDays } = require('../utils/fineCalculator');
const { getSettings, promoteNextHold } = require('../services/circulationService');
const { ACTIVE_HOLD_STATUSES, ACTIVE_TRANSACTION_STATUSES, ROLES } = require('../config/constants');

const placeHold = asyncHandler(async (req, res) => {
  const book = await Book.findOne({ _id: req.body.bookId, isArchived: false });
  if (!book) throw new ApiError(404, 'Book not found', 'BOOK_NOT_FOUND');

  const [existingHold, activeLoan, activeQueueSize] = await Promise.all([
    Hold.exists({ book: book._id, member: req.user._id, status: { $in: ACTIVE_HOLD_STATUSES } }),
    Transaction.exists({ book: book._id, member: req.user._id, status: { $in: ACTIVE_TRANSACTION_STATUSES } }),
    Hold.countDocuments({ book: book._id, status: { $in: ACTIVE_HOLD_STATUSES } }),
  ]);
  if (existingHold) throw new ApiError(409, 'You already have an active hold for this book', 'DUPLICATE_HOLD');
  if (activeLoan) throw new ApiError(409, 'You already borrowed this book', 'ACTIVE_LOAN_EXISTS');
  if (book.availableCopies > 0 && activeQueueSize === 0) {
    throw new ApiError(409, 'A copy is available now; borrow it instead of placing a hold', 'BOOK_AVAILABLE');
  }

  const hold = await Hold.create({ book: book._id, member: req.user._id });
  await hold.populate([{ path: 'book', select: 'title author isbn' }, { path: 'member', select: 'name membershipId' }]);
  res.status(201).json({
    success: true,
    message: 'Hold placed successfully',
    data: { hold, queuePosition: activeQueueSize + 1 },
  });
});

const listMyHolds = asyncHandler(async (req, res) => {
  const filter = { member: req.user._id };
  if (req.query.status) filter.status = req.query.status;
  const holds = await Hold.find(filter)
    .populate('book', 'title author isbn category coverUrl availableCopies')
    .sort({ requestedAt: -1 });
  res.json({ success: true, data: holds });
});

const listHolds = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.bookId) filter.book = req.query.bookId;
  if (req.query.memberId) filter.member = req.query.memberId;
  const holds = await Hold.find(filter)
    .populate('book', 'title author isbn availableCopies')
    .populate('member', 'name email membershipId memberType')
    .sort({ requestedAt: -1 })
    .limit(200);
  res.json({ success: true, data: holds });
});

const getBookQueue = asyncHandler(async (req, res) => {
  const holds = await Hold.find({ book: req.params.bookId, status: { $in: ACTIVE_HOLD_STATUSES } })
    .populate('member', 'name email membershipId memberType')
    .populate('book', 'title author isbn')
    .sort({ requestedAt: 1, _id: 1 });
  res.json({
    success: true,
    data: holds.map((hold, index) => ({ ...hold.toJSON(), queuePosition: index + 1 })),
  });
});

const cancelHold = asyncHandler(async (req, res) => {
  const hold = await Hold.findById(req.params.id).populate('book');
  if (!hold) throw new ApiError(404, 'Hold not found', 'HOLD_NOT_FOUND');
  const ownsHold = hold.member.toString() === req.user._id.toString();
  if (req.user.role === ROLES.MEMBER && !ownsHold) throw new ApiError(403, 'Access denied', 'FORBIDDEN');
  if (!ACTIVE_HOLD_STATUSES.includes(hold.status)) throw new ApiError(409, 'This hold is no longer active', 'HOLD_NOT_ACTIVE');

  const wasReady = hold.status === 'ready';
  hold.status = 'cancelled';
  hold.cancelledAt = new Date();
  await hold.save();
  if (wasReady) await promoteNextHold(hold.book, await getSettings());
  res.json({ success: true, message: 'Hold cancelled', data: hold });
});

const updateHoldStatus = asyncHandler(async (req, res) => {
  const hold = await Hold.findById(req.params.id).populate('book');
  if (!hold) throw new ApiError(404, 'Hold not found', 'HOLD_NOT_FOUND');

  if (req.body.status === 'ready') {
    const firstWaiting = await Hold.findOne({ book: hold.book._id, status: 'waiting' }).sort({ requestedAt: 1, _id: 1 });
    if (!firstWaiting || firstWaiting._id.toString() !== hold._id.toString()) {
      throw new ApiError(409, 'Only the first waiting hold can be marked ready', 'HOLD_QUEUE_PRIORITY');
    }
    const existingReady = await Hold.exists({ book: hold.book._id, status: 'ready' });
    if (existingReady) throw new ApiError(409, 'Another hold for this book is already ready', 'READY_HOLD_EXISTS');
    const settings = await getSettings();
    hold.readyAt = new Date();
    hold.readyUntil = addDays(hold.readyAt, settings.holdReadyDays);
    await Notification.findOneAndUpdate(
      { dedupeKey: `hold-ready:${hold._id}` },
      { $setOnInsert: {
        member: hold.member,
        type: 'hold-ready',
        title: 'Reserved book is ready',
        message: `“${hold.book.title}” is ready for collection until ${hold.readyUntil.toLocaleDateString('en-IN')}.`,
        book: hold.book._id,
        hold: hold._id,
        dedupeKey: `hold-ready:${hold._id}`,
      } },
      { upsert: true },
    );
  }
  hold.status = req.body.status;
  if (req.body.status === 'fulfilled') hold.fulfilledAt = new Date();
  if (req.body.status === 'cancelled') hold.cancelledAt = new Date();
  await hold.save();
  res.json({ success: true, message: 'Hold status updated', data: hold });
});

const expireReadyHolds = asyncHandler(async (req, res) => {
  const now = new Date();
  const expired = await Hold.find({ status: 'ready', readyUntil: { $lt: now } }).populate('book');
  const settings = await getSettings();
  for (const hold of expired) {
    hold.status = 'expired';
    await hold.save();
    await promoteNextHold(hold.book, settings);
  }
  res.json({ success: true, message: `${expired.length} ready hold(s) expired`, data: { expiredCount: expired.length } });
});

module.exports = { placeHold, listMyHolds, listHolds, getBookQueue, cancelHold, updateHoldStatus, expireReadyHolds };
