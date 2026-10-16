import test from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig } from '../src/config/env.js';

test('Render derives only its trusted environment origin and allows an email-disabled preview', () => {
  const config = loadConfig({ NODE_ENV: 'production', MONGODB_URI: 'mongodb://localhost/fixture', RENDER: 'true', RENDER_EXTERNAL_URL: 'https://spendwise-fixture.onrender.com', MAIL_PROVIDER: 'disabled', SMTP_HOST: 'ignored.example.com' });
  assert.equal(config.appOrigin, 'https://spendwise-fixture.onrender.com');
  assert.deepEqual(config.clientOrigins, [config.appOrigin]);
  assert.equal(config.smtp, undefined);
  assert.equal(config.brevo, undefined);
  assert.throws(() => loadConfig({ NODE_ENV: 'production', MONGODB_URI: 'mongodb://localhost/fixture', RENDER: 'true', RENDER_EXTERNAL_URL: 'http://insecure.example.com' }), /HTTPS/);
});

test('frontend serving and trusted proxies require explicit supported values', () => {
  assert.equal(loadConfig({}).serveFrontend, false);
  assert.equal(loadConfig({}).trustProxy, false);
  assert.equal(loadConfig({ TRUST_PROXY: '1' }).trustProxy, 1);
  assert.equal(loadConfig({ TRUST_PROXY: 'loopback' }).trustProxy, 'loopback');
  assert.equal(loadConfig({ SERVE_FRONTEND: 'true' }).serveFrontend, true);
  for (const TRUST_PROXY of ['true', '2', '*']) assert.throws(() => loadConfig({ TRUST_PROXY }), /TRUST_PROXY/);
  assert.throws(() => loadConfig({ SERVE_FRONTEND: 'yes' }), /SERVE_FRONTEND/);
});

test('development defaults support the current local frontend', () => {
  const config = loadConfig({});
  assert.equal(config.port, 5000);
  assert.equal(config.host, '127.0.0.1');
  assert.deepEqual(config.clientOrigins, ['http://localhost:5173', 'http://127.0.0.1:5173']);
  assert.ok(Object.isFrozen(config));
});

test('explicit origins are trimmed and deduplicated', () => {
  const config = loadConfig({ NODE_ENV: 'production', MONGODB_URI: 'mongodb://127.0.0.1:27017/spendwise', PORT: '8080', CLIENT_ORIGINS: 'https://example.com, https://example.com', APP_ORIGIN: 'https://example.com' });
  assert.equal(config.port, 8080);
  assert.equal(config.host, '0.0.0.0');
  assert.deepEqual(config.clientOrigins, ['https://example.com']);
});

test('database configuration is required in production and rejects incorrect schemes', () => {
  assert.throws(() => loadConfig({ NODE_ENV: 'production' }), /MONGODB_URI/);
  assert.throws(() => loadConfig({ MONGODB_URI: 'https://example.com' }), /MONGODB_URI/);
  assert.equal(loadConfig({}).mongodbUri, undefined);
});

test('invalid ports, environments and origins fail before the server starts', () => {
  for (const PORT of ['0', '65536', '5000oops', '3.5', '']) assert.throws(() => loadConfig({ PORT }), /PORT/);
  assert.throws(() => loadConfig({ NODE_ENV: 'unknown' }), /NODE_ENV/);
  assert.throws(() => loadConfig({ HOST: 'http://localhost' }), /HOST/);
  for (const CLIENT_ORIGINS of ['*', '', 'https://example.com/path', 'https://example.com/', 'ftp://example.com', 'https://user:password@example.com']) assert.throws(() => loadConfig({ CLIENT_ORIGINS }), /CLIENT_ORIGINS/);
});
