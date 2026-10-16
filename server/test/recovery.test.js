import test from 'node:test';
import assert from 'node:assert/strict';
import { encryptMail, decryptMail, createMailer } from '../src/mail/delivery.js';
import { loadConfig } from '../src/config/env.js';

test('queued email content is authenticated, encrypted and cannot be read with another key', () => {
  const content = { subject: 'Reset password', text: 'a private one-time link' }; const key = 'a'.repeat(64);
  const first = encryptMail(content, key); const second = encryptMail(content, key);
  assert.notEqual(first, second); assert.ok(!first.includes(content.text));
  assert.deepEqual(decryptMail(first, key), content);
  assert.throws(() => decryptMail(first, 'b'.repeat(64)));
  const parts = first.split('.'); parts[1] = Buffer.alloc(16).toString('base64url');
  assert.throws(() => decryptMail(parts.join('.'), key));
});
test('SMTP configuration requires complete credentials, encryption key and trusted application origin', () => {
  const base = { SMTP_HOST: 'smtp.example.com', SMTP_PORT: '465', SMTP_SECURE: 'true', SMTP_USER: 'sender@example.com', SMTP_PASSWORD: 'fixture-only', MAIL_FROM: 'sender@example.com', MAIL_ENCRYPTION_KEY: 'a'.repeat(64) };
  assert.equal(loadConfig(base).smtp.port, 465);
  assert.equal(createMailer(loadConfig({})), null);
  for (const patch of [{ SMTP_PASSWORD: '' }, { MAIL_ENCRYPTION_KEY: '' }, { MAIL_ENCRYPTION_KEY: 'invalid' }, { SMTP_PORT: 'wrong' }, { SMTP_SECURE: 'yes' }, { MAIL_FROM: 'injected\r\naddress' }]) assert.throws(() => loadConfig({ ...base, ...patch }));
  assert.throws(() => loadConfig({ APP_ORIGIN: 'https://attacker.example' }), /APP_ORIGIN/);
  assert.throws(() => loadConfig({ NODE_ENV: 'production', MONGODB_URI: 'mongodb://localhost/test' }), /APP_ORIGIN/);
});
