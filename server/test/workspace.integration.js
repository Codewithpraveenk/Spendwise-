import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { connectDatabase } from '../src/database.js';
import { loadConfig } from '../src/config/env.js';
import { createApp } from '../src/app.js';

const fixture = () => ({ version: 2,
  transactions: [{ id: 'expense', description: 'Internet', type: 'expense', category: 'Utilities', amountPaise: 59900, date: '2000-01-01' }],
  budgets: [{ id: 'budget', month: '2026-10', category: 'Utilities', limitPaise: 100000 }],
  recurringPayments: [{ id: 'schedule', name: 'Internet', category: 'Utilities', amountPaise: 59900, dueDay: 31, startMonth: '2026-09', paidTransactions: { '2026-10': 'expense' } }],
});
test('account workspace exports and initial imports preserve isolation and atomicity', { timeout: 180000 }, async (t) => {
  const mongo = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
  t.after(() => mongo.stop());
  const database = await connectDatabase(mongo.getUri('workspace_test'), { autoIndex: true });
  t.after(() => database.close());
  const server = createApp({ config: loadConfig({ NODE_ENV: 'test' }), database, logger: { info() {}, error() {} } }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); });
  const request = async (path, { method = 'GET', body, cookie, unsafe = false } = {}) => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api${path}`, { method, signal: AbortSignal.timeout(20000), headers: { 'Content-Type': 'application/json', ...(!unsafe ? { 'X-Spendwise-Request': '1' } : {}), ...(cookie ? { Cookie: cookie } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: response.status, body: response.status === 204 ? null : await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0] };
  };
  const register = async (name) => (await request('/auth/register', { method: 'POST', body: { name, email: `${name}@example.com`, password: 'fictional integration password 123' } })).cookie;
  const alice = await register('alice'); const bob = await register('bob');
  const workspace = fixture(); const requestId = randomUUID();
  await t.test('requires authentication and protects workspace writes from unsafe requests', async () => {
    assert.equal((await request('/workspace')).status, 401);
    assert.equal((await request('/workspace/preview', { method: 'POST', cookie: alice, unsafe: true, body: { workspace } })).status, 403);
    assert.equal((await request('/workspace?owner=other', { cookie: alice })).status, 400);
  });
  await t.test('preview saves nothing and invalid links are rejected', async () => {
    const preview = await request('/workspace/preview', { method: 'POST', cookie: alice, body: { workspace } });
    assert.equal(preview.body.canImport, true);
    assert.deepEqual(preview.body.counts, { transactions: 1, budgets: 1, schedules: 1, payments: 1 });
    assert.equal(await database.models.Transaction.countDocuments(), 0);
    const broken = fixture(); broken.recurringPayments[0].paidTransactions['2026-10'] = 'missing';
    assert.equal((await request('/workspace/import', { method: 'POST', cookie: alice, body: { workspace: broken, requestId } })).status, 400);
    assert.equal(await database.models.Transaction.countDocuments(), 0);
  });
  await t.test('concurrent retries create one workspace and one receipt with regenerated IDs', async () => {
    const responses = await Promise.all([1, 2].map(() => request('/workspace/import', { method: 'POST', cookie: alice, body: { workspace, requestId } })));
    assert.deepEqual(responses.map((item) => item.status), [200, 200]);
    assert.deepEqual(responses.map((item) => item.body.replayed).sort(), [false, true]);
    for (const name of ['Transaction', 'Budget', 'RecurringPayment', 'PaymentOccurrence', 'WorkspaceImport']) assert.equal(await database.models[name].countDocuments(), 1);
    assert.notEqual(String((await database.models.Transaction.findOne())._id), 'expense');
  });
  await t.test('snapshot preserves early payment links and excludes other accounts and private fields', async () => {
    const exported = (await request('/workspace', { cookie: alice })).body.workspace;
    assert.equal(exported.transactions[0].date, '2000-01-01');
    assert.equal(exported.recurringPayments[0].paidTransactions['2026-10'], exported.transactions[0].id);
    assert.equal(exported.transactions[0].owner, undefined);
    assert.equal(exported.transactions[0].version, undefined);
    assert.equal((await request('/workspace', { cookie: bob })).body.workspace.transactions.length, 0);
    assert.equal((await request('/workspace/preview', { method: 'POST', cookie: alice, body: { workspace } })).body.canImport, false);
  });
  await t.test('new import IDs and changed payloads cannot bypass one-time import protection', async () => {
    assert.equal((await request('/workspace/import', { method: 'POST', cookie: alice, body: { workspace, requestId: randomUUID() } })).status, 409);
    const changed = fixture(); changed.transactions[0].description = 'Changed';
    assert.equal((await request('/workspace/import', { method: 'POST', cookie: alice, body: { workspace: changed, requestId } })).status, 409);
    assert.equal(await database.models.Transaction.countDocuments(), 1);
  });
  await t.test('an exported workspace can be imported into another empty account with links remapped', async () => {
    const dave = await register('dave');
    const exported = (await request('/workspace', { cookie: alice })).body.workspace;
    const result = await request('/workspace/import', { method: 'POST', cookie: dave, body: { workspace: exported, requestId: randomUUID() } });
    assert.equal(result.status, 200);
    const restored = (await request('/workspace', { cookie: dave })).body.workspace;
    assert.notEqual(restored.transactions[0].id, exported.transactions[0].id);
    assert.equal(restored.recurringPayments[0].paidTransactions['2026-10'], restored.transactions[0].id);
  });
  await t.test('workspace parser accepts validated backups above the normal 100 KB API limit', async () => {
    const workspace = { version: 2, transactions: Array.from({ length: 800 }, (_, index) => ({ id: `record-${index}`, description: 'A fictional transaction for verifying the account import size limit', type: 'expense', category: 'Food', amountPaise: 100, date: '2000-01-01' })), budgets: [], recurringPayments: [] };
    assert.ok(Buffer.byteLength(JSON.stringify({ workspace })) > 100 * 1024);
    const result = await request('/workspace/preview', { method: 'POST', cookie: alice, body: { workspace } });
    assert.equal(result.status, 200);
    assert.equal(result.body.counts.transactions, 800);
    assert.equal(result.body.canImport, false);
    const oversized = await request('/workspace/preview', { method: 'POST', cookie: alice, body: { workspace, padding: 'x'.repeat(5 * 1024 * 1024) } });
    assert.equal(oversized.status, 413);
    assert.match(oversized.body.error.message, /5 MB/);
  });
  await t.test('nonempty accounts cannot import and concurrent normal writes serialize with imports', async () => {
    const expense = { description: 'Lunch', type: 'expense', category: 'Food', amountPaise: 100, date: '2000-01-01' };
    const responses = await Promise.all([
      request('/finance/transactions', { method: 'POST', cookie: bob, body: expense }),
      request('/workspace/import', { method: 'POST', cookie: bob, body: { workspace, requestId: randomUUID() } }),
    ]);
    assert.equal(responses[0].status, 201);
    assert.ok([200, 409].includes(responses[1].status));
    const data = (await request('/workspace', { cookie: bob })).body.workspace;
    assert.equal(data.transactions.length, responses[1].status === 200 ? 2 : 1);
    assert.equal((await request('/workspace/import', { method: 'POST', cookie: bob, body: { workspace, requestId: randomUUID() } })).status, 409);
  });
  await t.test('a database failure rolls back financial records and the import receipt', async () => {
    const carol = await register('carol');
    const user = await database.models.User.findOne({ email: 'carol@example.com' });
    const save = database.models.WorkspaceImport.create;
    database.models.WorkspaceImport.create = async () => { throw new Error('simulated receipt write failure'); };
    try { assert.equal((await request('/workspace/import', { method: 'POST', cookie: carol, body: { workspace, requestId: randomUUID() } })).status, 500); }
    finally { database.models.WorkspaceImport.create = save; }
    for (const name of ['Transaction', 'Budget', 'RecurringPayment', 'PaymentOccurrence', 'WorkspaceImport']) assert.equal(await database.models[name].countDocuments({ owner: user._id }), 0);
  });
});
