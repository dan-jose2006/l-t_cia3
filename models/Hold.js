const mongoose = require('mongoose');

const holdSchema = new mongoose.Schema({
  book: { type: mongoose.Schema.Types.ObjectId, ref: 'Book', required: true, index: true },
  member: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  requestedAt: { type: Date, default: Date.now, index: true },
  status: { type: String, enum: ['waiting', 'ready', 'fulfilled', 'cancelled', 'expired'], default: 'waiting', index: true },
  readyAt: Date,
  readyUntil: Date,
  fulfilledAt: Date,
  cancelledAt: Date,
}, { timestamps: true });

holdSchema.index({ book: 1, status: 1, requestedAt: 1 });
holdSchema.index({ member: 1, status: 1 });

module.exports = mongoose.model('Hold', holdSchema);
