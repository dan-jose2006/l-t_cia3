const Book = require('../models/Book');
const Transaction = require('../models/Transaction');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { getPagination, paginationMeta } = require('../utils/pagination');
const { ACTIVE_TRANSACTION_STATUSES } = require('../config/constants');

function escapeRegex(value = '') {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildBookFilter(query) {
  const filter = { isArchived: false };
  if (query.q) {
    const pattern = new RegExp(escapeRegex(query.q.trim()), 'i');
    filter.$or = [{ title: pattern }, { author: pattern }, { category: pattern }, { isbn: pattern }];
  }
  if (query.title) filter.title = new RegExp(escapeRegex(query.title.trim()), 'i');
  if (query.author) filter.author = new RegExp(escapeRegex(query.author.trim()), 'i');
  if (query.category) filter.category = new RegExp(`^${escapeRegex(query.category.trim())}$`, 'i');
  if (query.available === 'true' || query.available === true) filter.availableCopies = { $gt: 0 };
  if (query.available === 'false' || query.available === false) filter.availableCopies = 0;
  return filter;
}

const listBooks = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const filter = buildBookFilter(req.query);
  const sort = req.query.sort || 'title';
  const [books, total] = await Promise.all([
    Book.find(filter).sort(sort).skip(skip).limit(limit),
    Book.countDocuments(filter),
  ]);
  res.json({ success: true, data: books, pagination: paginationMeta(total, page, limit) });
});

const searchBooks = listBooks;

const getBook = asyncHandler(async (req, res) => {
  const book = await Book.findOne({ _id: req.params.id, isArchived: false });
  if (!book) throw new ApiError(404, 'Book not found', 'BOOK_NOT_FOUND');
  res.json({ success: true, data: book });
});

const createBook = asyncHandler(async (req, res) => {
  const data = { ...req.body };
  data.availableCopies = data.totalCopies;
  data.createdBy = req.user._id;
  const book = await Book.create(data);
  res.status(201).json({ success: true, message: 'Book added to catalog', data: book });
});

const updateBook = asyncHandler(async (req, res) => {
  const allowed = ['title', 'author', 'isbn', 'category', 'description', 'publisher', 'publishedYear', 'shelfLocation', 'coverUrl'];
  const updates = Object.fromEntries(Object.entries(req.body).filter(([key]) => allowed.includes(key)));
  updates.updatedBy = req.user._id;

  const book = await Book.findOneAndUpdate(
    { _id: req.params.id, isArchived: false },
    updates,
    { new: true, runValidators: true },
  );
  if (!book) throw new ApiError(404, 'Book not found', 'BOOK_NOT_FOUND');
  res.json({ success: true, message: 'Book details updated', data: book });
});

const archiveBook = asyncHandler(async (req, res) => {
  const book = await Book.findOne({ _id: req.params.id, isArchived: false });
  if (!book) throw new ApiError(404, 'Book not found', 'BOOK_NOT_FOUND');

  const activeLoans = await Transaction.countDocuments({ book: book._id, status: { $in: ACTIVE_TRANSACTION_STATUSES } });
  if (activeLoans > 0) throw new ApiError(409, 'Cannot archive a book while copies are borrowed', 'ACTIVE_LOANS_EXIST');

  book.isArchived = true;
  book.updatedBy = req.user._id;
  await book.save();
  res.json({ success: true, message: 'Book archived successfully' });
});

const updateInventory = asyncHandler(async (req, res) => {
  const { action, quantity } = req.body;
  const book = await Book.findOne({ _id: req.params.id, isArchived: false });
  if (!book) throw new ApiError(404, 'Book not found', 'BOOK_NOT_FOUND');

  const borrowed = book.totalCopies - book.availableCopies - book.lostCopies - book.damagedCopies;
  const requireAvailable = ['remove', 'mark-lost', 'mark-damaged'];
  if (requireAvailable.includes(action) && book.availableCopies < quantity) {
    throw new ApiError(409, 'Not enough available copies for this inventory action', 'INSUFFICIENT_AVAILABLE_COPIES');
  }
  if (action === 'repair-damaged' && book.damagedCopies < quantity) {
    throw new ApiError(409, 'Damaged copy count is too low', 'INSUFFICIENT_DAMAGED_COPIES');
  }
  if (action === 'recover-lost' && book.lostCopies < quantity) {
    throw new ApiError(409, 'Lost copy count is too low', 'INSUFFICIENT_LOST_COPIES');
  }

  switch (action) {
    case 'add':
      book.totalCopies += quantity;
      book.availableCopies += quantity;
      break;
    case 'remove':
      book.totalCopies -= quantity;
      book.availableCopies -= quantity;
      break;
    case 'mark-lost':
      book.availableCopies -= quantity;
      book.lostCopies += quantity;
      break;
    case 'mark-damaged':
      book.availableCopies -= quantity;
      book.damagedCopies += quantity;
      break;
    case 'repair-damaged':
      book.damagedCopies -= quantity;
      book.availableCopies += quantity;
      break;
    case 'recover-lost':
      book.lostCopies -= quantity;
      book.availableCopies += quantity;
      break;
    default:
      throw new ApiError(400, 'Unknown inventory action', 'INVALID_INVENTORY_ACTION');
  }

  if (book.totalCopies < borrowed + book.lostCopies + book.damagedCopies) {
    throw new ApiError(409, 'Inventory change conflicts with borrowed, lost, or damaged copies', 'INVENTORY_CONFLICT');
  }
  book.updatedBy = req.user._id;
  await book.save();
  res.json({ success: true, message: 'Inventory updated', data: book });
});

const listCategories = asyncHandler(async (req, res) => {
  const categories = await Book.distinct('category', { isArchived: false });
  res.json({ success: true, data: categories.sort((a, b) => a.localeCompare(b)) });
});

module.exports = { listBooks, searchBooks, getBook, createBook, updateBook, archiveBook, updateInventory, listCategories };
