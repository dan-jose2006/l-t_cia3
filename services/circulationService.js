const Book = require('../models/Book');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const Hold = require('../models/Hold');
const MembershipPlan = require('../models/MembershipPlan');
const Notification = require('../models/Notification');
const LibrarySetting = require('../models/LibrarySetting');
const ApiError = require('../utils/ApiError');
const { calculateFine, addDays } = require('../utils/fineCalculator');
const { ACTIVE_TRANSACTION_STATUSES, ACTIVE_HOLD_STATUSES, ROLES } = require('../config/constants');

async function getSettings() {
  return LibrarySetting.findOneAndUpdate(
    { key: 'default' },
    { $setOnInsert: { key: 'default' } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
}

async function getMemberPlan(member) {
  if (member.membershipPlan) {
    const selected = await MembershipPlan.findOne({ _id: member.membershipPlan, isActive: true });
    if (selected) return selected;
  }
  const plan = await MembershipPlan.findOne({ memberType: member.memberType, isActive: true }).sort({ createdAt: 1 });
  if (!plan) throw new ApiError(409, `No active ${member.memberType} membership plan is configured`, 'PLAN_NOT_CONFIGURED');
  return plan;
}

async function getFirstActiveHold(bookId) {
  return Hold.findOne({ book: bookId, status: { $in: ACTIVE_HOLD_STATUSES } }).sort({ requestedAt: 1, _id: 1 });
}

async function issueBook({ bookId, memberId, actor, requestedDueDate }) {
  const [member, settings] = await Promise.all([
    User.findOne({ _id: memberId, role: ROLES.MEMBER, isActive: true }),
    getSettings(),
  ]);
  if (!member) throw new ApiError(404, 'Active member not found', 'MEMBER_NOT_FOUND');
  if (actor.role === ROLES.MEMBER && !settings.allowMemberSelfBorrow) {
    throw new ApiError(403, 'Self-service borrowing is disabled', 'SELF_BORROW_DISABLED');
  }

  const [book, plan, activeLoanCount, existingLoan, firstHold] = await Promise.all([
    Book.findOne({ _id: bookId, isArchived: false }),
    getMemberPlan(member),
    Transaction.countDocuments({ member: member._id, status: { $in: ACTIVE_TRANSACTION_STATUSES } }),
    Transaction.exists({ member: member._id, book: bookId, status: { $in: ACTIVE_TRANSACTION_STATUSES } }),
    getFirstActiveHold(bookId),
  ]);

  if (!book) throw new ApiError(404, 'Book not found', 'BOOK_NOT_FOUND');
  if (existingLoan) throw new ApiError(409, 'This member already has an active loan for this book', 'DUPLICATE_ACTIVE_LOAN');
  if (activeLoanCount >= plan.maxBooks) {
    throw new ApiError(409, `Borrowing limit reached (${plan.maxBooks} books)`, 'BORROWING_LIMIT_REACHED');
  }
  if (firstHold && firstHold.member.toString() !== member._id.toString()) {
    throw new ApiError(409, 'This copy is reserved for the next member in the hold queue', 'HOLD_QUEUE_PRIORITY');
  }

  const issueDate = new Date();
  const dueDate = requestedDueDate ? new Date(requestedDueDate) : addDays(issueDate, plan.loanDays);
  if (dueDate <= issueDate) throw new ApiError(400, 'dueDate must be later than the issue date', 'INVALID_DUE_DATE');

  const reservedBook = await Book.findOneAndUpdate(
    { _id: book._id, isArchived: false, availableCopies: { $gt: 0 } },
    { $inc: { availableCopies: -1 } },
    { new: true },
  );
  if (!reservedBook) throw new ApiError(409, 'No copy is currently available. Place a hold instead.', 'BOOK_UNAVAILABLE');

  let transaction;
  try {
    transaction = await Transaction.create({
      book: book._id,
      member: member._id,
      issuedBy: actor._id,
      issueDate,
      dueDate,
      loanDays: plan.loanDays,
      finePerDay: plan.finePerDay,
      graceDays: plan.graceDays,
    });

    if (firstHold && firstHold.member.toString() === member._id.toString()) {
      firstHold.status = 'fulfilled';
      firstHold.fulfilledAt = new Date();
      await firstHold.save();
    }
  } catch (error) {
    await Book.updateOne({ _id: book._id }, { $inc: { availableCopies: 1 } });
    throw error;
  }

  return transaction.populate([
    { path: 'book', select: 'title author isbn category availableCopies totalCopies' },
    { path: 'member', select: 'name email membershipId memberType' },
    { path: 'issuedBy', select: 'name role' },
  ]);
}

async function promoteNextHold(book, settings) {
  if (book.availableCopies < 1) return null;
  const alreadyReady = await Hold.findOne({ book: book._id, status: 'ready' }).sort({ requestedAt: 1, _id: 1 });
  if (alreadyReady) return alreadyReady;
  const nextHold = await Hold.findOne({ book: book._id, status: 'waiting' }).sort({ requestedAt: 1, _id: 1 });
  if (!nextHold) return null;

  nextHold.status = 'ready';
  nextHold.readyAt = new Date();
  nextHold.readyUntil = addDays(nextHold.readyAt, settings.holdReadyDays);
  await nextHold.save();

  await Notification.findOneAndUpdate(
    { dedupeKey: `hold-ready:${nextHold._id}` },
    {
      $setOnInsert: {
        member: nextHold.member,
        type: 'hold-ready',
        title: 'Reserved book is ready',
        message: `“${book.title}” is ready for collection until ${nextHold.readyUntil.toLocaleDateString('en-IN')}.`,
        book: book._id,
        hold: nextHold._id,
        dedupeKey: `hold-ready:${nextHold._id}`,
      },
    },
    { upsert: true, new: true },
  );
  return nextHold;
}

async function returnBook({ transactionId, actor, condition = 'good', returnedAt = new Date() }) {
  const [transaction, settings] = await Promise.all([
    Transaction.findById(transactionId).populate('book member'),
    getSettings(),
  ]);
  if (!transaction) throw new ApiError(404, 'Borrowing transaction not found', 'TRANSACTION_NOT_FOUND');
  if (!ACTIVE_TRANSACTION_STATUSES.includes(transaction.status)) {
    throw new ApiError(409, 'This transaction has already been closed', 'TRANSACTION_ALREADY_CLOSED');
  }

  const isOwner = transaction.member._id.toString() === actor._id.toString();
  if (actor.role === ROLES.MEMBER && !isOwner) {
    throw new ApiError(403, 'Members can return only their own borrowed books', 'FORBIDDEN');
  }
  if (actor.role === ROLES.MEMBER && !settings.allowMemberSelfReturn) {
    throw new ApiError(403, 'Self-service returns are disabled', 'SELF_RETURN_DISABLED');
  }

  const returnDate = new Date(returnedAt);
  if (returnDate < transaction.issueDate) throw new ApiError(400, 'returnDate cannot be before issueDate', 'INVALID_RETURN_DATE');
  const fineResult = calculateFine({
    dueDate: transaction.dueDate,
    returnedAt: returnDate,
    finePerDay: transaction.finePerDay,
    graceDays: transaction.graceDays,
  });

  transaction.returnDate = returnDate;
  transaction.returnedTo = actor._id;
  transaction.conditionOnReturn = condition;
  transaction.status = condition === 'lost' ? 'lost' : 'returned';
  transaction.overdueDays = fineResult.overdueDays;
  transaction.fine.assessedAmount = fineResult.amount;
  transaction.fine.paymentStatus = fineResult.amount > 0 ? 'unpaid' : 'not-applicable';
  await transaction.save();

  const inventoryChange = condition === 'good'
    ? { $inc: { availableCopies: 1 } }
    : condition === 'damaged'
      ? { $inc: { damagedCopies: 1 } }
      : { $inc: { lostCopies: 1 } };
  const book = await Book.findByIdAndUpdate(transaction.book._id, inventoryChange, { new: true });

  const promotedHold = condition === 'good' ? await promoteNextHold(book, settings) : null;
  if (fineResult.amount > 0) {
    await Notification.findOneAndUpdate(
      { dedupeKey: `fine:${transaction._id}` },
      {
        $setOnInsert: {
          member: transaction.member._id,
          type: 'fine',
          title: 'Overdue fine assessed',
          message: `A fine of ${settings.currency} ${fineResult.amount.toFixed(2)} was assessed for “${book.title}”.`,
          book: book._id,
          transaction: transaction._id,
          dedupeKey: `fine:${transaction._id}`,
        },
      },
      { upsert: true },
    );
  }

  await transaction.populate([
    { path: 'book', select: 'title author isbn availableCopies damagedCopies lostCopies' },
    { path: 'member', select: 'name email membershipId' },
    { path: 'returnedTo', select: 'name role' },
  ]);
  return { transaction, promotedHold };
}

module.exports = { issueBook, returnBook, getSettings, getMemberPlan, promoteNextHold };
