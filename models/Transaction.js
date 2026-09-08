const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  book: { type: mongoose.Schema.Types.ObjectId, ref: 'Book', required: true, index: true },
  member: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  issuedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  returnedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  issueDate: { type: Date, required: true, default: Date.now },
  dueDate: { type: Date, required: true, index: true },
  returnDate: Date,
  status: { type: String, enum: ['borrowed', 'overdue', 'returned', 'lost'], default: 'borrowed', index: true },
  conditionOnReturn: { type: String, enum: ['good', 'damaged', 'lost'], default: 'good' },
  loanDays: { type: Number, required: true, min: 1 },
  finePerDay: { type: Number, required: true, min: 0 },
  graceDays: { type: Number, default: 0, min: 0 },
  overdueDays: { type: Number, default: 0, min: 0 },
  fine: {
    assessedAmount: { type: Number, default: 0, min: 0 },
    waivedAmount: { type: Number, default: 0, min: 0 },
    paidAmount: { type: Number, default: 0, min: 0 },
    paymentStatus: { type: String, enum: ['not-applicable', 'unpaid', 'partial', 'paid', 'waived'], default: 'not-applicable' },
    waiverReason: { type: String, trim: true, maxlength: 300 },
    waivedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    waivedAt: Date,
  },
}, { timestamps: true });

transactionSchema.index(
  { member: 1, book: 1 },
  { unique: true, partialFilterExpression: { status: { $in: ['borrowed', 'overdue'] } } },
);
transactionSchema.index({ status: 1, dueDate: 1 });
transactionSchema.index({ book: 1, issueDate: -1 });

transactionSchema.virtual('fineBalance').get(function fineBalance() {
  return Math.max(this.fine.assessedAmount - this.fine.waivedAmount - this.fine.paidAmount, 0);
});

transactionSchema.set('toJSON', { virtuals: true });
transactionSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Transaction', transactionSchema);
