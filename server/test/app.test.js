import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import express from 'express';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config/env.js';
import { errorHandler } from '../src/middleware/errorHandler.js';
import { requestContext } from '../src/middleware/requestContext.js';

function captureLogger() {
  const entries = [];
  return { entries, info: (entry) => entries.push(entry), error: (entry) => entries.push(entry) };
}

async function listen(t, app) {
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => {
    server.closeAllConnections();
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  });
  const url = `http://127.0.0.1:${server.address().port}`;
  return (path, options = {}) => fetch(`${url}${path}`, { ...options, signal: AbortSignal.timeout(3000) });
}

function appFixture() {
  const logger = captureLogger();
  return { logger, app: createApp({ config: loadConfig({ NODE_ENV: 'test' }), logger }) };
}

test('account routes report unavailable storage without exposing internals', async (t) => {
  const request = await listen(t, appFixture().app);
  const response = await request('/api/auth/me');
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error.code, 'DATABASE_UNAVAILABLE');
  const blocked = await request('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(blocked.status, 403);
});

test('readiness returns 503 without a database and follows database availability', async (t) => {
  const unavailable = await listen(t, appFixture().app);
  assert.equal((await unavailable('/api/ready')).status, 503);
  let ready = true;
  const app = createApp({ config: loadConfig({ NODE_ENV: 'test' }), logger: captureLogger(), database: { isReady: async () => ready } });
  const request = await listen(t, app);
  assert.equal((await request('/api/ready')).status, 200);
  ready = false;
  assert.equal((await request('/api/ready')).status, 503);
});

test('health endpoint returns JSON, request ID, no-store and security headers', async (t) => {
  const { app, logger } = appFixture();
  const request = await listen(t, app);
  const response = await request('/api/health', { headers: { 'X-Request-Id': 'untrusted-input' } });
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.status, 'ok');
  assert.equal(body.service, 'spendwise-api');
  assert.ok(Number.isFinite(Date.parse(body.timestamp)));
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(response.headers.get('x-powered-by'), null);
  assert.match(response.headers.get('x-request-id'), /^[a-f0-9-]{36}$/);
  assert.notEqual(response.headers.get('x-request-id'), 'untrusted-input');
  assert.equal(logger.entries.find((entry) => entry.event === 'request').path, '/api/health');
});

test('allowed browser origin and preflight support credentialed requests', async (t) => {
  const { app } = appFixture();
  const request = await listen(t, app);
  const origin = 'http://127.0.0.1:5173';
  const response = await request('/api/health', { headers: { Origin: origin } });
  await response.text();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('access-control-allow-origin'), origin);
  assert.equal(response.headers.get('access-control-allow-credentials'), 'true');
  const preflight = await request('/api/health', { method: 'OPTIONS', headers: { Origin: origin, 'Access-Control-Request-Method': 'GET' } });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get('access-control-allow-origin'), origin);
});

test('unlisted browser origin gets a structured 403 response', async (t) => {
  const { app } = appFixture();
  const request = await listen(t, app);
  const response = await request('/api/health', { headers: { Origin: 'https://unlisted.example' } });
  const body = await response.json();
  assert.equal(response.status, 403);
  assert.equal(body.error.code, 'ORIGIN_NOT_ALLOWED');
  assert.equal(body.error.requestId, response.headers.get('x-request-id'));
  assert.equal(response.headers.get('access-control-allow-origin'), null);
});

test('unknown routes return JSON and request logs omit query values', async (t) => {
  const { app, logger } = appFixture();
  const request = await listen(t, app);
  const response = await request('/api/missing?token=do-not-log');
  assert.equal(response.status, 404);
  assert.equal((await response.json()).error.code, 'NOT_FOUND');
  assert.equal(logger.entries.find((entry) => entry.event === 'request').path, '/api/missing');
  assert.ok(!JSON.stringify(logger.entries).includes('do-not-log'));
});

test('malformed and oversized JSON are rejected consistently', async (t) => {
  const { app } = appFixture();
  const request = await listen(t, app);
  const malformed = await request('/api/missing', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{invalid' });
  assert.equal(malformed.status, 400);
  assert.equal((await malformed.json()).error.code, 'INVALID_JSON');
  const oversized = await request('/api/missing', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: 'a'.repeat(110 * 1024) }) });
  assert.equal(oversized.status, 413);
  assert.equal((await oversized.json()).error.code, 'PAYLOAD_TOO_LARGE');
});

test('async route errors reach the handler without leaking internals or crashing', async (t) => {
  const logger = captureLogger();
  const app = express();
  app.use(requestContext(logger));
  app.get('/fail', async () => { throw new Error('private-test-details'); });
  app.get('/ok', (req, res) => res.json({ ok: true }));
  app.use(errorHandler(logger));
  const request = await listen(t, app);
  const response = await request('/fail');
  const text = await response.text();
  assert.equal(response.status, 500);
  assert.equal(JSON.parse(text).error.code, 'INTERNAL_ERROR');
  assert.ok(!text.includes('private-test-details'));
  assert.ok(!text.includes('stack'));
  assert.ok(logger.entries.some((entry) => entry.event === 'request_failed'));
  const healthy = await request('/ok');
  assert.equal(healthy.status, 200);
  assert.deepEqual(await healthy.json(), { ok: true });
});
