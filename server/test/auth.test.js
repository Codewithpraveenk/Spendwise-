import test from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, verifyPassword } from '../src/auth/passwords.js';
import { createSessions } from '../src/auth/sessions.js';

test('password hashes have unique salts and verify exact untrimmed passwords', async () => {
  const password = 'a long password with spaces ';
  const first = await hashPassword(password);
  const second = await hashPassword(password);
  assert.notEqual(first, second);
  assert.equal(await verifyPassword(password, first), true);
  assert.equal(await verifyPassword(password.trim(), first), false);
  assert.equal(await verifyPassword(password, 'invalid'), false);
});

test('production sessions use secure host-only cookies and matching deletion settings', async () => {
  const headers = [];
  const sessions = createSessions({ production: true, models: { Session: { create: async () => {}, deleteOne: async () => {} } } });
  const req = { headers: {} };
  const res = { setHeader: (_name, value) => headers.push(value) };
  await sessions.issue(req, res, { _id: 'test-owner' });
  assert.match(headers[0], /^__Host-spendwise_session=/);
  assert.match(headers[0], /Secure/);
  assert.match(headers[0], /HttpOnly/);
  assert.match(headers[0], /SameSite=Lax/i);
  assert.ok(!headers[0].includes('Domain='));
  await sessions.logout(req, res);
  assert.match(headers[1], /^__Host-spendwise_session=;/);
  assert.match(headers[1], /Max-Age=0/);
  assert.match(headers[1], /Secure/);
});
