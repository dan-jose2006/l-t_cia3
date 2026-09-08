const mongoose = require('mongoose');
const { ROLES, MEMBER_TYPES } = require('../config/constants');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: Object.values(ROLES), default: ROLES.MEMBER, index: true },
  memberType: { type: String, enum: Object.values(MEMBER_TYPES), default: MEMBER_TYPES.STUDENT },
  membershipId: { type: String, unique: true, sparse: true, uppercase: true, trim: true },
  membershipPlan: { type: mongoose.Schema.Types.ObjectId, ref: 'MembershipPlan' },
  phone: { type: String, trim: true, maxlength: 20 },
  isActive: { type: Boolean, default: true, index: true },
  lastLoginAt: Date,
}, { timestamps: true });

userSchema.methods.toJSON = function toJSON() {
  const value = this.toObject();
  delete value.passwordHash;
  return value;
};

module.exports = mongoose.model('User', userSchema);
