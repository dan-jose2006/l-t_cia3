const fs = require('fs');
const path = require('path');

const standardTests = [
  'pm.test("Response is JSON", function () { pm.response.to.be.json; });',
  'pm.test("Request succeeded", function () { pm.expect(pm.response.code).to.be.below(400); });',
  'const json = pm.response.json();',
  'pm.test("Uses the standard success envelope", function () { pm.expect(json.success).to.eql(true); });',
];

function request(name, method, endpoint, options = {}) {
  const headers = [];
  if (options.body !== undefined) headers.push({ key: 'Content-Type', value: 'application/json' });
  const auth = options.auth === false ? { type: 'noauth' } : {
    type: 'bearer',
    bearer: [{ key: 'token', value: `{{${options.auth || 'token'}}}`, type: 'string' }],
  };
  const item = {
    name,
    request: {
      method,
      header: headers,
      auth,
      url: { raw: `{{baseUrl}}/api${endpoint}`, host: ['{{baseUrl}}'], path: ['api', ...endpoint.split('/').filter(Boolean)] },
      description: options.description || '',
    },
    response: [],
  };
  if (options.body !== undefined) {
    item.request.body = { mode: 'raw', raw: JSON.stringify(options.body, null, 2), options: { raw: { language: 'json' } } };
  }
  if (options.preRequest) item.event = [{ listen: 'prerequest', script: { type: 'text/javascript', exec: options.preRequest } }];
  const tests = options.tests === false ? [] : [...standardTests, ...(options.tests || [])];
  if (tests.length) {
    item.event = [...(item.event || []), { listen: 'test', script: { type: 'text/javascript', exec: tests } }];
  }
  return item;
}

const collection = {
  info: {
    _postman_id: '2a41d4a3-713d-4dc5-b87f-37cb0ae33b93',
    name: 'Digital Library Management System — Complete API',
    description: 'CIA-3 collection covering authentication, catalog, circulation, holds, fines, notifications, inventory, member history, reports, settings, and RBAC. Run the seed script before using the demo logins.',
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
  },
  auth: { type: 'bearer', bearer: [{ key: 'token', value: '{{token}}', type: 'string' }] },
  variable: [
    { key: 'baseUrl', value: 'http://localhost:4000' },
    { key: 'token', value: '' },
    { key: 'memberToken', value: '' },
    { key: 'librarianToken', value: '' },
    { key: 'adminToken', value: '' },
    { key: 'memberId', value: '' },
    { key: 'bookId', value: '' },
    { key: 'transactionId', value: '' },
    { key: 'holdId', value: '' },
    { key: 'paymentId', value: '' },
    { key: 'planId', value: '' },
    { key: 'notificationId', value: '' },
    { key: 'staffId', value: '' },
    { key: 'demoReturnDate', value: '' },
  ],
  item: [
    {
      name: '00 — Health and Authentication',
      item: [
        request('API health', 'GET', '/health', { auth: false }),
        request('Register member', 'POST', '/auth/register', {
          auth: false,
          body: { name: 'Postman Student', email: 'postman.student@example.com', password: 'Student123!', memberType: 'student', phone: '9876543210' },
          tests: [
            'pm.collectionVariables.set("memberToken", json.data.token);',
            'pm.collectionVariables.set("token", json.data.token);',
            'pm.collectionVariables.set("memberId", json.data.user._id);',
          ],
          description: 'Change the email if this account already exists.',
        }),
        request('Login demo member', 'POST', '/auth/login', {
          auth: false,
          body: { email: 'student@library.local', password: 'Student123!' },
          tests: ['pm.collectionVariables.set("memberToken", json.data.token);', 'pm.collectionVariables.set("token", json.data.token);', 'pm.collectionVariables.set("memberId", json.data.user._id);'],
        }),
        request('Login demo librarian', 'POST', '/auth/login', {
          auth: false,
          body: { email: 'librarian@library.local', password: 'Library123!' },
          tests: ['pm.collectionVariables.set("librarianToken", json.data.token);', 'pm.collectionVariables.set("token", json.data.token);'],
        }),
        request('Login demo admin', 'POST', '/auth/login', {
          auth: false,
          body: { email: 'admin@library.local', password: 'ChangeMe123!' },
          tests: ['pm.collectionVariables.set("adminToken", json.data.token);', 'pm.collectionVariables.set("token", json.data.token);'],
        }),
        request('Current profile', 'GET', '/auth/me'),
        request('Update current profile', 'PUT', '/auth/me', { body: { name: 'Postman Student', phone: '9999999999' }, auth: 'memberToken' }),
        request('Missing-token check (expected 401)', 'GET', '/auth/me', {
          auth: false,
          tests: [
            'pm.test("Returns 401", function () { pm.response.to.have.status(401); });',
            'const json = pm.response.json();',
            'pm.test("Uses error envelope", function () { pm.expect(json.success).to.eql(false); pm.expect(json.errorCode).to.exist; });',
          ],
        }),
      ],
    },
    {
      name: '01 — Catalog and Inventory',
      item: [
        request('List and search catalog', 'GET', '/books?limit=100&q=learning', {
          auth: false,
          tests: ['if (json.data.length) { pm.collectionVariables.set("bookId", json.data[0]._id); }'],
        }),
        request('List all catalog books and save first ID', 'GET', '/books?limit=100', {
          auth: false,
          tests: ['pm.test("Catalog is an array", function () { pm.expect(json.data).to.be.an("array"); });', 'if (json.data.length) { pm.collectionVariables.set("bookId", json.data[0]._id); }'],
        }),
        request('List categories', 'GET', '/books/categories', { auth: false }),
        request('Get one book', 'GET', '/books/{{bookId}}', { auth: false }),
        request('Create book', 'POST', '/books', {
          auth: 'librarianToken',
          body: { title: 'Responsible AI Engineering', author: 'CIA-3 Team', isbn: 'CIA3-POSTMAN-001', category: 'Artificial Intelligence', totalCopies: 3, publisher: 'University Press', publishedYear: 2026, shelfLocation: 'D-01', description: 'A demonstration catalog record created through Postman.' },
          tests: ['pm.collectionVariables.set("bookId", json.data._id);'],
          description: 'Change the ISBN when repeating this request.',
        }),
        request('Update book details', 'PUT', '/books/{{bookId}}', { auth: 'librarianToken', body: { shelfLocation: 'D-02', category: 'Responsible AI' } }),
        request('Add inventory copy', 'PATCH', '/books/{{bookId}}/inventory', { auth: 'librarianToken', body: { action: 'add', quantity: 1 } }),
        request('Mark inventory copy damaged', 'PATCH', '/books/{{bookId}}/inventory', { auth: 'librarianToken', body: { action: 'mark-damaged', quantity: 1 } }),
        request('Repair damaged copy', 'PATCH', '/books/{{bookId}}/inventory', { auth: 'librarianToken', body: { action: 'repair-damaged', quantity: 1 } }),
      ],
    },
    {
      name: '02 — Members and Circulation',
      item: [
        request('List members and save first ID', 'GET', '/members?limit=100&active=true', {
          auth: 'librarianToken',
          tests: ['pm.test("Member list returned", function () { pm.expect(json.data).to.be.an("array"); });', 'if (json.data.length) { pm.collectionVariables.set("memberId", json.data[0]._id); }'],
        }),
        request('Issue book at circulation desk', 'POST', '/transactions/issue', {
          auth: 'librarianToken', body: { bookId: '{{bookId}}', memberId: '{{memberId}}' },
          tests: ['pm.collectionVariables.set("transactionId", json.data._id);'],
        }),
        request('Member self-borrow', 'POST', '/transactions/borrow', { auth: 'memberToken', body: { bookId: '{{bookId}}' }, description: 'Use another available book ID if the desk-issue request used this same member and book.' }),
        request('List member transactions', 'GET', '/transactions/my?limit=100', { auth: 'memberToken' }),
        request('List all transactions', 'GET', '/transactions?limit=100', { auth: 'librarianToken' }),
        request('Get one transaction', 'GET', '/transactions/{{transactionId}}', { auth: 'librarianToken' }),
        request('Return book and calculate fine', 'PUT', '/transactions/{{transactionId}}/return', {
          auth: 'librarianToken',
          body: { condition: 'good', returnDate: '{{demoReturnDate}}' },
          preRequest: [
            'const future = new Date();',
            'future.setUTCDate(future.getUTCDate() + 45);',
            'pm.collectionVariables.set("demoReturnDate", future.toISOString());',
          ],
        }),
        request('Member borrowing history', 'GET', '/members/{{memberId}}/history', { auth: 'librarianToken' }),
      ],
    },
    {
      name: '03 — Holds and Notifications',
      item: [
        request('Place hold', 'POST', '/holds', {
          auth: 'memberToken', body: { bookId: '{{bookId}}' },
          tests: ['pm.collectionVariables.set("holdId", json.data.hold._id);'],
          description: 'The selected title must be unavailable or already have an active queue.',
        }),
        request('List my holds', 'GET', '/holds/my', { auth: 'memberToken' }),
        request('List all holds', 'GET', '/holds', { auth: 'librarianToken' }),
        request('Book hold queue', 'GET', '/holds/book/{{bookId}}/queue', { auth: 'librarianToken' }),
        request('Mark hold ready', 'PUT', '/holds/{{holdId}}/status', { auth: 'librarianToken', body: { status: 'ready' } }),
        request('Expire elapsed ready holds', 'POST', '/holds/expire-ready', { auth: 'librarianToken', body: {} }),
        request('Cancel hold', 'PUT', '/holds/{{holdId}}/cancel', { auth: 'memberToken', body: {} }),
        request('Generate overdue notifications', 'POST', '/notifications/generate-overdue', { auth: 'librarianToken', body: {} }),
        request('List my notifications', 'GET', '/notifications/my', {
          auth: 'memberToken', tests: ['if (json.data.length) { pm.collectionVariables.set("notificationId", json.data[0]._id); }'],
        }),
        request('Mark one notification read', 'PUT', '/notifications/{{notificationId}}/read', { auth: 'memberToken', body: {} }),
        request('Mark all notifications read', 'PUT', '/notifications/read-all', { auth: 'memberToken', body: {} }),
      ],
    },
    {
      name: '04 — Fines and Payments',
      item: [
        request('Record fine payment', 'POST', '/fine-payments', {
          auth: 'librarianToken', body: { transactionId: '{{transactionId}}', amount: 5, method: 'upi', reference: 'UPI-DEMO-001' },
          tests: ['pm.collectionVariables.set("paymentId", json.data.payment._id);'],
          description: 'Set amount at or below the outstanding fine balance.',
        }),
        request('List member payments', 'GET', '/fine-payments/my', { auth: 'memberToken' }),
        request('List all payments', 'GET', '/fine-payments?limit=100', { auth: 'librarianToken' }),
        request('Waive remaining fine', 'PUT', '/transactions/{{transactionId}}/waive-fine', { auth: 'librarianToken', body: { reason: 'Approved academic exception' } }),
        request('Reverse payment', 'PUT', '/fine-payments/{{paymentId}}/reverse', { auth: 'adminToken', body: { reason: 'Demonstration reversal' } }),
      ],
    },
    {
      name: '05 — Reports',
      item: [
        request('Dashboard summary', 'GET', '/reports/dashboard', { auth: 'librarianToken' }),
        request('Most borrowed books', 'GET', '/reports/most-borrowed?limit=10', { auth: 'librarianToken' }),
        request('Overdue report', 'GET', '/admin/reports/overdue', { auth: 'librarianToken' }),
        request('Inventory health', 'GET', '/reports/inventory-health', { auth: 'librarianToken' }),
        request('Fine summary', 'GET', '/reports/fines', { auth: 'librarianToken' }),
      ],
    },
    {
      name: '06 — Admin, Plans, and Settings',
      item: [
        request('Get library settings', 'GET', '/settings', { auth: 'adminToken' }),
        request('Update library settings', 'PUT', '/settings', { auth: 'adminToken', body: { libraryName: 'University Digital Library', currency: 'INR', holdReadyDays: 2, allowMemberSelfBorrow: true, allowMemberSelfReturn: true } }),
        request('List membership plans', 'GET', '/membership-plans', {
          auth: 'adminToken', tests: ['if (json.data.length) { pm.collectionVariables.set("planId", json.data[0]._id); }'],
        }),
        request('Create membership plan', 'POST', '/membership-plans', {
          auth: 'adminToken', body: { key: 'student-postman', name: 'Student Postman Plan', memberType: 'student', maxBooks: 5, loanDays: 21, finePerDay: 4, graceDays: 1, isActive: true },
          tests: ['pm.collectionVariables.set("planId", json.data._id);'],
          description: 'Change the key when repeating this request.',
        }),
        request('Update membership plan', 'PUT', '/membership-plans/{{planId}}', { auth: 'adminToken', body: { maxBooks: 6, loanDays: 21 } }),
        request('List all users', 'GET', '/admin/users?limit=100', { auth: 'adminToken' }),
        request('Create librarian', 'POST', '/admin/users/staff', {
          auth: 'adminToken', body: { name: 'Postman Librarian', email: 'postman.librarian@example.com', password: 'Library123!', role: 'librarian' },
          tests: ['pm.collectionVariables.set("staffId", json.data._id);'],
          description: 'Change the email when repeating this request.',
        }),
        request('Disable staff account', 'PUT', '/admin/users/{{staffId}}/status', { auth: 'adminToken', body: { isActive: false } }),
        request('Enable staff account', 'PUT', '/admin/users/{{staffId}}/status', { auth: 'adminToken', body: { isActive: true } }),
        request('Wrong-role check (expected 403)', 'GET', '/admin/users', {
          auth: 'memberToken',
          tests: [
            'pm.test("Returns 403", function () { pm.response.to.have.status(403); });',
            'const json = pm.response.json();',
            'pm.test("RBAC denial is explicit", function () { pm.expect(json.errorCode).to.eql("FORBIDDEN"); });',
          ],
        }),
      ],
    },
  ],
};

const environment = {
  id: 'b0efc3d7-2a77-4b46-958c-3fd78192bfab',
  name: 'Digital Library — Local',
  values: [{ key: 'baseUrl', value: 'http://localhost:4000', enabled: true }],
  _postman_variable_scope: 'environment',
  _postman_exported_at: new Date().toISOString(),
  _postman_exported_using: 'Digital Library project generator',
};

const output = path.join(__dirname, '..', 'postman');
fs.mkdirSync(output, { recursive: true });
fs.writeFileSync(path.join(output, 'Digital-Library.postman_collection.json'), `${JSON.stringify(collection, null, 2)}\n`);
fs.writeFileSync(path.join(output, 'Digital-Library-Local.postman_environment.json'), `${JSON.stringify(environment, null, 2)}\n`);
console.log('Postman collection and environment generated.');
