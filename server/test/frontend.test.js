import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config/env.js';

test('combined server keeps client routes, API errors and private files separate', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'spendwise-static-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await mkdir(join(directory, 'assets'));
  await writeFile(join(directory, 'index.html'), '<!doctype html><title>SpendWise fixture</title>');
  await writeFile(join(directory, 'assets', 'app-AbCd1234.js'), 'console.log("fixture")');
  await writeFile(join(directory, '.env'), 'PRIVATE_FIXTURE');
  const app = createApp({ config: loadConfig({ NODE_ENV: 'test', SERVE_FRONTEND: 'true' }), frontendDirectory: directory, logger: { info() {}, error() {} } });
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => new Promise((resolve) => { server.closeAllConnections(); server.close(resolve); }));
  const origin = `http://127.0.0.1:${server.address().port}`;
  for (const path of ['/', '/transactions?month=2026-09', '/account', '/index.html']) {
    const response = await fetch(origin + path);
    assert.equal(response.status, 200);
    assert.match(await response.text(), /SpendWise fixture/);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(response.headers.get('cross-origin-opener-policy'), 'same-origin-allow-popups');
  }
  for (const path of ['/api/unknown', '/assets/missing.js', '/.env']) {
    const response = await fetch(origin + path);
    assert.equal(response.status, 404);
    assert.doesNotMatch(await response.text(), /SpendWise fixture|PRIVATE_FIXTURE/);
  }
  assert.equal((await fetch(origin + '/account', { method: 'POST' })).status, 404);
  assert.equal((await fetch(origin + '/account', { headers: { Accept: 'application/json' } })).status, 404);
  assert.equal((await fetch(origin + '/assets/app-AbCd1234.js')).headers.get('cache-control'), 'public, max-age=31536000, immutable');
  assert.equal((await fetch(origin + '/api/health')).status, 200);
  assert.throws(() => createApp({ config: loadConfig({ SERVE_FRONTEND: 'true' }), frontendDirectory: join(directory, 'missing') }), /Frontend build is missing/);
});
