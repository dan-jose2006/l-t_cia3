const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  member: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type: { type: String, enum: ['overdue', 'hold-ready', 'fine', 'general'], required: true, index: true },
  title: { type: String, required: true, trim: true, maxlength: 160 },
  message: { type: String, required: true, trim: true, maxlength: 1000 },
  book: { type: mongoose.Schema.Types.ObjectId, ref: 'Book' },
  transaction: { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction' },
  hold: { type: mongoose.Schema.Types.ObjectId, ref: 'Hold' },
  status: { type: String, enum: ['unread', 'read'], default: 'unread', index: true },
  dedupeKey: { type: String, unique: true, sparse: true },
  readAt: Date,
}, { timestamps: true });

notificationSchema.index({ member: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
