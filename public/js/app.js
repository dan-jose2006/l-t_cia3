const state = {
  token: localStorage.getItem('libraryToken') || '',
  user: null,
  currentView: 'dashboard',
  currency: 'INR',
  books: [],
  members: [],
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const view = $('#view-container');

function esc(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function initials(name = 'User') {
  return name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
}

function formatDate(value, withTime = false) {
  if (!value) return '—';
  const options = withTime
    ? { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }
    : { day: '2-digit', month: 'short', year: 'numeric' };
  return new Intl.DateTimeFormat('en-IN', options).format(new Date(value));
}

function money(value = 0) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: state.currency, maximumFractionDigits: 2 }).format(Number(value) || 0);
}

function fineBalance(transaction) {
  if (transaction.fineBalance !== undefined) return Number(transaction.fineBalance);
  const fine = transaction.fine || {};
  return Math.max((fine.assessedAmount || 0) - (fine.waivedAmount || 0) - (fine.paidAmount || 0), 0);
}

function chip(status) {
  const danger = ['overdue', 'lost', 'unpaid', 'disabled', 'expired'];
  const success = ['available', 'returned', 'paid', 'fulfilled', 'completed', 'healthy', 'active'];
  const warn = ['borrowed', 'waiting', 'partial', 'damaged', 'attention', 'fully-borrowed'];
  const tone = danger.includes(status) ? 'danger' : success.includes(status) ? 'success' : warn.includes(status) ? 'warn' : 'info';
  return `<span class="chip ${tone}">${esc(String(status).replaceAll('-', ' '))}</span>`;
}

function toast(message, type = 'success') {
  const item = document.createElement('div');
  item.className = `toast ${type === 'error' ? 'error' : ''}`;
  item.innerHTML = `<span>${type === 'error' ? '!' : '✓'}</span><div>${esc(message)}</div><button aria-label="Dismiss">×</button>`;
  item.querySelector('button').addEventListener('click', () => item.remove());
  $('#toast-region').append(item);
  setTimeout(() => item.remove(), 4500);
}

async function api(path, options = {}) {
  const headers = { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) };
  if (state.token) headers.Authorization = `Bearer ${state.token}`;
  const response = await fetch(`/api${path}`, { ...options, headers });
  const payload = await response.json().catch(() => ({ success: false, message: 'The server returned an unreadable response' }));
  if (!response.ok) {
    if (response.status === 401 && state.token) logout(false);
    const error = new Error(payload.message || 'Request failed');
    error.details = payload.details;
    throw error;
  }
  return payload;
}

function setButtonBusy(button, busy, label = 'Working…') {
  if (!button) return;
  if (busy) {
    button.dataset.originalText = button.innerHTML;
    button.innerHTML = label;
    button.disabled = true;
  } else {
    button.innerHTML = button.dataset.originalText || button.innerHTML;
    button.disabled = false;
  }
}

function loadingCards(count = 4) {
  return `<div class="stat-grid">${Array.from({ length: count }, () => '<div class="skeleton"></div>').join('')}</div>`;
}

function emptyState(title, detail, icon = '◇') {
  return `<div class="empty-state"><span class="empty-icon">${icon}</span><strong>${esc(title)}</strong><span>${esc(detail)}</span></div>`;
}

function pageHead(title, detail, actions = '') {
  return `<div class="page-head"><div><h2>${esc(title)}</h2><p>${esc(detail)}</p></div><div class="action-row">${actions}</div></div>`;
}

function tableRowBook(transaction) {
  const book = transaction.book || {};
  return `<td><strong>${esc(book.title || 'Removed book')}</strong><small>${esc(book.author || book.isbn || '')}</small></td>`;
}

function showAuth() {
  $('#auth-screen').classList.remove('hidden');
  $('#app-shell').classList.add('hidden');
}

function applyRoleVisibility() {
  const isMember = state.user.role === 'member';
  const isStaff = ['librarian', 'admin'].includes(state.user.role);
  $$('.member-only').forEach((item) => item.classList.toggle('role-hidden', !isMember));
  $$('.staff-only').forEach((item) => item.classList.toggle('role-hidden', !isStaff));
  $$('.admin-only').forEach((item) => item.classList.toggle('role-hidden', state.user.role !== 'admin'));
}

async function enterApp() {
  $('#auth-screen').classList.add('hidden');
  $('#app-shell').classList.remove('hidden');
  applyRoleVisibility();
  $('#topbar-avatar').textContent = initials(state.user.name);
  $('#sidebar-user').innerHTML = `<div class="avatar">${esc(initials(state.user.name))}</div><strong>${esc(state.user.name)}</strong><small>${esc(state.user.role)}${state.user.membershipId ? ` · ${esc(state.user.membershipId)}` : ''}</small>`;
  try {
    const settings = await api('/settings');
    state.currency = settings.data.currency || 'INR';
  } catch (_) { /* the interface can still work with INR */ }
  if (state.user.role === 'member') loadNotifications();
  navigate('dashboard');
}

function logout(showMessage = true) {
  state.token = '';
  state.user = null;
  localStorage.removeItem('libraryToken');
  showAuth();
  closeDrawer();
  if (showMessage) toast('Signed out successfully');
}

async function boot() {
  if (!state.token) return showAuth();
  try {
    const result = await api('/auth/me');
    state.user = result.data;
    await enterApp();
  } catch (_) {
    logout(false);
  }
}

const viewTitles = {
  dashboard: ['Workspace', 'Overview'],
  catalog: ['Collection', 'Book catalog'],
  circulation: ['Operations', 'Circulation'],
  holds: ['Reservations', 'Hold queue'],
  members: ['Directory', 'Members'],
  reports: ['Insights', 'Reports'],
  admin: ['System', 'Administration'],
};

async function navigate(name) {
  state.currentView = name;
  const [kicker, title] = viewTitles[name] || viewTitles.dashboard;
  $('#topbar-kicker').textContent = kicker;
  $('#page-title').textContent = title;
  $$('.nav-item').forEach((item) => item.classList.toggle('active', item.dataset.view === name));
  $('#sidebar').classList.remove('open');
  view.innerHTML = loadingCards();
  view.focus();

  try {
    const loaders = {
      dashboard: renderDashboard,
      catalog: renderCatalog,
      circulation: renderCirculation,
      holds: renderHolds,
      members: renderMembers,
      reports: renderReports,
      admin: renderAdmin,
    };
    await (loaders[name] || loaders.dashboard)();
  } catch (error) {
    view.innerHTML = emptyState('Could not load this view', error.message, '!');
    toast(error.message, 'error');
  }
}

async function renderDashboard() {
  if (state.user.role === 'member') return renderMemberDashboard();
  const [summaryResult, transactionResult] = await Promise.all([
    api('/reports/dashboard'),
    api('/transactions?limit=6'),
  ]);
  const s = summaryResult.data;
  const rows = transactionResult.data.map((item) => `
    <tr>${tableRowBook(item)}<td><strong>${esc(item.member?.name || 'Unknown')}</strong><small>${esc(item.member?.membershipId || '')}</small></td><td>${formatDate(item.dueDate)}</td><td>${chip(item.status)}</td></tr>
  `).join('');

  view.innerHTML = `
    ${pageHead(`Good ${new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}, ${state.user.name.split(' ')[0]}`, 'Here is today’s circulation and inventory pulse.', '<button class="button primary" data-action="open-issue">+ Issue book</button>')}
    <div class="stat-grid">
      ${statCard('Catalog titles', s.titles, `${s.copies.total} physical copies`, '#6576e8')}
      ${statCard('Active loans', s.activeLoans, `${s.overdue} currently overdue`, '#53d9b7')}
      ${statCard('Available copies', s.copies.available, `${s.copies.damaged + s.copies.lost} need attention`, '#e3a64e')}
      ${statCard('Fine balance', money(s.fines.outstanding), `${money(s.fines.paid)} collected`, '#cf4964')}
    </div>
    <div class="content-grid">
      <section class="panel"><div class="panel-head"><div><h3>Recent circulation</h3><p>Latest issue and return activity</p></div><button class="text-button" data-view-link="circulation">View all</button></div>
        ${rows ? `<div class="table-wrap"><table><thead><tr><th>Book</th><th>Member</th><th>Due</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table></div>` : emptyState('No circulation yet', 'Issue the first book to begin tracking activity.')}
      </section>
      <section class="panel"><div class="panel-head"><div><h3>Quick actions</h3><p>Common desk operations</p></div></div>
        <div class="quick-grid">
          ${quickAction('＋', 'Add a title', 'Create a catalog record', 'open-book')}
          ${quickAction('⇄', 'Issue book', 'Start a new loan', 'open-issue')}
          ${quickAction('⌁', 'Overdue alerts', 'Generate reminders', 'generate-overdue')}
          ${quickAction('▥', 'View reports', 'Inspect library health', '', 'reports')}
        </div>
      </section>
    </div>`;
}

async function renderMemberDashboard() {
  const [transactionsResult, holdsResult, notificationsResult] = await Promise.all([
    api('/transactions/my?limit=100'), api('/holds/my'), api('/notifications/my'),
  ]);
  const transactions = transactionsResult.data;
  const active = transactions.filter((item) => ['borrowed', 'overdue'].includes(item.status));
  const overdue = active.filter((item) => new Date(item.dueDate) < new Date());
  const fine = transactions.reduce((sum, item) => sum + fineBalance(item), 0);
  const holds = holdsResult.data.filter((item) => ['waiting', 'ready'].includes(item.status));
  const rows = active.slice(0, 5).map((item) => `<tr>${tableRowBook(item)}<td>${formatDate(item.issueDate)}</td><td>${formatDate(item.dueDate)}</td><td>${chip(item.status)}</td><td><button class="button small ghost" data-action="return" data-id="${item._id}">Return</button></td></tr>`).join('');

  view.innerHTML = `
    ${pageHead(`Hello, ${state.user.name.split(' ')[0]}`, `Membership ${state.user.membershipId || ''} · ${state.user.membershipPlan?.name || state.user.memberType}`, '<button class="button primary" data-view-link="catalog">Browse catalog</button>')}
    <div class="stat-grid">
      ${statCard('Books with you', active.length, `${overdue.length} overdue`, '#6576e8')}
      ${statCard('Active holds', holds.length, `${holds.filter((item) => item.status === 'ready').length} ready`, '#53d9b7')}
      ${statCard('Fine balance', money(fine), fine ? 'Payment at circulation desk' : 'Nothing outstanding', '#cf4964')}
      ${statCard('Unread updates', notificationsResult.data.filter((item) => item.status === 'unread').length, 'Hold and overdue alerts', '#e3a64e')}
    </div>
    <div class="content-grid">
      <section class="panel"><div class="panel-head"><div><h3>Currently borrowed</h3><p>Your active loans and due dates</p></div><button class="text-button" data-view-link="circulation">Full history</button></div>
        ${rows ? `<div class="table-wrap"><table><thead><tr><th>Book</th><th>Issued</th><th>Due</th><th>Status</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>` : emptyState('Your shelf is clear', 'Browse the catalog when you are ready for your next book.', '▤')}
      </section>
      <section class="panel"><div class="panel-head"><div><h3>Membership plan</h3><p>Current borrowing rules</p></div></div>
        <div class="progress-list">
          ${progressItem('Borrowing limit', active.length, state.user.membershipPlan?.maxBooks || 4, `${active.length}/${state.user.membershipPlan?.maxBooks || 4}`)}
          <div class="context-box"><strong>${esc(state.user.membershipPlan?.loanDays || 14)}-day loan period</strong><br>${money(state.user.membershipPlan?.finePerDay || 5)} per overdue day after ${state.user.membershipPlan?.graceDays || 0} grace day(s).</div>
        </div>
      </section>
    </div>`;
}

function statCard(label, value, note, color) {
  return `<article class="stat-card" style="--accent:${color}"><span class="stat-label">${esc(label)}</span><strong class="stat-value">${esc(value)}</strong><span class="stat-note">${esc(note)}</span></article>`;
}

function quickAction(icon, title, detail, action = '', target = '') {
  const attrs = action ? `data-action="${action}"` : `data-view-link="${target}"`;
  return `<button class="quick-action" ${attrs}><span class="quick-icon">${icon}</span><strong>${esc(title)}</strong><small>${esc(detail)}</small></button>`;
}

function progressItem(label, value, max, shown = value) {
  const width = Math.min(Math.max((Number(value) / Math.max(Number(max), 1)) * 100, 0), 100);
  return `<div class="progress-item"><span>${esc(label)}</span><div class="progress-track"><div class="progress-fill" style="--width:${width}%"></div></div><strong>${esc(shown)}</strong></div>`;
}

async function renderCatalog() {
  const categoriesResult = await api('/books/categories');
  view.innerHTML = `
    ${pageHead('Explore the collection', 'Search by title, author, ISBN, or category.', state.user.role !== 'member' ? '<button class="button primary" data-action="open-book">+ Add book</button>' : '')}
    <div class="toolbar">
      <input id="catalog-search" type="search" placeholder="Search title, author, or ISBN…" aria-label="Search catalog">
      <select id="catalog-category" aria-label="Filter category"><option value="">All categories</option>${categoriesResult.data.map((item) => `<option>${esc(item)}</option>`).join('')}</select>
      <select id="catalog-availability" aria-label="Filter availability"><option value="">Any status</option><option value="true">Available</option><option value="false">Unavailable</option></select>
      <select id="catalog-sort" aria-label="Sort catalog"><option value="title">Title A–Z</option><option value="-createdAt">Newest</option><option value="-availableCopies">Most available</option></select>
    </div>
    <div id="catalog-results" class="book-grid">${Array.from({ length: 6 }, () => '<div class="skeleton"></div>').join('')}</div>`;

  let timer;
  $('#catalog-search').addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(loadCatalogResults, 250); });
  $('#catalog-category').addEventListener('change', loadCatalogResults);
  $('#catalog-availability').addEventListener('change', loadCatalogResults);
  $('#catalog-sort').addEventListener('change', loadCatalogResults);
  await loadCatalogResults();
}

async function loadCatalogResults() {
  const target = $('#catalog-results');
  if (!target) return;
  const params = new URLSearchParams({ limit: '100', sort: $('#catalog-sort')?.value || 'title' });
  const q = $('#catalog-search')?.value.trim();
  const category = $('#catalog-category')?.value;
  const available = $('#catalog-availability')?.value;
  if (q) params.set('q', q);
  if (category) params.set('category', category);
  if (available) params.set('available', available);
  const result = await api(`/books?${params}`);
  state.books = result.data;
  target.innerHTML = state.books.length
    ? state.books.map(bookCard).join('')
    : emptyState('No books match', 'Try clearing a filter or searching with fewer words.', '⌕');
}

function bookCard(book) {
  const available = book.availableCopies > 0;
  const colors = ['#243c5a', '#4a365f', '#205249', '#6d3d3e', '#344261'];
  const color = colors[[...book.title].reduce((sum, char) => sum + char.charCodeAt(0), 0) % colors.length];
  const cover = book.coverUrl
    ? `<img src="${esc(book.coverUrl)}" alt="" loading="lazy" onerror="this.remove();this.parentElement.textContent='${esc(initials(book.title))}'">`
    : esc(initials(book.title));
  let actions;
  if (state.user.role === 'member') {
    actions = available
      ? `<button class="button small primary" data-action="borrow" data-id="${book._id}">Borrow</button>`
      : `<button class="button small ghost" data-action="hold" data-id="${book._id}">Place hold</button>`;
  } else {
    actions = `<button class="button small ghost" data-action="edit-book" data-id="${book._id}">Edit</button><button class="button small ghost" data-action="inventory" data-id="${book._id}">Inventory</button><button class="button small danger" data-action="archive-book" data-id="${book._id}">Archive</button>`;
  }
  return `<article class="book-card"><div class="book-cover" style="--book-color:${color}">${cover}</div><div class="book-info"><div class="book-meta">${chip(available ? 'available' : 'unavailable')}<span class="chip">${esc(book.category)}</span></div><h3>${esc(book.title)}</h3><p class="book-author">${esc(book.author)}</p><div class="book-meta"><span class="chip">${book.availableCopies}/${book.totalCopies} copies</span>${book.shelfLocation ? `<span class="chip">Shelf ${esc(book.shelfLocation)}</span>` : ''}</div><div class="card-actions">${actions}</div></div></article>`;
}

async function renderCirculation() {
  if (state.user.role === 'member') {
    const result = await api('/transactions/my?limit=100');
    const rows = result.data.map((item) => transactionRow(item, false)).join('');
    view.innerHTML = `${pageHead('My borrowing history', 'Every loan, return, and fine in one timeline.', '<button class="button primary" data-view-link="catalog">Browse catalog</button>')}${rows ? transactionTable(rows, false) : emptyState('No borrowing history', 'Your completed and active loans will appear here.')}`;
    return;
  }
  const result = await api('/transactions?limit=100');
  const rows = result.data.map((item) => transactionRow(item, true)).join('');
  view.innerHTML = `${pageHead('Circulation desk', 'Issue books, process returns, and settle fines.', '<button class="button ghost" data-action="generate-overdue">Generate reminders</button><button class="button primary" data-action="open-issue">+ Issue book</button>')}<div class="toolbar" style="grid-template-columns:minmax(15rem,1fr) 12rem auto"><input id="transaction-search" type="search" placeholder="Filter by member or book…"><select id="transaction-status"><option value="">All statuses</option><option value="borrowed">Borrowed</option><option value="overdue">Overdue</option><option value="returned">Returned</option><option value="lost">Lost</option></select><button class="button ghost" data-action="refresh-circulation">Refresh</button></div><div id="transaction-table">${rows ? transactionTable(rows, true) : emptyState('No transactions', 'Issue the first book to begin circulation.')}</div>`;
  const filter = () => {
    const q = $('#transaction-search').value.toLowerCase();
    const status = $('#transaction-status').value;
    const filtered = result.data.filter((item) => {
      const text = `${item.book?.title || ''} ${item.member?.name || ''} ${item.member?.membershipId || ''}`.toLowerCase();
      return (!q || text.includes(q)) && (!status || item.status === status);
    });
    $('#transaction-table').innerHTML = filtered.length ? transactionTable(filtered.map((item) => transactionRow(item, true)).join(''), true) : emptyState('No matching transactions', 'Adjust the search or status filter.');
  };
  $('#transaction-search').addEventListener('input', filter);
  $('#transaction-status').addEventListener('change', filter);
}

function transactionTable(rows, staff) {
  return `<div class="table-wrap"><table><thead><tr><th>Book</th>${staff ? '<th>Member</th>' : ''}<th>Issued</th><th>Due / Returned</th><th>Fine</th><th>Status</th><th>Actions</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function transactionRow(item, staff) {
  const active = ['borrowed', 'overdue'].includes(item.status);
  const balance = fineBalance(item);
  let actions = active ? `<button class="button small primary" data-action="return" data-id="${item._id}">Return</button>` : '';
  if (staff && balance > 0) actions += `<button class="button small ghost" data-action="payment" data-id="${item._id}" data-balance="${balance}">Pay</button><button class="button small ghost" data-action="waive" data-id="${item._id}" data-balance="${balance}">Waive</button>`;
  return `<tr>${tableRowBook(item)}${staff ? `<td><strong>${esc(item.member?.name || 'Unknown')}</strong><small>${esc(item.member?.membershipId || '')}</small></td>` : ''}<td>${formatDate(item.issueDate)}</td><td>${formatDate(item.returnDate || item.dueDate)}<br><small>${item.returnDate ? 'Returned' : 'Due'}</small></td><td>${balance ? `<strong>${money(balance)}</strong><small>${esc(item.fine?.paymentStatus || 'unpaid')}</small>` : '—'}</td><td>${chip(item.status)}</td><td><div class="table-actions">${actions || '—'}</div></td></tr>`;
}

async function renderHolds() {
  const member = state.user.role === 'member';
  const result = await api(member ? '/holds/my' : '/holds');
  const rows = result.data.map((item) => {
    const active = ['waiting', 'ready'].includes(item.status);
    return `<tr><td><strong>${esc(item.book?.title || 'Removed book')}</strong><small>${esc(item.book?.author || '')}</small></td>${member ? '' : `<td><strong>${esc(item.member?.name || '')}</strong><small>${esc(item.member?.membershipId || '')}</small></td>`}<td>${formatDate(item.requestedAt)}</td><td>${item.readyUntil ? formatDate(item.readyUntil) : '—'}</td><td>${chip(item.status)}</td><td><div class="table-actions">${active ? `<button class="button small danger" data-action="cancel-hold" data-id="${item._id}">Cancel</button>` : ''}${!member && item.status === 'waiting' ? `<button class="button small ghost" data-action="ready-hold" data-id="${item._id}">Mark ready</button>` : ''}</div></td></tr>`;
  }).join('');
  const actions = member ? '<button class="button primary" data-view-link="catalog">Find a book</button>' : '<button class="button ghost" data-action="expire-holds">Expire elapsed holds</button>';
  view.innerHTML = `${pageHead(member ? 'My reservations' : 'Reservation queue', member ? 'Track books you are waiting for.' : 'Manage waiting, ready, and fulfilled holds.', actions)}${rows ? `<div class="table-wrap"><table><thead><tr><th>Book</th>${member ? '' : '<th>Member</th>'}<th>Requested</th><th>Ready until</th><th>Status</th><th>Actions</th></tr></thead><tbody>${rows}</tbody></table></div>` : emptyState('No holds found', member ? 'Unavailable books you reserve will appear here.' : 'The reservation queue is currently empty.')}`;
}

async function renderMembers() {
  const result = await api('/members?limit=100');
  state.members = result.data;
  const rows = state.members.map((member) => `<tr><td><strong>${esc(member.name)}</strong><small>${esc(member.email)}</small></td><td>${esc(member.membershipId || '—')}</td><td>${chip(member.memberType)}</td><td>${esc(member.membershipPlan?.name || '—')}</td><td>${chip(member.isActive ? 'active' : 'disabled')}</td><td><button class="button small ghost" data-action="member-history" data-id="${member._id}">History</button></td></tr>`).join('');
  view.innerHTML = `${pageHead('Member directory', 'Search accounts and open complete borrowing histories.')}<div class="toolbar" style="grid-template-columns:minmax(15rem,1fr) 12rem"><input id="member-search" type="search" placeholder="Search name, email, or membership ID…"><select id="member-type"><option value="">All member types</option><option value="student">Students</option><option value="faculty">Faculty</option></select></div><div id="member-results">${rows ? memberTable(rows) : emptyState('No members yet', 'Registered members will appear here.')}</div>`;
  const filter = () => {
    const q = $('#member-search').value.toLowerCase();
    const type = $('#member-type').value;
    const filtered = state.members.filter((item) => (!q || `${item.name} ${item.email} ${item.membershipId}`.toLowerCase().includes(q)) && (!type || item.memberType === type));
    $('#member-results').innerHTML = filtered.length ? memberTable(filtered.map((member) => `<tr><td><strong>${esc(member.name)}</strong><small>${esc(member.email)}</small></td><td>${esc(member.membershipId || '—')}</td><td>${chip(member.memberType)}</td><td>${esc(member.membershipPlan?.name || '—')}</td><td>${chip(member.isActive ? 'active' : 'disabled')}</td><td><button class="button small ghost" data-action="member-history" data-id="${member._id}">History</button></td></tr>`).join('')) : emptyState('No matching members', 'Try a different search term.');
  };
  $('#member-search').addEventListener('input', filter);
  $('#member-type').addEventListener('change', filter);
}

function memberTable(rows) {
  return `<div class="table-wrap"><table><thead><tr><th>Member</th><th>Membership ID</th><th>Type</th><th>Plan</th><th>Status</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

async function showMemberHistory(id) {
  const result = await api(`/members/${id}/history`);
  const { member, summary, history } = result.data;
  view.innerHTML = `${pageHead(member.name, `${member.membershipId} · ${member.email}`, '<button class="button ghost" data-view-link="members">← Back to members</button>')}<div class="stat-grid">${statCard('Total loans', summary.totalBorrowed, `${summary.active} active`, '#6576e8')}${statCard('Overdue now', summary.overdue, 'Active overdue loans', '#cf4964')}${statCard('Total fines', money(summary.totalFine), 'All assessed fines', '#e3a64e')}${statCard('Outstanding', money(summary.outstandingFine), 'Amount still due', '#53d9b7')}</div>${history.length ? transactionTable(history.map((item) => transactionRow(item, false)).join(''), false) : emptyState('No borrowing history', 'This member has not borrowed any books.')}`;
}

async function renderReports() {
  const [dashboardResult, borrowedResult, overdueResult, inventoryResult] = await Promise.all([
    api('/reports/dashboard'), api('/reports/most-borrowed?limit=8'), api('/reports/overdue'), api('/reports/inventory-health'),
  ]);
  const d = dashboardResult.data;
  const maxBorrow = Math.max(...borrowedResult.data.map((item) => item.borrowCount), 1);
  const borrowed = borrowedResult.data.map((item) => progressItem(item.title, item.borrowCount, maxBorrow, item.borrowCount)).join('');
  const overdueRows = overdueResult.data.slice(0, 10).map((item) => `<tr>${tableRowBook(item)}<td><strong>${esc(item.member?.name || '')}</strong><small>${esc(item.member?.membershipId || '')}</small></td><td>${formatDate(item.dueDate)}</td><td>${chip('overdue')}</td></tr>`).join('');
  const attention = inventoryResult.data.filter((item) => item.health !== 'healthy');
  const inventoryRows = attention.slice(0, 10).map((item) => `<tr><td><strong>${esc(item.title)}</strong><small>${esc(item.isbn)}</small></td><td>${item.availableCopies}/${item.totalCopies}</td><td>${item.damagedCopies}</td><td>${item.lostCopies}</td><td>${chip(item.health)}</td></tr>`).join('');
  view.innerHTML = `${pageHead('Library intelligence', 'Circulation demand, overdue risk, and inventory health.', '<button class="button ghost" data-action="generate-overdue">Refresh overdue records</button>')}<div class="stat-grid">${statCard('Members', d.members, 'Active accounts', '#6576e8')}${statCard('Active loans', d.activeLoans, `${d.overdue} overdue`, '#53d9b7')}${statCard('Active holds', d.activeHolds, 'Waiting or ready', '#e3a64e')}${statCard('Outstanding fines', money(d.fines.outstanding), `${money(d.fines.paid)} paid`, '#cf4964')}</div><div class="report-grid"><section class="panel"><div class="panel-head"><div><h3>Most borrowed titles</h3><p>All-time circulation count</p></div></div><div class="progress-list">${borrowed || emptyState('No loan data', 'Popular titles will appear after circulation begins.')}</div></section><section class="panel"><div class="panel-head"><div><h3>Inventory snapshot</h3><p>${d.copies.available} of ${d.copies.total} copies available</p></div></div><div class="progress-list">${progressItem('Available', d.copies.available, d.copies.total, d.copies.available)}${progressItem('On loan', d.activeLoans, d.copies.total, d.activeLoans)}${progressItem('Damaged', d.copies.damaged, d.copies.total, d.copies.damaged)}${progressItem('Lost', d.copies.lost, d.copies.total, d.copies.lost)}</div></section></div><section class="panel" style="margin-bottom:1rem"><div class="panel-head"><div><h3>Overdue summary</h3><p>Members requiring follow-up</p></div></div>${overdueRows ? `<div class="table-wrap"><table><thead><tr><th>Book</th><th>Member</th><th>Due date</th><th>Status</th></tr></thead><tbody>${overdueRows}</tbody></table></div>` : emptyState('No overdue books', 'Everything is currently within its return window.')}</section><section class="panel"><div class="panel-head"><div><h3>Inventory needing attention</h3><p>Unavailable, damaged, or lost stock</p></div></div>${inventoryRows ? `<div class="table-wrap"><table><thead><tr><th>Book</th><th>Available</th><th>Damaged</th><th>Lost</th><th>Health</th></tr></thead><tbody>${inventoryRows}</tbody></table></div>` : emptyState('Inventory is healthy', 'No titles currently need attention.')}</section>`;
}

async function renderAdmin() {
  const [usersResult, plansResult, settingsResult] = await Promise.all([
    api('/admin/users?limit=100'), api('/membership-plans'), api('/settings'),
  ]);
  const users = usersResult.data;
  const plans = plansResult.data;
  const settings = settingsResult.data;
  const userRows = users.map((user) => `<tr><td><strong>${esc(user.name)}</strong><small>${esc(user.email)}</small></td><td>${chip(user.role)}</td><td>${chip(user.isActive ? 'active' : 'disabled')}</td><td><button class="button small ghost" data-action="toggle-user" data-id="${user._id}" data-active="${user.isActive}">${user.isActive ? 'Disable' : 'Enable'}</button></td></tr>`).join('');
  const planRows = plans.map((plan) => `<tr><td><strong>${esc(plan.name)}</strong><small>${esc(plan.key)}</small></td><td>${chip(plan.memberType)}</td><td>${plan.maxBooks}</td><td>${plan.loanDays} days</td><td>${money(plan.finePerDay)}/day</td><td>${chip(plan.isActive ? 'active' : 'disabled')}</td></tr>`).join('');
  view.innerHTML = `${pageHead('System administration', 'Manage staff, plans, access, and library-wide rules.')}<div class="admin-grid"><div style="display:grid;gap:1rem"><form id="staff-form" class="form-card"><h3>Create staff account</h3><label>Name<input name="name" required></label><label>Email<input name="email" type="email" required></label><label>Temporary password<input name="password" type="password" minlength="8" required></label><label>Role<select name="role"><option value="librarian">Librarian</option><option value="admin">Administrator</option></select></label><button class="button primary" type="submit">Create account</button></form><form id="settings-form" class="form-card"><h3>Library settings</h3><label>Library name<input name="libraryName" value="${esc(settings.libraryName)}" required></label><div class="form-row"><label>Currency<input name="currency" value="${esc(settings.currency)}" maxlength="3" required></label><label>Hold window (days)<input name="holdReadyDays" type="number" min="1" max="14" value="${settings.holdReadyDays}" required></label></div><label><span><input name="allowMemberSelfBorrow" type="checkbox" style="width:auto;min-height:auto" ${settings.allowMemberSelfBorrow ? 'checked' : ''}> Allow member self-borrowing</span></label><label><span><input name="allowMemberSelfReturn" type="checkbox" style="width:auto;min-height:auto" ${settings.allowMemberSelfReturn ? 'checked' : ''}> Allow member self-returns</span></label><button class="button secondary" type="submit">Save settings</button></form></div><div style="display:grid;gap:1rem"><section class="panel"><div class="panel-head"><div><h3>User access</h3><p>${users.length} total accounts</p></div></div><div class="table-wrap"><table><thead><tr><th>User</th><th>Role</th><th>Status</th><th></th></tr></thead><tbody>${userRows}</tbody></table></div></section><section class="panel"><div class="panel-head"><div><h3>Membership plans</h3><p>Limits captured when each loan is issued</p></div></div><div class="table-wrap"><table><thead><tr><th>Plan</th><th>Type</th><th>Limit</th><th>Loan</th><th>Fine</th><th>Status</th></tr></thead><tbody>${planRows}</tbody></table></div></section><form id="plan-form" class="form-card"><h3>Add membership plan</h3><div class="form-row"><label>Key<input name="key" placeholder="student-premium" required pattern="[a-z0-9-]+"></label><label>Name<input name="name" placeholder="Student Premium" required></label></div><div class="form-row"><label>Member type<select name="memberType"><option value="student">Student</option><option value="faculty">Faculty</option></select></label><label>Maximum books<input name="maxBooks" type="number" min="1" max="50" value="4" required></label></div><div class="form-row"><label>Loan days<input name="loanDays" type="number" min="1" max="180" value="14" required></label><label>Fine per day<input name="finePerDay" type="number" min="0" step="0.01" value="5" required></label></div><label>Grace days<input name="graceDays" type="number" min="0" max="30" value="1"></label><button class="button primary" type="submit">Add plan</button></form></div></div>`;
  $('#staff-form').addEventListener('submit', submitStaff);
  $('#settings-form').addEventListener('submit', submitSettings);
  $('#plan-form').addEventListener('submit', submitPlan);
}

async function submitStaff(event) {
  event.preventDefault();
  const button = event.submitter;
  setButtonBusy(button, true);
  try {
    const body = Object.fromEntries(new FormData(event.currentTarget));
    const result = await api('/admin/users/staff', { method: 'POST', body: JSON.stringify(body) });
    toast(result.message);
    navigate('admin');
  } catch (error) { toast(error.message, 'error'); } finally { setButtonBusy(button, false); }
}

async function submitSettings(event) {
  event.preventDefault();
  const button = event.submitter;
  setButtonBusy(button, true);
  const form = event.currentTarget;
  const data = Object.fromEntries(new FormData(form));
  data.holdReadyDays = Number(data.holdReadyDays);
  data.allowMemberSelfBorrow = form.allowMemberSelfBorrow.checked;
  data.allowMemberSelfReturn = form.allowMemberSelfReturn.checked;
  try {
    const result = await api('/settings', { method: 'PUT', body: JSON.stringify(data) });
    state.currency = result.data.currency;
    toast(result.message);
  } catch (error) { toast(error.message, 'error'); } finally { setButtonBusy(button, false); }
}

async function submitPlan(event) {
  event.preventDefault();
  const button = event.submitter;
  setButtonBusy(button, true);
  const body = Object.fromEntries(new FormData(event.currentTarget));
  ['maxBooks', 'loanDays', 'finePerDay', 'graceDays'].forEach((key) => { body[key] = Number(body[key]); });
  try {
    const result = await api('/membership-plans', { method: 'POST', body: JSON.stringify(body) });
    toast(result.message);
    navigate('admin');
  } catch (error) { toast(error.message, 'error'); } finally { setButtonBusy(button, false); }
}

async function openIssueDialog(preselectedBook = '') {
  try {
    const [membersResult, booksResult] = await Promise.all([api('/members?limit=100&active=true'), api('/books?limit=100&available=true')]);
    state.members = membersResult.data;
    state.books = booksResult.data;
    $('#issue-member').innerHTML = '<option value="">Select member</option>' + state.members.map((item) => `<option value="${item._id}">${esc(item.name)} — ${esc(item.membershipId)}</option>`).join('');
    $('#issue-book').innerHTML = '<option value="">Select available book</option>' + state.books.map((item) => `<option value="${item._id}" ${item._id === preselectedBook ? 'selected' : ''}>${esc(item.title)} — ${item.availableCopies} available</option>`).join('');
    $('#issue-dialog').showModal();
  } catch (error) { toast(error.message, 'error'); }
}

async function submitIssue(event) {
  event.preventDefault();
  if (event.submitter?.value === 'cancel') return $('#issue-dialog').close();
  const button = event.submitter;
  setButtonBusy(button, true);
  const body = Object.fromEntries(new FormData(event.currentTarget));
  if (!body.dueDate) delete body.dueDate;
  try {
    const result = await api('/transactions/issue', { method: 'POST', body: JSON.stringify(body) });
    $('#issue-dialog').close();
    event.currentTarget.reset();
    toast(result.message);
    navigate(state.currentView === 'dashboard' ? 'dashboard' : 'circulation');
  } catch (error) { toast(error.message, 'error'); } finally { setButtonBusy(button, false); }
}

function openBookDialog(book = null) {
  const form = $('#book-form');
  form.reset();
  form.bookId.value = book?._id || '';
  $('#book-dialog-title').textContent = book ? 'Edit book details' : 'Add a book';
  const totalCopies = form.totalCopies;
  totalCopies.disabled = Boolean(book);
  if (book) {
    ['title', 'author', 'isbn', 'category', 'totalCopies', 'description', 'publisher', 'publishedYear', 'shelfLocation', 'coverUrl'].forEach((key) => {
      if (form.elements[key]) form.elements[key].value = book[key] ?? '';
    });
  }
  $('#book-dialog').showModal();
}

async function submitBook(event) {
  event.preventDefault();
  if (event.submitter?.value === 'cancel') return $('#book-dialog').close();
  const button = event.submitter;
  setButtonBusy(button, true);
  const form = event.currentTarget;
  const body = Object.fromEntries(new FormData(form));
  const id = body.bookId;
  delete body.bookId;
  if (!id) body.totalCopies = Number(body.totalCopies);
  if (body.publishedYear) body.publishedYear = Number(body.publishedYear); else delete body.publishedYear;
  Object.keys(body).forEach((key) => { if (body[key] === '') delete body[key]; });
  try {
    const result = await api(id ? `/books/${id}` : '/books', { method: id ? 'PUT' : 'POST', body: JSON.stringify(body) });
    $('#book-dialog').close();
    toast(result.message);
    navigate(state.currentView === 'dashboard' ? 'dashboard' : 'catalog');
  } catch (error) { toast(error.message, 'error'); } finally { setButtonBusy(button, false); }
}

async function returnTransaction(id) {
  const condition = state.user.role === 'member' ? 'good' : (prompt('Return condition: good, damaged, or lost', 'good') || '').toLowerCase();
  if (!['good', 'damaged', 'lost'].includes(condition)) return toast('Return condition must be good, damaged, or lost', 'error');
  if (!confirm(`Process this return as “${condition}”?`)) return;
  try {
    const result = await api(`/transactions/${id}/return`, { method: 'PUT', body: JSON.stringify({ condition }) });
    toast(result.message);
    navigate(state.currentView);
  } catch (error) { toast(error.message, 'error'); }
}

function openPaymentDialog(id, balance) {
  const form = $('#payment-form');
  form.reset();
  form.transactionId.value = id;
  form.amount.value = Number(balance).toFixed(2);
  form.amount.max = Number(balance).toFixed(2);
  $('#payment-context').textContent = `Outstanding balance: ${money(balance)}`;
  $('#payment-dialog').showModal();
}

async function submitPayment(event) {
  event.preventDefault();
  if (event.submitter?.value === 'cancel') return $('#payment-dialog').close();
  const button = event.submitter;
  setButtonBusy(button, true);
  const body = Object.fromEntries(new FormData(event.currentTarget));
  body.amount = Number(body.amount);
  try {
    const result = await api('/fine-payments', { method: 'POST', body: JSON.stringify(body) });
    $('#payment-dialog').close();
    toast(result.message);
    navigate('circulation');
  } catch (error) { toast(error.message, 'error'); } finally { setButtonBusy(button, false); }
}

async function loadNotifications(open = false) {
  if (state.user?.role !== 'member') return;
  try {
    const result = await api('/notifications/my');
    const unread = result.data.filter((item) => item.status === 'unread').length;
    $('#notification-badge').textContent = unread;
    $('#notification-badge').classList.toggle('hidden', unread === 0);
    $('#notification-list').innerHTML = result.data.length ? result.data.map((item) => `<article class="notification-item ${item.status}" data-notification-id="${item._id}"><span class="notification-dot"></span><div><h3>${esc(item.title)}</h3><p>${esc(item.message)}</p><time>${formatDate(item.createdAt, true)}</time></div></article>`).join('') : emptyState('No notifications', 'Hold and overdue updates will show here.');
    if (open) openDrawer();
  } catch (error) { if (open) toast(error.message, 'error'); }
}

function openDrawer() {
  $('#notification-drawer').classList.add('open');
  $('#notification-drawer').setAttribute('aria-hidden', 'false');
  $('#drawer-backdrop').classList.remove('hidden');
}

function closeDrawer() {
  $('#notification-drawer').classList.remove('open');
  $('#notification-drawer').setAttribute('aria-hidden', 'true');
  $('#drawer-backdrop').classList.add('hidden');
}

async function handleViewAction(event) {
  const link = event.target.closest('[data-view-link]');
  if (link) return navigate(link.dataset.viewLink);
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const { action, id } = button.dataset;

  try {
    if (action === 'open-book') return openBookDialog();
    if (action === 'edit-book') return openBookDialog(state.books.find((book) => book._id === id));
    if (action === 'open-issue') return openIssueDialog(button.dataset.book || '');
    if (action === 'borrow') {
      if (!confirm('Borrow this book now?')) return;
      const result = await api('/transactions/borrow', { method: 'POST', body: JSON.stringify({ bookId: id }) });
      toast(result.message); return navigate('catalog');
    }
    if (action === 'hold') {
      const result = await api('/holds', { method: 'POST', body: JSON.stringify({ bookId: id }) });
      toast(`${result.message}. Queue position: ${result.data.queuePosition}`); return navigate('holds');
    }
    if (action === 'return') return returnTransaction(id);
    if (action === 'payment') return openPaymentDialog(id, button.dataset.balance);
    if (action === 'waive') {
      const reason = prompt('Reason for waiving this outstanding fine:');
      if (!reason) return;
      const result = await api(`/transactions/${id}/waive-fine`, { method: 'PUT', body: JSON.stringify({ reason }) });
      toast(result.message); return navigate('circulation');
    }
    if (action === 'inventory') {
      const inventoryAction = prompt('Action: add, remove, mark-lost, mark-damaged, repair-damaged, or recover-lost', 'add');
      if (!inventoryAction) return;
      const quantity = Number(prompt('Quantity', '1'));
      if (!Number.isInteger(quantity) || quantity < 1) return toast('Quantity must be a positive integer', 'error');
      const result = await api(`/books/${id}/inventory`, { method: 'PATCH', body: JSON.stringify({ action: inventoryAction, quantity }) });
      toast(result.message); return navigate('catalog');
    }
    if (action === 'archive-book') {
      if (!confirm('Archive this catalog record? It will disappear from searches.')) return;
      const result = await api(`/books/${id}`, { method: 'DELETE' });
      toast(result.message); return navigate('catalog');
    }
    if (action === 'cancel-hold') {
      if (!confirm('Cancel this hold?')) return;
      const result = await api(`/holds/${id}/cancel`, { method: 'PUT', body: JSON.stringify({}) });
      toast(result.message); return navigate('holds');
    }
    if (action === 'ready-hold') {
      const result = await api(`/holds/${id}/status`, { method: 'PUT', body: JSON.stringify({ status: 'ready' }) });
      toast(result.message); return navigate('holds');
    }
    if (action === 'expire-holds') {
      const result = await api('/holds/expire-ready', { method: 'POST', body: JSON.stringify({}) });
      toast(result.message); return navigate('holds');
    }
    if (action === 'generate-overdue') {
      const result = await api('/notifications/generate-overdue', { method: 'POST', body: JSON.stringify({}) });
      toast(result.message); return navigate(state.currentView);
    }
    if (action === 'refresh-circulation') return navigate('circulation');
    if (action === 'member-history') return showMemberHistory(id);
    if (action === 'toggle-user') {
      const isActive = button.dataset.active !== 'true';
      const result = await api(`/admin/users/${id}/status`, { method: 'PUT', body: JSON.stringify({ isActive }) });
      toast(result.message); return navigate('admin');
    }
  } catch (error) {
    const detail = error.details?.map((item) => `${item.field}: ${item.message}`).join(', ');
    toast(detail || error.message, 'error');
  }
}

$$('[data-auth-tab]').forEach((tab) => tab.addEventListener('click', () => {
  $$('[data-auth-tab]').forEach((item) => {
    const active = item === tab;
    item.classList.toggle('active', active);
    item.setAttribute('aria-selected', String(active));
  });
  $('#login-form').classList.toggle('hidden', tab.dataset.authTab !== 'login');
  $('#register-form').classList.toggle('hidden', tab.dataset.authTab !== 'register');
}));

$('#login-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = event.submitter;
  setButtonBusy(button, true, 'Signing in…');
  try {
    const body = Object.fromEntries(new FormData(event.currentTarget));
    const result = await api('/auth/login', { method: 'POST', body: JSON.stringify(body) });
    state.token = result.data.token;
    state.user = result.data.user;
    localStorage.setItem('libraryToken', state.token);
    toast('Welcome back');
    await enterApp();
  } catch (error) { toast(error.message, 'error'); } finally { setButtonBusy(button, false); }
});

$('#register-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = event.submitter;
  setButtonBusy(button, true, 'Creating account…');
  try {
    const body = Object.fromEntries(new FormData(event.currentTarget));
    if (!body.phone) delete body.phone;
    const result = await api('/auth/register', { method: 'POST', body: JSON.stringify(body) });
    state.token = result.data.token;
    state.user = result.data.user;
    localStorage.setItem('libraryToken', state.token);
    toast(`Membership created: ${state.user.membershipId}`);
    await enterApp();
  } catch (error) {
    const detail = error.details?.map((item) => item.message).join(', ');
    toast(detail || error.message, 'error');
  } finally { setButtonBusy(button, false); }
});

$$('[data-demo]').forEach((button) => button.addEventListener('click', () => {
  const credentials = {
    student: ['student@library.local', 'Student123!'],
    librarian: ['librarian@library.local', 'Library123!'],
    admin: ['admin@library.local', 'ChangeMe123!'],
  }[button.dataset.demo];
  const form = $('#login-form');
  form.email.value = credentials[0];
  form.password.value = credentials[1];
  form.email.focus();
}));

$$('.nav-item').forEach((item) => item.addEventListener('click', () => navigate(item.dataset.view)));
$('#logout-button').addEventListener('click', () => logout());
$('#menu-button').addEventListener('click', () => $('#sidebar').classList.toggle('open'));
$('#notification-button').addEventListener('click', () => loadNotifications(true));
$('#drawer-close').addEventListener('click', closeDrawer);
$('#drawer-backdrop').addEventListener('click', closeDrawer);
$('#read-all-button').addEventListener('click', async () => {
  try { await api('/notifications/read-all', { method: 'PUT', body: JSON.stringify({}) }); await loadNotifications(); } catch (error) { toast(error.message, 'error'); }
});
$('#notification-list').addEventListener('click', async (event) => {
  const item = event.target.closest('[data-notification-id]');
  if (!item || item.classList.contains('read')) return;
  try { await api(`/notifications/${item.dataset.notificationId}/read`, { method: 'PUT', body: JSON.stringify({}) }); await loadNotifications(); } catch (error) { toast(error.message, 'error'); }
});
view.addEventListener('click', handleViewAction);
$('#book-form').addEventListener('submit', submitBook);
$('#issue-form').addEventListener('submit', submitIssue);
$('#payment-form').addEventListener('submit', submitPayment);

boot();
