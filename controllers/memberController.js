const User = require('../models/User');
const Transaction = require('../models/Transaction');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { getPagination, paginationMeta } = require('../utils/pagination');
const { ROLES } = require('../config/constants');

const listMembers = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const filter = { role: ROLES.MEMBER };
  if (req.query.memberType) filter.memberType = req.query.memberType;
  if (req.query.active !== undefined) filter.isActive = req.query.active === 'true';
  if (req.query.q) {
    const safe = req.query.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(safe, 'i');
    filter.$or = [{ name: regex }, { email: regex }, { membershipId: regex }];
  }

  const [members, total] = await Promise.all([
    User.find(filter).populate('membershipPlan').sort({ createdAt: -1 }).skip(skip).limit(limit),
    User.countDocuments(filter),
  ]);
  res.json({ success: true, data: members, pagination: paginationMeta(total, page, limit) });
});

const getMember = asyncHandler(async (req, res) => {
  const member = await User.findOne({ _id: req.params.id, role: ROLES.MEMBER }).populate('membershipPlan');
  if (!member) throw new ApiError(404, 'Member not found', 'MEMBER_NOT_FOUND');
  res.json({ success: true, data: member });
});

const getBorrowingHistory = asyncHandler(async (req, res) => {
  const requestedMemberId = req.params.id;
  if (req.user.role === ROLES.MEMBER && req.user._id.toString() !== requestedMemberId) {
    throw new ApiError(403, 'Members can view only their own borrowing history', 'FORBIDDEN');
  }
  const member = await User.findOne({ _id: requestedMemberId, role: ROLES.MEMBER }).select('name email membershipId memberType membershipPlan');
  if (!member) throw new ApiError(404, 'Member not found', 'MEMBER_NOT_FOUND');

  const history = await Transaction.find({ member: requestedMemberId })
    .populate('book', 'title author isbn category coverUrl')
    .populate('issuedBy returnedTo', 'name role')
    .sort({ issueDate: -1 });

  const summary = history.reduce((acc, transaction) => {
    acc.totalBorrowed += 1;
    if (['borrowed', 'overdue'].includes(transaction.status)) acc.active += 1;
    if (transaction.status === 'overdue') acc.overdue += 1;
    acc.totalFine += transaction.fine.assessedAmount;
    acc.outstandingFine += Math.max(
      transaction.fine.assessedAmount - transaction.fine.waivedAmount - transaction.fine.paidAmount,
      0,
    );
    return acc;
  }, { totalBorrowed: 0, active: 0, overdue: 0, totalFine: 0, outstandingFine: 0 });

  summary.totalFine = Number(summary.totalFine.toFixed(2));
  summary.outstandingFine = Number(summary.outstandingFine.toFixed(2));
  res.json({ success: true, data: { member, summary, history } });
});

module.exports = { listMembers, getMember, getBorrowingHistory };
