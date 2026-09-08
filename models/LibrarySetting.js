const mongoose = require('mongoose');

const librarySettingSchema = new mongoose.Schema({
  key: { type: String, unique: true, default: 'default', immutable: true },
  libraryName: { type: String, default: 'University Digital Library', trim: true, maxlength: 160 },
  currency: { type: String, default: 'INR', uppercase: true, trim: true, maxlength: 3 },
  timeZone: { type: String, default: 'Asia/Kolkata', trim: true },
  holdReadyDays: { type: Number, default: 2, min: 1, max: 14 },
  allowMemberSelfBorrow: { type: Boolean, default: true },
  allowMemberSelfReturn: { type: Boolean, default: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

module.exports = mongoose.model('LibrarySetting', librarySettingSchema);
