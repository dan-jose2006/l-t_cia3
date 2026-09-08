const mongoose = require('mongoose');

const bookSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 200, index: true },
  author: { type: String, required: true, trim: true, maxlength: 160, index: true },
  isbn: { type: String, required: true, unique: true, trim: true, uppercase: true },
  category: { type: String, required: true, trim: true, maxlength: 80, index: true },
  description: { type: String, trim: true, maxlength: 1500 },
  publisher: { type: String, trim: true, maxlength: 120 },
  publishedYear: { type: Number, min: 1000, max: 3000 },
  shelfLocation: { type: String, trim: true, maxlength: 40 },
  totalCopies: { type: Number, required: true, min: 0 },
  availableCopies: { type: Number, required: true, min: 0 },
  lostCopies: { type: Number, default: 0, min: 0 },
  damagedCopies: { type: Number, default: 0, min: 0 },
  coverUrl: { type: String, trim: true },
  isArchived: { type: Boolean, default: false, index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

bookSchema.index({ title: 'text', author: 'text', category: 'text' }, { weights: { title: 5, author: 3, category: 1 } });
bookSchema.index({ category: 1, availableCopies: 1, isArchived: 1 });

bookSchema.virtual('borrowedCopies').get(function borrowedCopies() {
  return Math.max(this.totalCopies - this.availableCopies - this.lostCopies - this.damagedCopies, 0);
});

bookSchema.set('toJSON', { virtuals: true });
bookSchema.set('toObject', { virtuals: true });

bookSchema.pre('validate', function validateCopyCounts(next) {
  const accounted = this.availableCopies + this.lostCopies + this.damagedCopies;
  if (accounted > this.totalCopies) {
    this.invalidate('availableCopies', 'Available, lost, and damaged copies cannot exceed total copies');
  }
  next();
});

module.exports = mongoose.model('Book', bookSchema);
