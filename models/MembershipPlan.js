const mongoose = require('mongoose');
const { MEMBER_TYPES } = require('../config/constants');

const membershipPlanSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, lowercase: true, trim: true },
  name: { type: String, required: true, trim: true, maxlength: 80 },
  memberType: { type: String, required: true, enum: Object.values(MEMBER_TYPES), index: true },
  maxBooks: { type: Number, required: true, min: 1, max: 50 },
  loanDays: { type: Number, required: true, min: 1, max: 180 },
  finePerDay: { type: Number, required: true, min: 0, max: 10000 },
  graceDays: { type: Number, default: 0, min: 0, max: 30 },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('MembershipPlan', membershipPlanSchema);
