const MembershipPlan = require('../models/MembershipPlan');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

const listPlans = asyncHandler(async (req, res) => {
  const filter = req.user?.role === 'admin' ? {} : { isActive: true };
  const plans = await MembershipPlan.find(filter).sort({ memberType: 1, name: 1 });
  res.json({ success: true, data: plans });
});

const createPlan = asyncHandler(async (req, res) => {
  const plan = await MembershipPlan.create(req.body);
  res.status(201).json({ success: true, message: 'Membership plan created', data: plan });
});

const updatePlan = asyncHandler(async (req, res) => {
  const plan = await MembershipPlan.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!plan) throw new ApiError(404, 'Membership plan not found', 'PLAN_NOT_FOUND');
  res.json({ success: true, message: 'Membership plan updated', data: plan });
});

const deletePlan = asyncHandler(async (req, res) => {
  const plan = await MembershipPlan.findById(req.params.id);
  if (!plan) throw new ApiError(404, 'Membership plan not found', 'PLAN_NOT_FOUND');
  const assigned = await User.countDocuments({ membershipPlan: plan._id, isActive: true });
  if (assigned > 0) throw new ApiError(409, 'Deactivate this plan instead; active members are assigned to it', 'PLAN_IN_USE');
  await plan.deleteOne();
  res.json({ success: true, message: 'Membership plan deleted' });
});

module.exports = { listPlans, createPlan, updatePlan, deletePlan };
