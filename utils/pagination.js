function getPagination(query = {}) {
  const page = Math.max(Number.parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(Number.parseInt(query.limit, 10) || 12, 1), 100);
  return { page, limit, skip: (page - 1) * limit };
}

function paginationMeta(total, page, limit) {
  return { total, page, limit, pages: Math.max(Math.ceil(total / limit), 1) };
}

module.exports = { getPagination, paginationMeta };
