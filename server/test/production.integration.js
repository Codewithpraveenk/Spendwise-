import test from 'node:test';
import assert from 'node:assert/strict';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { connectDatabase } from '../src/database.js';
import { MongoRateLimitStore } from '../src/middleware/mongoRateLimitStore.js';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config/env.js';

test('production counters are atomic, shared across servers and survive app recreation', { timeout: 180000 }, async (t) => {
  // Disposable fixture only: never loads the application's private .env.
  const mongo = await MongoMemoryServer.create();
  t.after(() => mongo.stop());
  const database = await connectDatabase(mongo.getUri('production_test'), { autoIndex: true });
  t.after(() => database.close());
  let now = 10000;
  const store = new MongoRateLimitStore(database.models.RateLimitBucket, 'fixture', () => now);
  store.init({ windowMs: 1000 });
  const results = await Promise.all(Array.from({ length: 20 }, () => store.increment('client')));
  assert.deepEqual(results.map((r) => r.totalHits).sort((a, b) => a - b), Array.from({ length: 20 }, (_, i) => i + 1));
  now += 1000;
  assert.equal((await store.increment('client')).totalHits, 1);
  await store.decrement('client');
  await store.decrement('client');
  assert.equal((await store.increment('client')).totalHits, 1);
  await store.resetKey('client');
  assert.equal((await store.increment('client')).totalHits, 1);
  const indexes = await database.models.RateLimitBucket.collection.indexes();
  assert.ok(indexes.some((index) => index.key.resetTime === 1 && index.expireAfterSeconds === 0));
  const config = loadConfig({ NODE_ENV: 'production', MONGODB_URI: mongo.getUri(), CLIENT_ORIGINS: 'https://example.com', APP_ORIGIN: 'https://example.com', SERVE_FRONTEND: 'false' });
  async function start() {
    const app = createApp({ config, database, logger: { info() {}, error() {} } });
    const server = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    t.after(() => new Promise((resolve) => { server.closeAllConnections(); server.close(resolve); }));
    return `http://127.0.0.1:${server.address().port}`;
  }
  const origins = [await start(), await start()];
  const login = (origin) => fetch(origin + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Spendwise-Request': '1' }, body: '{}' });
  for (let i = 0; i < 10; i++) assert.equal((await login(origins[i % 2])).status, 400);
  assert.equal((await login(origins[0])).status, 429);
  assert.equal((await login(await start())).status, 429);
  const brokenStore = new MongoRateLimitStore({ async findOneAndUpdate() { throw new Error('private database detail'); } }, 'broken');
  brokenStore.init({ windowMs: 1000 });
  await assert.rejects(brokenStore.increment('client'), { status: 503, code: 'RATE_LIMIT_UNAVAILABLE' });
});
