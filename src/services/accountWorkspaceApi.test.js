import test from 'node:test';
import assert from 'node:assert/strict';
import { createAccountWorkspaceApi, checkedWorkspace, workspaceCounts } from './accountWorkspaceApi.js';

const fixture = () => ({ version: 2, transactions: [{ id: 'expense', description: 'Internet', type: 'expense', category: 'Utilities', amountPaise: 59900, date: '2000-01-01' }], budgets: [], recurringPayments: [{ id: 'schedule', name: 'Internet', category: 'Utilities', amountPaise: 59900, dueDay: 31, startMonth: '2026-09', paidTransactions: { '2026-10': 'expense' } }] });
const response = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
const zero = { transactions: 0, budgets: 0, schedules: 0, payments: 0 };
test('account export requests private server data and strips metadata', async () => {
  const workspace = fixture(); workspace.transactions[0].owner = 'private-owner';
  const api = createAccountWorkspaceApi(async (path, options) => {
    assert.equal(path, '/api/workspace'); assert.equal(options.credentials, 'include'); assert.equal(options.method, 'GET');
    return response({ workspace });
  });
  assert.equal((await api.export()).transactions[0].owner, undefined);
});
test('empty account backups are valid exports', async () => {
  const workspace = { version: 2, transactions: [], budgets: [], recurringPayments: [] };
  assert.deepEqual(await createAccountWorkspaceApi(async () => response({ workspace })).export(), workspace);
});
test('incomplete or mismatched payment links cannot become a confirmed account backup', async () => {
  for (const change of [(w) => { w.transactions = []; }, (w) => { w.transactions[0].amountPaise = 1; }, (w) => { w.transactions[0].type = 'income'; w.transactions[0].category = 'Gift'; }]) {
    const workspace = fixture(); change(workspace);
    await assert.rejects(createAccountWorkspaceApi(async () => response({ workspace })).export(), { code: 'INVALID_RESPONSE' });
  }
});
test('preview sends only the explicitly selected workspace and checks counts', async () => {
  const workspace = fixture();
  const api = createAccountWorkspaceApi(async (path, options) => {
    assert.equal(path, '/api/workspace/preview'); assert.equal(options.headers['X-Spendwise-Request'], '1');
    assert.deepEqual(JSON.parse(options.body), { workspace });
    return response({ counts: workspaceCounts(workspace), current: zero, canImport: true });
  });
  assert.equal((await api.preview(workspace)).canImport, true);
});
test('preview rejects misleading counts and nonempty accounts marked eligible', async () => {
  const workspace = fixture();
  for (const data of [{ counts: zero, current: zero, canImport: true }, { counts: workspaceCounts(workspace), current: { ...zero, transactions: 1 }, canImport: true }]) {
    await assert.rejects(createAccountWorkspaceApi(async () => response(data)).preview(workspace), { code: 'INVALID_RESPONSE' });
  }
});
test('safe retries retain the same import request ID and validate receipts', async () => {
  const workspace = fixture(); const requests = [];
  const api = createAccountWorkspaceApi(async (path, options) => {
    assert.equal(path, '/api/workspace/import'); requests.push(JSON.parse(options.body));
    return response({ counts: workspaceCounts(workspace), replayed: requests.length > 1 });
  });
  assert.equal((await api.import(workspace, 'same-request')).replayed, false);
  assert.equal((await api.import(workspace, 'same-request')).replayed, true);
  assert.deepEqual(requests[0], requests[1]);
  await assert.rejects(createAccountWorkspaceApi(async () => response({ counts: zero, replayed: false })).import(workspace, 'request'), { code: 'INVALID_RESPONSE' });
});
test('authentication, conflicts and network failures propagate without automatically retrying imports', async () => {
  for (const status of [401, 409, 503]) {
    await assert.rejects(createAccountWorkspaceApi(async () => response({ error: { message: 'Unavailable', code: 'TEST' } }, status)).import(fixture(), 'request'), { status, code: 'TEST' });
  }
  let calls = 0;
  await assert.rejects(createAccountWorkspaceApi(async () => { calls++; throw new Error('offline'); }).import(fixture(), 'request'), { code: 'NETWORK_ERROR' });
  assert.equal(calls, 1);
});
test('duplicate links and invalid data are rejected before a request is sent', async () => {
  const workspace = fixture(); workspace.recurringPayments.push({ ...workspace.recurringPayments[0], id: 'other' });
  assert.throws(() => checkedWorkspace(workspace), { code: 'INVALID_RESPONSE' });
  let called = false;
  await assert.rejects(createAccountWorkspaceApi(async () => { called = true; }).preview(workspace));
  assert.equal(called, false);
});
