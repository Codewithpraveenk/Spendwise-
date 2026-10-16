import test from 'node:test';
import assert from 'node:assert/strict';
import { createAuthApi, validateAccount } from './authApi.js';

const user = { id: 'test-user', name: 'Student', email: 'student@example.com' };
test('forgot-password requests submit only the email and return the generic server notice', async () => {
  const api = createAuthApi(async (path, options) => {
    assert.equal(path, '/api/auth/forgot-password'); assert.equal(options.credentials, 'include');
    assert.deepEqual(JSON.parse(options.body), { email: 'student@example.com' });
    assert.equal(options.headers['X-Spendwise-Request'], '1');
    return Response.json({ message: 'If this account exists, check your inbox.' }, { status: 202 });
  });
  assert.equal(await api.forgotPassword('student@example.com'), 'If this account exists, check your inbox.');
});
test('reset requests whitelist token and password and do not expect an automatic session', async () => {
  const api = createAuthApi(async (path, options) => {
    assert.equal(path, '/api/auth/reset-password');
    assert.deepEqual(JSON.parse(options.body), { token: 'fixture-token', password: 'fictional replacement password' });
    return Response.json({ message: 'Password updated. Sign in again.' });
  });
  assert.equal(await api.resetPassword({ token: 'fixture-token', password: 'fictional replacement password', email: 'untrusted', owner: 'untrusted' }), 'Password updated. Sign in again.');
});
test('recovery cannot claim success on malformed notices, expired links or unconfigured email', async () => {
  await assert.rejects(createAuthApi(async () => Response.json({ user })).forgotPassword('student@example.com'), { code: 'INVALID_RESPONSE' });
  for (const [status, code] of [[400, 'RESET_LINK_INVALID'], [503, 'EMAIL_NOT_CONFIGURED'], [429, 'RECOVERY_RATE_LIMIT']]) {
    await assert.rejects(createAuthApi(async () => Response.json({ error: { code, message: 'Action required.' } }, { status })).resetPassword({ token: 'fixture', password: 'fictional password' }), { status, code });
  }
});
test('Google challenge validates server configuration and retains cookie transport', async () => {
  const api = createAuthApi(async (path, options) => {
    assert.equal(path, '/api/auth/google/challenge'); assert.equal(options.credentials, 'include');
    return Response.json({ nonce: 'a'.repeat(64), clientId: '123-example.apps.googleusercontent.com', privateField: 'discard' });
  });
  assert.deepEqual(await api.googleChallenge(), { nonce: 'a'.repeat(64), clientId: '123-example.apps.googleusercontent.com' });
  await assert.rejects(createAuthApi(async () => Response.json({ nonce: 'bad', clientId: 'invalid' })).googleChallenge(), { code: 'INVALID_RESPONSE' });
});
test('Google login sends only its credential and optional explicit linking password', async () => {
  const calls = [];
  const api = createAuthApi(async (path, options) => { calls.push({ path, options }); return Response.json({ user }); });
  await api.google({ credential: 'id-token', password: 'linking-password', email: 'untrusted@example.com', sub: 'untrusted' });
  assert.equal(calls[0].path, '/api/auth/google');
  assert.deepEqual(JSON.parse(calls[0].options.body), { credential: 'id-token', password: 'linking-password' });
  await api.google({ credential: 'id-token' });
  assert.deepEqual(JSON.parse(calls[1].options.body), { credential: 'id-token' });
});
test('Google link-required errors remain actionable without automatically submitting again', async () => {
  let calls = 0;
  const api = createAuthApi(async () => { calls++; return Response.json({ error: { code: 'GOOGLE_LINK_REQUIRED', message: 'Enter your SpendWise password.' } }, { status: 409 }); });
  await assert.rejects(api.google({ credential: 'id-token' }), { status: 409, code: 'GOOGLE_LINK_REQUIRED' });
  assert.equal(calls, 1);
});
test('account requests include cookies and send only documented JSON fields', async () => {
  const calls = [];
  const api = createAuthApi(async (url, options) => { calls.push({ url, options }); return Response.json({ user: { ...user, passwordHash: 'never-expose' } }); });
  assert.deepEqual(await api.me(), user);
  const body = { email: user.email, password: 'test passphrase' };
  assert.deepEqual(await api.login(body), user);
  assert.equal(calls[0].url, '/api/auth/me');
  assert.equal(calls[0].options.credentials, 'include');
  assert.equal(calls[0].options.body, undefined);
  assert.equal(calls[1].options.headers['X-Spendwise-Request'], '1');
  assert.deepEqual(JSON.parse(calls[1].options.body), body);
});
test('account API preserves structured errors and retry timing', async () => {
  const api = createAuthApi(async () => Response.json({ error: { code: 'TOO_MANY_ATTEMPTS', message: 'Try later.' } }, { status: 429, headers: { 'Retry-After': '900' } }));
  await assert.rejects(api.login({}), { status: 429, code: 'TOO_MANY_ATTEMPTS', retryAfter: '900', message: 'Try later.' });
});
test('logout accepts an empty 204 response', async () => {
  assert.equal(await createAuthApi(async () => new Response(null, { status: 204 })).logout(), null);
});
test('unreadable or incomplete responses produce actionable errors', async () => {
  await assert.rejects(createAuthApi(async () => new Response('bad gateway', { status: 502 })).me(), { code: 'INVALID_RESPONSE' });
  await assert.rejects(createAuthApi(async () => Response.json({ user: {} })).me(), { code: 'INVALID_RESPONSE' });
});
test('network failures are reported without exposing request data', async () => {
  await assert.rejects(createAuthApi(async () => { throw new Error('private details'); }).me(), (error) => error.code === 'NETWORK_ERROR' && !error.message.includes('private details'));
});

test('interrupted Google writes request a fresh sign-in without replaying credentials', async () => {
  for (const response of [null, new Response('proxy restart', { status: 500 })]) {
    let calls = 0;
    const api = createAuthApi(async () => { calls++; if (!response) throw new Error('ECONNRESET private details'); return response; });
    await assert.rejects(api.google({ credential: 'fictional-test-token' }), (error) => error.code === 'GOOGLE_CONNECTION_ERROR' && /fresh attempt/.test(error.message) && !error.message.includes('private details'));
    assert.equal(calls, 1);
  }
});
test('account requests time out and support cancellation', async () => {
  const fetcher = (_url, { signal }) => new Promise((_resolve, reject) => {
    if (signal.aborted) reject(new DOMException('Cancelled', 'AbortError'));
    else signal.addEventListener('abort', () => reject(new DOMException('Cancelled', 'AbortError')), { once: true });
  });
  await assert.rejects(createAuthApi(fetcher, 10).me(), /timed out/);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(createAuthApi(fetcher).me(controller.signal), { name: 'AbortError' });
});
test('registration validates confirmation and bounds without trimming passwords', () => {
  const values = { name: 'Student', email: user.email, password: 'a long passphrase ', confirmPassword: 'a long passphrase ' };
  assert.deepEqual(validateAccount(values, true), {});
  assert.ok(validateAccount({ ...values, confirmPassword: values.password.trim() }, true).confirmPassword);
  assert.ok(validateAccount({ ...values, password: 'short' }, true).password);
  assert.ok(validateAccount({ ...values, name: ' ', email: 'invalid' }, true).name);
  assert.ok(validateAccount({ ...values, name: ' ', email: 'invalid' }, true).email);
});
test('login does not apply the new-account minimum to existing passwords', () => {
  assert.deepEqual(validateAccount({ email: user.email, password: 'existing' }, false), {});
  assert.ok(validateAccount({ email: user.email, password: '' }, false).password);
});
