import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { OAuth2Client } from 'google-auth-library';
import mongoose from 'mongoose';
import { verifiedGoogleClaims } from '../src/auth/google.js';
import { createModels } from '../src/models/index.js';
import { loadConfig } from '../src/config/env.js';

const audience = '123-example.apps.googleusercontent.com';
const nonce = 'a'.repeat(64);
const claims = () => ({ sub: 'google-123', email: 'Student@example.com', name: ' Student ', email_verified: true, nonce, aud: audience, iss: 'https://accounts.google.com', exp: Math.floor(Date.now() / 1000) + 300, iat: Math.floor(Date.now() / 1000) });
test('Google configuration accepts web client IDs and rejects unrelated values', () => {
  assert.equal(loadConfig({ GOOGLE_CLIENT_ID: audience }).googleClientId, audience);
  assert.equal(loadConfig({}).googleClientId, undefined);
  assert.throws(() => loadConfig({ GOOGLE_CLIENT_ID: 'not-a-client' }), /GOOGLE_CLIENT_ID/);
});
test('Google claims require exact audience, issuer, nonce, expiry and verified email', () => {
  assert.deepEqual(verifiedGoogleClaims(claims(), audience, nonce), { sub: 'google-123', email: 'student@example.com', name: 'Student' });
  for (const patch of [{ aud: 'other' }, { iss: 'evil.example' }, { nonce: 'wrong' }, { exp: 1 }, { exp: undefined }, { sub: '' }, { email_verified: false }, { email: 'invalid' }]) assert.throws(() => verifiedGoogleClaims({ ...claims(), ...patch }, audience, nonce), { status: 401, code: 'GOOGLE_TOKEN_INVALID' });
});
test('Google official verifier rejects wrong signatures, audiences, issuers and expired JWTs', async () => {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const client = new OAuth2Client();
  const certificates = { test: publicKey.export({ type: 'spki', format: 'pem' }) };
  const jwt = (payload, key = privateKey) => {
    const input = [Buffer.from(JSON.stringify({ alg: 'RS256', kid: 'test' })).toString('base64url'), Buffer.from(JSON.stringify(payload)).toString('base64url')].join('.');
    return `${input}.${sign('RSA-SHA256', Buffer.from(input), key).toString('base64url')}`;
  };
  const verify = (token) => client.verifySignedJwtWithCertsAsync(token, certificates, audience, ['https://accounts.google.com']);
  assert.equal((await verify(jwt(claims()))).getPayload().sub, 'google-123');
  for (const patch of [{ aud: 'wrong' }, { iss: 'evil.example' }, { exp: Math.floor(Date.now() / 1000) - 600, iat: Math.floor(Date.now() / 1000) - 1000 }]) await assert.rejects(verify(jwt({ ...claims(), ...patch })));
  const wrongKey = generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey;
  await assert.rejects(verify(jwt(claims(), wrongKey)));
});
test('Google-only users need an identity, password accounts remain valid, and identity stays private', async () => {
  const connection = mongoose.createConnection(); const { User } = createModels(connection);
  const user = new User({ name: 'Student', email: 'student@example.com', googleSub: 'google-123' });
  await user.validate();
  assert.equal(user.toJSON().googleSub, undefined);
  await assert.rejects(new User({ name: 'Student', email: 'student@example.com' }).validate());
  await new User({ name: 'Student', email: 'student@example.com', passwordHash: 'existing-hash' }).validate();
});
