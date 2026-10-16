import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { connectDatabase } from '../src/database.js';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config/env.js';
import { hashPassword } from '../src/auth/passwords.js';

test('Google login uses one-time challenges and preserves existing account ownership', { timeout: 180000 }, async (t) => {
  const mongo = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } }); t.after(() => mongo.stop());
  const database = await connectDatabase(mongo.getUri('google_test'), { autoIndex: true }); t.after(() => database.close());
  const clientId = '123-example.apps.googleusercontent.com';
  const password = 'fictional original passphrase 123';
  const original = await database.models.User.create({ name: 'Existing student', email: 'existing@example.com', passwordHash: await hashPassword(password) });
  const expense = await database.models.Transaction.create({ owner: original._id, description: 'Existing lunch', category: 'Food', type: 'expense', amountPaise: 100, date: '2000-01-01' });
  const tokens = new Map(); let server;
  async function start() {
    if (server) { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); }
    server = createApp({ config: loadConfig({ NODE_ENV: 'test', GOOGLE_CLIENT_ID: clientId }), database, logger: { info() {}, error() {} }, googleVerifier: async (credential) => { if (!tokens.has(credential)) throw new Error('bad signature'); return tokens.get(credential); } }).listen(0, '127.0.0.1');
    await once(server, 'listening');
  }
  t.after(async () => { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); });
  await start();
  async function request(path, { method = 'GET', cookie, body, unsafe = false } = {}) {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/auth/${path}`, { method, headers: { 'Content-Type': 'application/json', ...(!unsafe ? { 'X-Spendwise-Request': '1' } : {}), ...(cookie ? { Cookie: cookie } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: response.status, body: response.status === 204 ? null : await response.json(), cookies: response.headers.getSetCookie().map((value) => value.split(';')[0]) };
  }
  async function challenge({ sub = 'google-new', email = 'new@example.com' } = {}) {
    const response = await request('google/challenge'); assert.equal(response.status, 200);
    const credential = `test-credential-${tokens.size}-long-enough`;
    tokens.set(credential, { sub, email, name: 'Google Student', aud: clientId, iss: 'https://accounts.google.com', nonce: response.body.nonce, email_verified: true, exp: Math.floor(Date.now() / 1000) + 300 });
    return { credential, cookie: response.cookies[0], nonce: response.body.nonce };
  }
  let newId; let loginCookie;
  await t.test('challenge is private and invalid/unsafe tokens create no account', async () => {
    const draft = await challenge();
    assert.equal((await request('google', { method: 'POST', cookie: draft.cookie, unsafe: true, body: { credential: draft.credential } })).status, 403);
    assert.equal((await request('google', { method: 'POST', body: { credential: draft.credential } })).status, 401);
    assert.equal((await request('google', { method: 'POST', cookie: draft.cookie, body: { credential: 'invalid-credential-long-enough' } })).status, 401);
    assert.equal(await database.models.User.countDocuments(), 1);
  });
  await t.test('new Google user receives a normal private session and challenges cannot be replayed', async () => {
    const draft = await challenge();
    const response = await request('google', { method: 'POST', cookie: draft.cookie, body: { credential: draft.credential } });
    assert.equal(response.status, 200);
    newId = response.body.user.id;
    loginCookie = response.cookies.find((value) => value.startsWith('spendwise_session='));
    assert.ok(loginCookie); assert.ok(response.cookies.includes('spendwise_google='));
    assert.equal(response.body.user.googleSub, undefined);
    assert.equal((await request('me', { cookie: loginCookie })).body.user.id, newId);
    assert.equal((await request('google', { method: 'POST', cookie: draft.cookie, body: { credential: draft.credential } })).status, 401);
    assert.equal((await database.models.User.findById(newId).select('+passwordHash')).passwordHash, undefined);
  });
  await start(); // Fresh limiter window for the next independent group.
  await t.test('existing password account requires proof before Google can link to its records', async () => {
    const draft = await challenge({ sub: 'google-existing', email: 'existing@example.com' });
    let response = await request('google', { method: 'POST', cookie: draft.cookie, body: { credential: draft.credential } });
    assert.equal(response.status, 409); assert.equal(response.body.error.code, 'GOOGLE_LINK_REQUIRED');
    response = await request('google', { method: 'POST', cookie: draft.cookie, body: { credential: draft.credential, password: 'incorrect' } });
    assert.equal(response.status, 401);
    assert.equal((await database.models.User.findById(original._id).select('+googleSub')).googleSub, undefined);
    response = await request('google', { method: 'POST', cookie: draft.cookie, body: { credential: draft.credential, password } });
    assert.equal(response.status, 200); assert.equal(response.body.user.id, String(original._id));
    assert.equal(String((await database.models.Transaction.findById(expense._id)).owner), String(original._id));
    assert.equal(await database.models.User.countDocuments({ email: 'existing@example.com' }), 1);
    assert.equal((await request('login', { method: 'POST', body: { email: 'existing@example.com', password } })).status, 200);
  });
  await t.test('returning Google identity keeps its account even when its provider email changes', async () => {
    const draft = await challenge({ email: 'existing@example.com' });
    const response = await request('google', { method: 'POST', cookie: draft.cookie, body: { credential: draft.credential } });
    assert.equal(response.status, 200); assert.equal(response.body.user.id, newId);
  });
  await start();
  await t.test('a different Google identity cannot take over an already linked email', async () => {
    const draft = await challenge({ sub: 'different-google', email: 'existing@example.com' });
    const response = await request('google', { method: 'POST', cookie: draft.cookie, body: { credential: draft.credential, password } });
    assert.equal(response.status, 409); assert.equal(response.body.error.code, 'GOOGLE_LINK_CONFLICT');
  });
  await t.test('expired challenges and nonce mismatches fail before issuing sessions', async () => {
    const draft = await challenge({ sub: 'another-google', email: 'another@example.com' });
    tokens.get(draft.credential).nonce = 'wrong';
    assert.equal((await request('google', { method: 'POST', cookie: draft.cookie, body: { credential: draft.credential } })).status, 401);
    tokens.get(draft.credential).nonce = draft.nonce;
    await database.models.GoogleChallenge.updateMany({}, { $set: { expiresAt: new Date(0) } });
    assert.equal((await request('google', { method: 'POST', cookie: draft.cookie, body: { credential: draft.credential } })).status, 401);
    assert.equal(await database.models.User.countDocuments({ email: 'another@example.com' }), 0);
  });
  await t.test('Google-only accounts cannot use an invented password and logout revokes sessions', async () => {
    assert.equal((await request('login', { method: 'POST', body: { email: 'new@example.com', password } })).status, 401);
    assert.equal((await request('logout', { method: 'POST', cookie: loginCookie, body: {} })).status, 204);
    assert.equal((await request('me', { cookie: loginCookie })).status, 401);
  });
});
