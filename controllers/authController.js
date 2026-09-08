const bcrypt = require('bcryptjs');
const User = require('../models/User');
const MembershipPlan = require('../models/MembershipPlan');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { signToken } = require('../utils/token');
const { ROLES } = require('../config/constants');

function defaultPlan(memberType) {
  return memberType === 'faculty'
    ? { key: 'faculty-standard', name: 'Faculty Standard', memberType: 'faculty', maxBooks: 8, loanDays: 30, finePerDay: 2, graceDays: 2 }
    : { key: 'student-standard', name: 'Student Standard', memberType: 'student', maxBooks: 4, loanDays: 14, finePerDay: 5, graceDays: 1 };
}

async function resolvePlan(memberType) {
  let plan = await MembershipPlan.findOne({ memberType, isActive: true }).sort({ createdAt: 1 });
  if (!plan) {
    const values = defaultPlan(memberType);
    plan = await MembershipPlan.findOneAndUpdate(
      { key: values.key },
      { $setOnInsert: values },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
  }
  return plan;
}

async function generateMembershipId(memberType) {
  const prefix = memberType === 'faculty' ? 'FAC' : 'STU';
  const year = new Date().getUTCFullYear();

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const suffix = Math.floor(100000 + Math.random() * 900000);
    const candidate = `${prefix}-${year}-${suffix}`;
    if (!(await User.exists({ membershipId: candidate }))) return candidate;
  }
  throw new ApiError(503, 'Could not generate a membership ID. Please retry.', 'ID_GENERATION_FAILED');
}

const register = asyncHandler(async (req, res) => {
  const { name, email, password, memberType, phone } = req.body;
  if (await User.exists({ email })) throw new ApiError(409, 'An account with this email already exists', 'EMAIL_EXISTS');

  const plan = await resolvePlan(memberType);
  const user = await User.create({
    name,
    email,
    passwordHash: await bcrypt.hash(password, 12),
    role: ROLES.MEMBER,
    memberType,
    membershipId: await generateMembershipId(memberType),
    membershipPlan: plan._id,
    phone,
  });

  await user.populate('membershipPlan');
  res.status(201).json({
    success: true,
    message: 'Member registered successfully',
    data: { user, token: signToken(user) },
  });
});

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email }).select('+passwordHash').populate('membershipPlan');

  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    throw new ApiError(401, 'Email or password is incorrect', 'INVALID_CREDENTIALS');
  }
  if (!user.isActive) throw new ApiError(403, 'This account has been disabled', 'ACCOUNT_DISABLED');

  user.lastLoginAt = new Date();
  await user.save();
  res.json({
    success: true,
    message: 'Login successful',
    data: { user, token: signToken(user) },
  });
});

const getMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).populate('membershipPlan');
  res.json({ success: true, data: user });
});

const updateProfile = asyncHandler(async (req, res) => {
  const updates = {};
  if (req.body.name !== undefined) updates.name = req.body.name;
  if (req.body.phone !== undefined) updates.phone = req.body.phone;

  const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true, runValidators: true })
    .populate('membershipPlan');
  res.json({ success: true, message: 'Profile updated', data: user });
});

const changePassword = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('+passwordHash');
  if (!(await bcrypt.compare(req.body.currentPassword, user.passwordHash))) {
    throw new ApiError(400, 'Current password is incorrect', 'INVALID_CURRENT_PASSWORD');
  }

  user.passwordHash = await bcrypt.hash(req.body.newPassword, 12);
  await user.save();
  res.json({ success: true, message: 'Password changed successfully' });
});

module.exports = { register, login, getMe, updateProfile, changePassword, resolvePlan, generateMembershipId };
