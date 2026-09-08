const mongoose = require('mongoose');

const finePaymentSchema = new mongoose.Schema({
  transaction: { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction', required: true, index: true },
  member: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  amount: { type: Number, required: true, min: 0.01 },
  method: { type: String, enum: ['cash', 'upi', 'card', 'bank-transfer'], required: true },
  reference: { type: String, trim: true, maxlength: 120 },
  status: { type: String, enum: ['completed', 'reversed'], default: 'completed', index: true },
  paidAt: { type: Date, default: Date.now },
  recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  reversedAt: Date,
  reversedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reversalReason: { type: String, trim: true, maxlength: 300 },
}, { timestamps: true });

finePaymentSchema.index({ transaction: 1, status: 1 });

module.exports = mongoose.model('FinePayment', finePaymentSchema);
