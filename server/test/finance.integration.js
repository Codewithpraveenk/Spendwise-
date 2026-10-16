import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config/env.js';
import { connectDatabase } from '../src/database.js';

test('financial APIs enforce ownership, versions, and atomic payments', { timeout: 180000 }, async (t) => {
  const mongo = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
  t.after(() => mongo.stop());
  const database = await connectDatabase(mongo.getUri('finance_test'), { autoIndex: true });
  t.after(() => database.close());
  const server = createApp({ config: loadConfig({ NODE_ENV: 'test' }), database, logger: { info() {}, error() {} } }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); });
  const request = async (path, { method = 'GET', body, cookie, headers = {} } = {}) => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api${path}`, {
      method, signal: AbortSignal.timeout(15000),
      headers: { 'Content-Type': 'application/json', 'X-Spendwise-Request': '1', ...(cookie ? { Cookie: cookie } : {}), ...headers },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    const text = await response.text();
    return { status: response.status, body: text ? JSON.parse(text) : null, headers: response.headers };
  };
  async function register(email) {
    const response = await request('/auth/register', { method: 'POST', body: { name: 'Test Student', email, password: 'fictional test password 123' } });
    assert.equal(response.status, 201);
    return response.headers.get('set-cookie').split(';')[0];
  }
  const alice = await register('alice@example.com');
  const bob = await register('bob@example.com');
  const expense = { description: 'Lunch', type: 'expense', category: 'Food', amountPaise: 12500, date: '2000-01-01' };
  const budget = { category: 'Food', month: '2026-10', limitPaise: 400000 };
  const recurring = { name: 'Internet', category: 'Utilities', amountPaise: 59900, dueDay: 31, startMonth: '2026-10' };
  const records = {};
  await t.test('requires authentication and rejects unsafe writes', async () => {
    assert.equal((await request('/finance/transactions')).status, 401);
    assert.equal((await request('/finance/transactions', { method: 'POST', cookie: alice, body: expense, headers: { 'X-Spendwise-Request': '' } })).status, 403);
    assert.equal((await request('/finance/transactions', { method: 'POST', cookie: alice, body: expense, headers: { 'Sec-Fetch-Site': 'cross-site' } })).status, 403);
  });
  await t.test('creates, lists, reads, edits and deletes each owned collection', async () => {
    for (const [kind, values] of Object.entries({ transactions: expense, budgets: budget, recurring })) {
      const created = await request(`/finance/${kind}`, { method: 'POST', cookie: alice, body: values });
      assert.equal(created.status, 201, JSON.stringify(created.body));
      const record = created.body.item;
      assert.equal(record.version, 0);
      assert.equal(record.owner, undefined);
      const listed = await request(`/finance/${kind}`, { cookie: alice });
      assert.equal(listed.body.items[0].id, record.id);
      assert.equal(listed.headers.get('cache-control'), 'no-store');
      assert.equal((await request(`/finance/${kind}/${record.id}`, { cookie: alice })).status, 200);
      const edited = await request(`/finance/${kind}/${record.id}`, { method: 'PUT', cookie: alice, body: { ...values, version: 0 } });
      assert.equal(edited.status, 200);
      assert.equal(edited.body.item.version, 1);
      assert.equal((await request(`/finance/${kind}/${record.id}`, { method: 'PUT', cookie: alice, body: { ...values, version: 0 } })).status, 409);
      assert.equal((await request(`/finance/${kind}/${record.id}`, { method: 'DELETE', cookie: alice, body: { version: 0 } })).status, 409);
      assert.equal((await request(`/finance/${kind}/${record.id}`, { method: 'DELETE', cookie: alice, body: { version: 1 } })).status, 204);
      records[kind] = (await request(`/finance/${kind}`, { method: 'POST', cookie: alice, body: values })).body.item;
    }
  });
  await t.test('other accounts cannot list, read, edit, delete or pay owned records', async () => {
    for (const [kind, values] of Object.entries({ transactions: expense, budgets: budget, recurring })) {
      const id = records[kind].id;
      assert.deepEqual((await request(`/finance/${kind}`, { cookie: bob })).body.items, []);
      assert.equal((await request(`/finance/${kind}/${id}`, { cookie: bob })).status, 404);
      assert.equal((await request(`/finance/${kind}/${id}`, { method: 'PUT', cookie: bob, body: { ...values, version: 0 } })).status, 404);
      assert.equal((await request(`/finance/${kind}/${id}`, { method: 'DELETE', cookie: bob, body: { version: 0 } })).status, 404);
    }
    assert.equal((await request(`/finance/recurring/${records.recurring.id}/payments`, { method: 'POST', cookie: bob, body: { billMonth: '2026-10', date: '2000-01-01', version: 0 } })).status, 404);
    assert.equal((await request('/finance/budgets', { method: 'POST', cookie: bob, body: budget })).status, 201);
  });
  await t.test('strictly validates payloads, IDs and list query parameters', async () => {
    for (const patch of [{ owner: 'forged' }, { amountPaise: '12500' }, { amountPaise: 1.1 }, { amountPaise: 0 }, { date: '2026-02-29' }, { date: '2100-12-31' }, { type: 'toString' }, { category: { $ne: null } }]) {
      assert.equal((await request('/finance/transactions', { method: 'POST', cookie: alice, body: { ...expense, ...patch } })).status, 400);
    }
    for (const suffix of ['?limit=101', '?month=2026-13', '?cursor=bad', '?owner=forged', '?month=2026-10&month=2026-11']) {
      assert.equal((await request(`/finance/transactions${suffix}`, { cookie: alice })).status, 400);
    }
    assert.equal((await request('/finance/transactions/invalid', { cookie: alice })).status, 400);
    assert.equal((await request('/finance/budgets', { method: 'POST', cookie: alice, body: budget })).status, 409);
    assert.equal((await request('/finance/recurring', { method: 'POST', cookie: alice, body: { ...recurring, endMonth: '2026-09' } })).status, 400);
  });
  await t.test('paginates without duplicate records and filters by month', async () => {
    await request('/finance/transactions', { method: 'POST', cookie: alice, body: { ...expense, date: '2000-02-01' } });
    const first = (await request('/finance/transactions?limit=1', { cookie: alice })).body;
    assert.ok(first.nextCursor);
    const second = (await request(`/finance/transactions?limit=1&cursor=${first.nextCursor}`, { cookie: alice })).body;
    assert.notEqual(first.items[0].id, second.items[0].id);
    assert.equal(second.nextCursor, null);
    const filtered = (await request('/finance/transactions?month=2000-01', { cookie: alice })).body;
    assert.equal(filtered.items.length, 1);
    assert.equal(filtered.items[0].date, '2000-01-01');
    assert.equal((await request('/finance/recurring?month=2026-09', { cookie: alice })).body.items.length, 0);
  });
  let payment;
  await t.test('two simultaneous edits cannot overwrite each other silently', async () => {
    const id = records.transactions.id;
    const results = await Promise.all(['First edit', 'Second edit'].map((description) => request(`/finance/transactions/${id}`, { method: 'PUT', cookie: alice, body: { ...expense, description, version: 0 } })));
    assert.deepEqual(results.map((result) => result.status).sort(), [200, 409]);
    assert.equal((await request(`/finance/transactions/${id}`, { cookie: alice })).body.item.version, 1);
  });
  await t.test('rejects inactive bill months without saving an expense', async () => {
    const before = await database.models.Transaction.countDocuments();
    const response = await request(`/finance/recurring/${records.recurring.id}/payments`, { method: 'POST', cookie: alice, body: { billMonth: '2026-09', date: '2000-01-01', version: 0 } });
    assert.equal(response.status, 400);
    assert.equal(await database.models.Transaction.countDocuments(), before);
    assert.equal((await database.models.RecurringPayment.findById(records.recurring.id)).__v, 0);
  });
  await t.test('concurrent recordings create exactly one expense and payment', async () => {
    const before = await database.models.Transaction.countDocuments();
    const results = await Promise.all([1, 2].map(() => request(`/finance/recurring/${records.recurring.id}/payments`, { method: 'POST', cookie: alice, body: { billMonth: '2026-10', date: '2000-01-01', version: 0 } })));
    assert.deepEqual(results.map((result) => result.status).sort(), [201, 409]);
    const saved = results.find((result) => result.status === 201).body;
    payment = saved.payment;
    records.recurring = saved.schedule;
    assert.equal(saved.transaction.amountPaise, recurring.amountPaise);
    assert.equal(await database.models.Transaction.countDocuments(), before + 1);
    assert.equal(await database.models.PaymentOccurrence.countDocuments(), 1);
    assert.equal((await request('/finance/payments?month=2026-10', { cookie: alice })).body.items.length, 1);
    const listedPayment = (await request('/finance/payments?month=2026-10', { cookie: alice })).body.items[0];
    assert.equal(listedPayment.expense.date, '2000-01-01');
    assert.equal(listedPayment.expense.owner, undefined);
    const listedSchedule = (await request('/finance/recurring', { cookie: alice })).body.items[0];
    assert.equal(listedSchedule.hasPaymentHistory, true);
    assert.deepEqual((await request('/finance/payments', { cookie: bob })).body.items, []);
    assert.equal((await request(`/finance/payments/${payment.id}`, { cookie: bob })).status, 404);
    assert.equal((await request(`/finance/payments/${payment.id}`, { method: 'DELETE', cookie: bob, body: { version: 0 } })).status, 404);
    assert.equal((await request(`/finance/transactions/${saved.transaction.id}`, { method: 'PUT', cookie: alice, body: { ...expense, version: 0 } })).status, 409);
    assert.equal((await request(`/finance/transactions/${saved.transaction.id}`, { method: 'DELETE', cookie: alice, body: { version: 0 } })).status, 409);
    assert.equal((await request(`/finance/recurring/${records.recurring.id}`, { method: 'DELETE', cookie: alice, body: { version: saved.schedule.version } })).status, 409);
    assert.equal((await request(`/finance/recurring/${records.recurring.id}`, { method: 'PUT', cookie: alice, body: { ...recurring, version: saved.schedule.version, amountPaise: 1 } })).status, 409);
  });
  await t.test('recording requires the reviewed schedule version and never uses stale details', async () => {
    const before = await database.models.Transaction.countDocuments();
    for (const version of [undefined, 999]) {
      const response = await request(`/finance/recurring/${records.recurring.id}/payments`, { method: 'POST', cookie: alice, body: { billMonth: '2026-11', date: '2000-01-01', ...(version === undefined ? {} : { version }) } });
      assert.equal(response.status, version === undefined ? 400 : 409);
    }
    assert.equal(await database.models.Transaction.countDocuments(), before);
  });
  await t.test('final-month edits preserve paid history and prevent future occurrences', async () => {
    const id = records.recurring.id;
    const values = { ...recurring, version: records.recurring.version };
    assert.equal((await request(`/finance/recurring/${id}`, { method: 'PUT', cookie: alice, body: { ...values, endMonth: '2026-09' } })).status, 400);
    const stopped = await request(`/finance/recurring/${id}`, { method: 'PUT', cookie: alice, body: { ...values, endMonth: '2026-11' } });
    assert.equal(stopped.status, 200);
    records.recurring = stopped.body.item;
    assert.equal(await database.models.PaymentOccurrence.countDocuments(), 1);
    assert.equal((await request('/finance/recurring?month=2026-12', { cookie: alice })).body.items.length, 0);
    assert.equal((await request(`/finance/recurring/${id}/payments`, { method: 'POST', cookie: alice, body: { billMonth: '2026-12', date: '2000-01-01', version: records.recurring.version } })).status, 400);
  });
  await t.test('a database rejection rolls back both expense and schedule changes', async () => {
    const before = await database.models.Transaction.countDocuments();
    const scheduleBefore = await database.models.RecurringPayment.findById(records.recurring.id);
    const collection = database.models.PaymentOccurrence.collection.collectionName;
    await database.connection.db.command({ collMod: collection, validator: { billMonth: { $ne: '2026-11' } }, validationLevel: 'strict' });
    try {
      const response = await request(`/finance/recurring/${records.recurring.id}/payments`, { method: 'POST', cookie: alice, body: { billMonth: '2026-11', date: '2000-01-01', version: records.recurring.version } });
      assert.equal(response.status, 500);
      assert.equal(response.body.error.code, 'INTERNAL_ERROR');
      assert.equal(await database.models.Transaction.countDocuments(), before);
      assert.equal((await database.models.RecurringPayment.findById(records.recurring.id)).__v, scheduleBefore.__v);
      assert.equal(await database.models.PaymentOccurrence.countDocuments(), 1);
    } finally { await database.connection.db.command({ collMod: collection, validator: {} }); }
  });
  await t.test('removing a payment removes its expense and allows re-recording', async () => {
    assert.equal((await request(`/finance/payments/${payment.id}`, { method: 'DELETE', cookie: alice, body: { version: 0 } })).status, 204);
    assert.equal(await database.models.Transaction.exists({ _id: payment.transaction }), null);
    assert.equal(await database.models.PaymentOccurrence.countDocuments(), 0);
    const latest = (await request(`/finance/recurring/${records.recurring.id}`, { cookie: alice })).body.item;
    const response = await request(`/finance/recurring/${records.recurring.id}/payments`, { method: 'POST', cookie: alice, body: { billMonth: '2026-10', date: '2000-01-01', version: latest.version } });
    assert.equal(response.status, 201);
  });
});
