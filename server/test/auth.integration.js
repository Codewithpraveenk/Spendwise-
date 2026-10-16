import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { connectDatabase } from '../src/database.js';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config/env.js';
import { digestToken } from '../src/auth/sessions.js';

test('account lifecycle uses hashed passwords and revocable sessions', { timeout: 180000 }, async (t) => {
  const mongo = await MongoMemoryServer.create();
  t.after(() => mongo.stop());
  const database = await connectDatabase(mongo.getUri('auth_test'), { autoIndex: true });
  t.after(() => database.close());
  const logs = [];
  const logger = { info: (entry) => logs.push(entry), error: (entry) => logs.push(entry) };
  const server = createApp({ config: loadConfig({ NODE_ENV: 'test' }), database, logger }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); });
  const base = `http://127.0.0.1:${server.address().port}/api/auth`;
  const request = (path, { body, cookie, headers = {}, method = body ? 'POST' : 'GET' } = {}) => fetch(`${base}${path}`, {
    method, signal: AbortSignal.timeout(10000),
    headers: { 'Content-Type': 'application/json', 'X-Spendwise-Request': '1', ...(cookie ? { Cookie: cookie } : {}), ...headers },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const account = { name: 'Test Student', email: ' Student@example.com ', password: 'a long test passphrase 123' };
  let cookie;
  await t.test('register normalizes email, hashes password, and issues a private cookie', async () => {
    const response = await request('/register', { body: account });
    assert.equal(response.status, 201);
    assert.deepEqual(Object.keys((await response.json()).user).sort(), ['email', 'id', 'name']);
    const header = response.headers.get('set-cookie');
    assert.match(header, /HttpOnly/); assert.match(header, /SameSite=Lax/i); assert.match(header, /Path=\//);
    cookie = header.split(';')[0];
    const user = await database.models.User.findOne().select('+passwordHash');
    assert.notEqual(user.passwordHash, account.password);
    assert.match(user.passwordHash, /^scrypt-v1\$/);
    const session = await database.models.Session.findOne();
    assert.equal(session.tokenHash, digestToken(cookie.split('=')[1]));
    assert.ok(!JSON.stringify(session).includes(cookie.split('=')[1]));
  });
  await t.test('protected lookup rejects missing and malformed cookies', async () => {
    for (const invalid of [undefined, 'spendwise_session=invalid']) assert.equal((await request('/me', { cookie: invalid })).status, 401);
    const response = await request('/me', { cookie });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).user.email, 'student@example.com');
    assert.equal(response.headers.get('cache-control'), 'no-store');
  });
  await t.test('rejects duplicate registration and unsafe input', async () => {
    assert.equal((await request('/register', { body: account })).status, 409);
    for (const body of [{ ...account, password: 'short' }, { ...account, email: { $ne: null } }, { ...account, owner: 'injected' }]) {
      assert.equal((await request('/register', { body })).status, 400);
    }
  });
  await t.test('blocks cross-site and missing-header writes before creating records', async () => {
    assert.equal((await request('/logout', { body: {}, cookie, headers: { 'X-Spendwise-Request': '' } })).status, 403);
    assert.equal((await request('/logout', { body: {}, cookie, headers: { 'Sec-Fetch-Site': 'cross-site' } })).status, 403);
    assert.equal((await request('/logout', { body: {}, cookie, headers: { Origin: 'https://evil.example' } })).status, 403);
    assert.equal((await request('/me', { cookie })).status, 200);
  });
  await t.test('wrong passwords and unknown accounts share the same error', async () => {
    const failed = [];
    for (const email of ['student@example.com', 'missing@example.com']) {
      const response = await request('/login', { body: { email, password: 'wrong password' } });
      assert.equal(response.status, 401);
      const body = await response.json();
      failed.push([body.error.code, body.error.message]);
    }
    assert.deepEqual(failed[0], failed[1]);
  });
  await t.test('successful login rotates the current session; logout revokes it', async () => {
    const response = await request('/login', { body: { email: account.email, password: account.password }, cookie });
    assert.equal(response.status, 200);
    const nextCookie = response.headers.get('set-cookie').split(';')[0];
    assert.notEqual(cookie, nextCookie);
    assert.equal((await request('/me', { cookie })).status, 401);
    cookie = nextCookie;
    assert.equal((await request('/logout', { body: {}, cookie })).status, 204);
    assert.equal((await request('/me', { cookie })).status, 401);
    assert.equal(await database.models.Session.countDocuments(), 0);
  });
  await t.test('expired sessions are rejected before TTL cleanup runs', async () => {
    const response = await request('/login', { body: { email: account.email, password: account.password } });
    assert.equal(response.status, 200);
    cookie = response.headers.get('set-cookie').split(';')[0];
    await database.models.Session.updateMany({}, { $set: { expiresAt: new Date(0) } });
    assert.equal((await request('/me', { cookie })).status, 401);
  });
  await t.test('rate limit returns a structured 429 with retry information', async () => {
    let response;
    for (let index = 0; index < 12; index++) {
      response = await request('/login', { body: {} });
      if (response.status === 429) break;
    }
    assert.equal(response.status, 429);
    assert.equal((await response.json()).error.code, 'TOO_MANY_ATTEMPTS');
    assert.ok(response.headers.get('retry-after'));
  });
  assert.ok(!JSON.stringify(logs).includes(account.password));
  assert.ok(!JSON.stringify(logs).includes(cookie));
});
