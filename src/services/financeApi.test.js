import test from 'node:test';
import assert from 'node:assert/strict';
import { createFinanceApi, transactionFailure } from './financeApi.js';
import { ApiError } from './authApi.js';

const record = { id: '000000000000000000000001', version: 0, description: 'Lunch', type: 'expense', category: 'Food', amountPaise: 12500, date: '2000-01-01' };
const page = (items, nextCursor = null) => Response.json({ items, nextCursor });

test('account month loads all cursor pages with cookies and a bounded page size', async () => {
  const calls = [];
  const second = { ...record, id: '000000000000000000000002' };
  const api = createFinanceApi(async (url, options) => { calls.push({ url, options }); return calls.length === 1 ? page([second], second.id) : page([record]); });
  assert.deepEqual(await api.listMonth('2000-01'), [second, record]);
  assert.match(calls[0].url, /month=2000-01&limit=100/);
  assert.match(calls[1].url, /cursor=000000000000000000000002/);
  assert.equal(calls[0].options.credentials, 'include');
});
test('empty account months stay empty without fictional seeding', async () => {
  assert.deepEqual(await createFinanceApi(async () => page([])).listMonth('2000-01'), []);
});
test('invalid, duplicate and out-of-month records reject the whole month', async () => {
  for (const data of [page([{ ...record, version: undefined }]), page([record, record]), page([{ ...record, date: '2000-02-01' }]), page([], 'not-an-id')]) {
    await assert.rejects(createFinanceApi(async () => data).listMonth('2000-01'), { code: 'INVALID_RESPONSE' });
  }
  await assert.rejects(createFinanceApi(async () => page([])).listMonth('2000-13'), { status: 400 });
});
test('failed later pages do not return partial month totals', async () => {
  let count = 0;
  const api = createFinanceApi(async () => ++count === 1 ? page([record], record.id) : Response.json({ error: { code: 'DATABASE_UNAVAILABLE', message: 'Unavailable' } }, { status: 503 }));
  await assert.rejects(api.listMonth('2000-01'), { status: 503, code: 'DATABASE_UNAVAILABLE' });
});
test('create strips client IDs, owner fields and versions; update submits the captured version', async () => {
  const calls = [];
  const api = createFinanceApi(async (url, options) => { calls.push({ url, options }); return Response.json({ item: record }); });
  await api.save({ ...record, owner: 'forged' }, false);
  await api.save(record, true);
  assert.equal(calls[0].options.method, 'POST');
  assert.equal(calls[0].options.headers['X-Spendwise-Request'], '1');
  assert.deepEqual(Object.keys(JSON.parse(calls[0].options.body)).sort(), ['amountPaise', 'category', 'date', 'description', 'type']);
  assert.equal(calls[1].options.method, 'PUT');
  assert.equal(JSON.parse(calls[1].options.body).version, 0);
  assert.match(calls[1].url, new RegExp(record.id));
});
test('delete uses versioned JSON and accepts a 204', async () => {
  let options;
  const api = createFinanceApi(async (_url, input) => { options = input; return new Response(null, { status: 204 }); });
  await api.remove(record);
  assert.equal(options.method, 'DELETE');
  assert.deepEqual(JSON.parse(options.body), { version: 0 });
});
test('unauthenticated and conflict responses preserve their status', async () => {
  for (const status of [401, 409]) {
    await assert.rejects(createFinanceApi(async () => Response.json({ error: { code: 'TEST', message: 'Denied' } }, { status })).save(record, true), { status });
  }
});
test('uncertain mutations are never automatically retried', async () => {
  let calls = 0;
  const api = createFinanceApi(async () => { calls++; throw new Error('private connection details'); });
  await assert.rejects(api.save(record, false), (error) => error.code === 'NETWORK_ERROR' && !error.message.includes('private'));
  assert.equal(calls, 1);
  for (const status of [0, 409, 500, 503]) assert.equal(transactionFailure(new ApiError('Failed', { status })).requiresReload, true);
  assert.equal(transactionFailure(new ApiError('Invalid input', { status: 400 })).requiresReload, false);
});
test('timed-out and cancelled reads cannot silently succeed', async () => {
  const fetcher = (_url, { signal }) => new Promise((_resolve, reject) => {
    if (signal.aborted) reject(new DOMException('Aborted', 'AbortError'));
    else signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
  });
  await assert.rejects(createFinanceApi(fetcher, 10).listMonth('2000-01'), /timed out/);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(createFinanceApi(fetcher).listMonth('2000-01', controller.signal), { name: 'AbortError' });
});
