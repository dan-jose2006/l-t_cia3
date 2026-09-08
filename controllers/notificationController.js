const Notification = require('../models/Notification');
const Transaction = require('../models/Transaction');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { calculateOverdueDays } = require('../utils/fineCalculator');

const listMyNotifications = asyncHandler(async (req, res) => {
  const filter = { member: req.user._id };
  if (req.query.status) filter.status = req.query.status;
  const notifications = await Notification.find(filter)
    .populate('book', 'title author isbn')
    .sort({ createdAt: -1 })
    .limit(100);
  res.json({ success: true, data: notifications });
});

const markAsRead = asyncHandler(async (req, res) => {
  const notification = await Notification.findOneAndUpdate(
    { _id: req.params.id, member: req.user._id },
    { status: 'read', readAt: new Date() },
    { new: true },
  );
  if (!notification) throw new ApiError(404, 'Notification not found', 'NOTIFICATION_NOT_FOUND');
  res.json({ success: true, message: 'Notification marked as read', data: notification });
});

const markAllAsRead = asyncHandler(async (req, res) => {
  const result = await Notification.updateMany(
    { member: req.user._id, status: 'unread' },
    { status: 'read', readAt: new Date() },
  );
  res.json({ success: true, message: 'Notifications marked as read', data: { updatedCount: result.modifiedCount } });
});

const generateOverdueNotifications = asyncHandler(async (req, res) => {
  const now = new Date();
  const dateKey = now.toISOString().slice(0, 10);
  const overdue = await Transaction.find({
    status: { $in: ['borrowed', 'overdue'] },
    dueDate: { $lt: now },
  }).populate('book', 'title');

  let createdCount = 0;
  for (const transaction of overdue) {
    if (transaction.status === 'borrowed') {
      transaction.status = 'overdue';
      await transaction.save();
    }
    const days = calculateOverdueDays(transaction.dueDate, now, 0);
    const result = await Notification.updateOne(
      { dedupeKey: `overdue:${transaction._id}:${dateKey}` },
      {
        $setOnInsert: {
          member: transaction.member,
          type: 'overdue',
          title: 'Book overdue reminder',
          message: `“${transaction.book.title}” is overdue by ${days} day${days === 1 ? '' : 's'}. Please return it promptly.`,
          book: transaction.book._id,
          transaction: transaction._id,
          dedupeKey: `overdue:${transaction._id}:${dateKey}`,
        },
      },
      { upsert: true },
    );
    if (result.upsertedCount > 0) createdCount += 1;
  }

  res.json({
    success: true,
    message: `${createdCount} new overdue notification(s) generated`,
    data: { overdueTransactions: overdue.length, notificationsCreated: createdCount },
  });
});

module.exports = { listMyNotifications, markAsRead, markAllAsRead, generateOverdueNotifications };
