import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { connectDatabase } from '../src/database.js';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config/env.js';
import { hashPassword, verifyPassword } from '../src/auth/passwords.js';
import { digestToken } from '../src/auth/sessions.js';
import { deliverOne, decryptMail } from '../src/mail/delivery.js';
import { createRecovery } from '../src/auth/recovery.js';
import { createBrevoMailer } from '../src/mail/brevo.js';

test('password recovery queues mail, resets once, and revokes stale sessions atomically', { timeout: 180000 }, async (t) => {
  const mongo = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } }); t.after(() => mongo.stop());
  const uri = mongo.getUri('recovery_test'); const database = await connectDatabase(uri, { autoIndex: true }); t.after(() => database.close());
  const config = loadConfig({ NODE_ENV: 'test', SMTP_HOST: 'smtp.example.com', SMTP_PORT: '465', SMTP_USER: 'sender@example.com', SMTP_PASSWORD: 'fixture-only', MAIL_FROM: 'sender@example.com', MAIL_ENCRYPTION_KEY: 'a'.repeat(64) });
  const logs = []; const logger = { info() {}, error(entry) { logs.push(entry); } };
  const server = createApp({ config, database, logger }).listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(async () => { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); });
  const request = async (path, body, cookie) => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/auth/${path}`, { method: body === undefined ? 'GET' : 'POST', signal: AbortSignal.timeout(20000), headers: { 'Content-Type': 'application/json', 'X-Spendwise-Request': '1', ...(cookie ? { Cookie: cookie } : {}) }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
    return { status: response.status, body: response.status === 204 ? null : await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0] };
  };
  const originalPassword = 'fictional original password 123'; const newPassword = 'fictional replacement password 456';
  const owner = await database.models.User.create({ name: 'Owner', email: 'owner@example.com', passwordHash: await hashPassword(originalPassword), googleSub: 'existing-google' });
  const other = await database.models.User.create({ name: 'Other', email: 'other@example.com', passwordHash: await hashPassword(originalPassword) });
  await database.models.User.create({ name: 'Google only', email: 'google@example.com', googleSub: 'google-only' });
  const expense = await database.models.Transaction.create({ owner: owner._id, description: 'Keep this record', category: 'Food', type: 'expense', amountPaise: 100, date: '2000-01-01' });
  let ownerCookie = (await request('login', { email: owner.email, password: originalPassword })).cookie;
  const otherCookie = (await request('login', { email: other.email, password: originalPassword })).cookie;
  const sent = [];
  const mailer = { async sendMail(message) { sent.push(message); return { accepted: [message.to], rejected: [] }; } };
  const deliver = () => deliverOne({ config, database, mailer, logger });
  const tokenFrom = (text) => new URL(text.match(/http:\/\/localhost:5173\/reset-password#token=[a-f0-9]+/)[0]).hash.slice(7);
  let firstToken; let token;
  await t.test('unknown and Google-only emails receive the same response without mail or leaked tokens', async () => {
    const first = await request('forgot-password', { email: 'unknown@example.com' }); const second = await request('forgot-password', { email: 'google@example.com' });
    assert.equal(first.status, 202); assert.deepEqual(first.body, second.body);
    assert.equal(await database.models.MailJob.countDocuments(), 0);
    assert.equal((await request('forgot-password', { email: 'invalid', owner: String(owner._id) })).status, 400);
  });
  await t.test('reset requests persist encrypted jobs and are throttled per account without changing passwords', async () => {
    const response = await request('forgot-password', { email: ' OWNER@example.com ' }); assert.equal(response.status, 202);
    assert.equal(response.body.token, undefined);
    const job = await database.models.MailJob.findOne({ owner: owner._id });
    const content = decryptMail(job.encrypted, config.mailKey); firstToken = tokenFrom(content.text);
    assert.ok(!JSON.stringify(job.toObject()).includes(firstToken));
    assert.equal((await database.models.PasswordReset.findOne({ owner: owner._id })).tokenHash, digestToken(firstToken));
    await request('forgot-password', { email: owner.email });
    assert.equal(await database.models.MailJob.countDocuments({ owner: owner._id }), 1);
    assert.equal(await verifyPassword(originalPassword, (await database.models.User.findById(owner._id).select('+passwordHash')).passwordHash), true);
    const workerDatabase = await connectDatabase(uri);
    try { await deliverOne({ config, database: workerDatabase, mailer, logger }); } finally { await workerDatabase.close(); }
    assert.equal(sent.length, 1); assert.equal((await database.models.MailJob.findById(job._id)).encrypted, undefined);
  });
  await t.test('new requests invalidate old links; expired links and weak passwords are rejected', async () => {
    await database.models.PasswordReset.updateOne({ owner: owner._id }, { $set: { requestedAt: new Date(0) } });
    assert.equal((await request('forgot-password', { email: owner.email })).status, 202); await deliver(); token = tokenFrom(sent.at(-1).text);
    assert.notEqual(token, firstToken);
    assert.equal((await request('reset-password', { token: firstToken, password: newPassword })).status, 400);
    assert.equal((await request('reset-password', { token, password: 'short' })).status, 400);
    await database.models.PasswordReset.updateOne({ owner: owner._id }, { $set: { expiresAt: new Date(0) } });
    assert.equal((await request('reset-password', { token, password: newPassword })).status, 400);
    await database.models.PasswordReset.updateOne({ owner: owner._id }, { $set: { expiresAt: new Date(Date.now() + 600000) } });
  });
  await t.test('database failure rolls back password, sessions, token consumption and notification', async () => {
    const create = database.models.MailJob.create;
    database.models.MailJob.create = async () => { throw new Error('simulated notification queue failure'); };
    try { assert.equal((await request('reset-password', { token, password: newPassword })).status, 500); } finally { database.models.MailJob.create = create; }
    assert.equal((await request('me', undefined, ownerCookie)).status, 200);
    assert.ok(await database.models.PasswordReset.exists({ tokenHash: digestToken(token) }));
    assert.equal(await verifyPassword(originalPassword, (await database.models.User.findById(owner._id).select('+passwordHash')).passwordHash), true);
  });
  await t.test('concurrent reset submissions succeed once and preserve data and Google identity', async () => {
    const responses = await Promise.all([1, 2].map(() => request('reset-password', { token, password: newPassword })));
    assert.deepEqual(responses.map((item) => item.status).sort(), [200, 400]);
    const success = responses.find((item) => item.status === 200); assert.equal(success.cookie, 'spendwise_session='); assert.equal(success.body.user, undefined);
    assert.equal((await request('me', undefined, ownerCookie)).status, 401);
    assert.equal((await request('me', undefined, otherCookie)).status, 200);
    assert.ok(await database.models.Transaction.findById(expense._id));
    const updated = await database.models.User.findById(owner._id).select('+passwordHash +googleSub');
    assert.equal(updated.googleSub, 'existing-google'); assert.equal(updated.authVersion, 1);
    assert.equal(await verifyPassword(newPassword, updated.passwordHash), true);
    assert.equal(await verifyPassword(originalPassword, updated.passwordHash), false);
    assert.equal(await database.models.PasswordReset.countDocuments({ owner: owner._id }), 0);
    await deliver(); assert.match(sent.at(-1).subject, /changed/); assert.ok(!sent.at(-1).text.includes(newPassword));
  });
  await t.test('old links and late sessions from pre-reset credentials cannot restore access', async () => {
    assert.equal((await request('reset-password', { token, password: newPassword })).status, 400);
    const late = 'f'.repeat(64);
    await database.models.Session.create({ owner: owner._id, tokenHash: digestToken(late), expiresAt: new Date(Date.now() + 600000), authVersion: 0 });
    assert.equal((await request('me', undefined, `spendwise_session=${late}`)).status, 401);
    ownerCookie = (await request('login', { email: owner.email, password: newPassword })).cookie;
    assert.equal((await request('me', undefined, ownerCookie)).status, 200);
  });
  await t.test('Brevo-only configuration queues encrypted recovery and acknowledges HTTP delivery', async () => {
    const brevoConfig = loadConfig({ NODE_ENV: 'test', MAIL_PROVIDER: 'brevo', BREVO_API_KEY: 'fixture-only', MAIL_FROM: 'sender@example.com', MAIL_ENCRYPTION_KEY: 'a'.repeat(64) });
    const student = await database.models.User.create({ name: 'HTTP mail student', email: 'http@example.com', passwordHash: await hashPassword(originalPassword) });
    await createRecovery({ config: brevoConfig, database }).request({ email: student.email });
    const job = await database.models.MailJob.findOne({ owner: student._id });
    assert.ok(job.encrypted);
    let payload;
    const httpMailer = createBrevoMailer(brevoConfig.brevo, async (_url, options) => { payload = JSON.parse(options.body); return Response.json({ messageId: '<fixture-mail>' }, { status: 201 }); });
    await deliverOne({ config: brevoConfig, database, mailer: httpMailer, logger });
    assert.equal(payload.to[0].email, student.email);
    assert.match(payload.textContent, /reset-password#token=/);
    assert.equal((await database.models.MailJob.findById(job._id)).state, 'sent');
  });
  await t.test('SMTP failures retry with a bounded lease, stable message ID and safe logs', async () => {
    assert.equal((await request('forgot-password', { email: other.email })).status, 202);
    const failing = { async sendMail() { throw new Error('private SMTP credentials and token must never be logged'); } };
    await deliverOne({ config, database, mailer: failing, logger });
    const job = await database.models.MailJob.findOne({ owner: other._id, state: 'pending' });
    assert.equal(job.attempts, 1); assert.ok(job.encrypted); assert.ok(!JSON.stringify(logs).includes('private SMTP'));
    await database.models.MailJob.updateOne({ _id: job._id }, { $set: { nextAttemptAt: new Date(0) } });
    await deliver(); assert.equal((await database.models.MailJob.findById(job._id)).state, 'sent');
  });
});
