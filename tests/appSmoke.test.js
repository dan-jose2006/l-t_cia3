const test = require('node:test');
const assert = require('node:assert/strict');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_secret_that_is_longer_than_32_characters';

const app = require('../app');

test('public API and authentication middleware return standard envelopes', async (context) => {
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });
  context.after(() => new Promise((resolve) => server.close(resolve)));
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;

  await context.test('health endpoint succeeds', async () => {
    const response = await fetch(`${base}/api/health`);
    const payload = await response.json();
    assert.equal(response.status, 200);
    assert.equal(payload.success, true);
    assert.equal(payload.message, 'Digital Library API is healthy');
  });

  await context.test('demonstration frontend and assets are served', async () => {
    const [pageResponse, cssResponse, scriptResponse] = await Promise.all([
      fetch(`${base}/`),
      fetch(`${base}/css/styles.css`),
      fetch(`${base}/js/app.js`),
    ]);
    const page = await pageResponse.text();
    assert.equal(pageResponse.status, 200);
    assert.equal(cssResponse.status, 200);
    assert.equal(scriptResponse.status, 200);
    assert.match(page, /University Digital Library/);
  });

  await context.test('protected endpoint rejects a missing token', async () => {
    const response = await fetch(`${base}/api/auth/me`);
    const payload = await response.json();
    assert.equal(response.status, 401);
    assert.deepEqual(
      { success: payload.success, errorCode: payload.errorCode },
      { success: false, errorCode: 'AUTHENTICATION_REQUIRED' },
    );
  });

  await context.test('unknown API endpoint uses centralized 404 handling', async () => {
    const response = await fetch(`${base}/api/does-not-exist`);
    const payload = await response.json();
    assert.equal(response.status, 404);
    assert.equal(payload.errorCode, 'ROUTE_NOT_FOUND');
  });

  await context.test('invalid registration is rejected before database access', async () => {
    const response = await fetch(`${base}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'not-an-email' }),
    });
    const payload = await response.json();
    assert.equal(response.status, 400);
    assert.equal(payload.errorCode, 'VALIDATION_ERROR');
    assert.ok(Array.isArray(payload.details));
  });

  await context.test('invalid MongoDB ID receives a clean validation response', async () => {
    const response = await fetch(`${base}/api/books/not-a-valid-id`);
    const payload = await response.json();
    assert.equal(response.status, 400);
    assert.equal(payload.errorCode, 'VALIDATION_ERROR');
  });
});
