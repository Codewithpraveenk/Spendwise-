import test from 'node:test';
import assert from 'node:assert/strict';
import { createBrevoMailer } from '../src/mail/brevo.js';
import { loadConfig } from '../src/config/env.js';

test('Brevo uses HTTPS JSON, accepts only acknowledged mail and hides provider failures', async () => {
  const calls = [];
  const settings = { apiKey: 'fixture-private-key', from: 'sender@example.com' };
  const mailer = createBrevoMailer(settings, async (url, options) => {
    calls.push({ url, options }); return Response.json({ messageId: '<fixture>' }, { status: 201 });
  });
  const outcome = await mailer.sendMail({ to: 'student@example.com', subject: 'Recovery', text: 'private link' });
  assert.deepEqual(outcome.accepted, ['student@example.com']);
  assert.equal(calls[0].url, 'https://api.brevo.com/v3/smtp/email');
  assert.equal(calls[0].options.redirect, 'error');
  assert.equal(calls[0].options.headers['api-key'], settings.apiKey);
  assert.deepEqual(JSON.parse(calls[0].options.body), { sender: { name: 'SpendWise', email: settings.from }, to: [{ email: 'student@example.com' }], subject: 'Recovery', textContent: 'private link' });
  await mailer.verify();
  assert.equal(calls[1].url, 'https://api.brevo.com/v3/account');
  assert.equal(calls[1].options.body, undefined);
  for (const request of [async () => Response.json({ message: 'private provider detail' }, { status: 429 }), async () => { throw new Error(settings.apiKey); }, async () => Response.json({})]) {
    await assert.rejects(createBrevoMailer(settings, request).sendMail({ to: 'a@example.com' }), (error) => !error.message.includes(settings.apiKey) && !error.message.includes('private provider detail'));
  }
});

test('Brevo selection requires private credentials and ignores unused SMTP configuration', () => {
  const base = { MAIL_PROVIDER: 'brevo', BREVO_API_KEY: 'fixture-key', MAIL_FROM: 'sender@example.com', MAIL_ENCRYPTION_KEY: 'a'.repeat(64), SMTP_HOST: 'unused.example.com' };
  assert.equal(loadConfig(base).brevo.from, base.MAIL_FROM);
  assert.equal(loadConfig(base).smtp, undefined);
  for (const patch of [{ BREVO_API_KEY: '' }, { MAIL_FROM: '' }, { MAIL_ENCRYPTION_KEY: '' }, { MAIL_PROVIDER: 'unknown' }]) assert.throws(() => loadConfig({ ...base, ...patch }));
});
