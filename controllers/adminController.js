const bcrypt = require('bcryptjs');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { getPagination, paginationMeta } = require('../utils/pagination');

const createStaff = asyncHandler(async (req, res) => {
  if (await User.exists({ email: req.body.email })) throw new ApiError(409, 'An account with this email already exists', 'EMAIL_EXISTS');

  const user = await User.create({
    name: req.body.name,
    email: req.body.email,
    passwordHash: await bcrypt.hash(req.body.password, 12),
    role: req.body.role || 'librarian',
    isActive: true,
  });
  res.status(201).json({ success: true, message: `${user.role} account created`, data: user });
});

const listUsers = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const filter = {};
  if (req.query.role) filter.role = req.query.role;
  if (req.query.active !== undefined) filter.isActive = req.query.active === 'true';
  if (req.query.q) {
    const safe = req.query.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(safe, 'i');
    filter.$or = [{ name: regex }, { email: regex }, { membershipId: regex }];
  }
  const [users, total] = await Promise.all([
    User.find(filter).populate('membershipPlan').sort({ createdAt: -1 }).skip(skip).limit(limit),
    User.countDocuments(filter),
  ]);
  res.json({ success: true, data: users, pagination: paginationMeta(total, page, limit) });
});

const updateUserStatus = asyncHandler(async (req, res) => {
  if (req.params.id === req.user._id.toString() && req.body.isActive === false) {
    throw new ApiError(409, 'You cannot disable your own account', 'CANNOT_DISABLE_SELF');
  }
  const user = await User.findByIdAndUpdate(req.params.id, { isActive: req.body.isActive }, { new: true });
  if (!user) throw new ApiError(404, 'User not found', 'USER_NOT_FOUND');
  res.json({ success: true, message: `Account ${user.isActive ? 'enabled' : 'disabled'}`, data: user });
});

const updateUserRole = asyncHandler(async (req, res) => {
  if (req.params.id === req.user._id.toString()) throw new ApiError(409, 'You cannot change your own role', 'CANNOT_CHANGE_SELF_ROLE');
  const user = await User.findById(req.params.id);
  if (!user) throw new ApiError(404, 'User not found', 'USER_NOT_FOUND');

  user.role = req.body.role;
  if (user.role !== 'member') {
    user.membershipPlan = undefined;
    user.membershipId = undefined;
  }
  await user.save();
  res.json({ success: true, message: 'User role updated', data: user });
});

module.exports = { createStaff, listUsers, updateUserStatus, updateUserRole };
