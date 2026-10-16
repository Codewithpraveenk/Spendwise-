import test from 'node:test';
import assert from 'node:assert/strict';
import { createFinanceApi, loadAccountMonth } from './financeApi.js';
import { getMonthlySummary, getMonthlySpending } from '../utils/finance.js';
import { getBudgetProgress } from '../utils/planning.js';

const budget = { id: '000000000000000000000001', version: 0, month: '2000-01', category: 'Food', limitPaise: 10000 };
const transaction = { id: '000000000000000000000002', version: 0, date: '2000-01-01', category: 'Food', type: 'expense', amountPaise: 12550, description: 'Lunch' };
const page = (items, nextCursor = null) => Response.json({ items, nextCursor });

test('budget pages are owner-session requests and empty plans stay empty', async () => {
  let call;
  const api = createFinanceApi(async (url, options) => { call = { url, options }; return page([]); });
  assert.deepEqual(await api.listBudgetMonth('2000-01'), []);
  assert.match(call.url, /^\/api\/finance\/budgets\?month=2000-01&limit=100$/);
  assert.equal(call.options.credentials, 'include');
});
test('budget responses reject incompatible months, fractional limits and duplicate categories', async () => {
  for (const records of [[{ ...budget, month: '2000-02' }], [{ ...budget, limitPaise: 1.5 }], [{ ...budget, version: undefined }], [budget, { ...budget, id: '000000000000000000000003' }]]) {
    await assert.rejects(createFinanceApi(async () => page(records)).listBudgetMonth('2000-01'), { code: 'INVALID_RESPONSE' });
  }
});
test('budget pagination validates all pages before returning limits', async () => {
  let calls = 0;
  const second = { ...budget, category: 'Transport', id: '000000000000000000000003' };
  const api = createFinanceApi(async () => ++calls === 1 ? page([budget], budget.id) : page([second]));
  assert.deepEqual(await api.listBudgetMonth('2000-01'), [budget, second]);
});
test('budget creation whitelists editable fields and updates carry the captured version', async () => {
  const calls = [];
  const api = createFinanceApi(async (url, options) => { calls.push({ url, options }); return Response.json({ item: budget }); });
  await api.saveBudget({ ...budget, owner: 'forged', spentPaise: 12550 }, false);
  await api.saveBudget({ ...budget, spentPaise: 12550 }, true);
  assert.deepEqual(JSON.parse(calls[0].options.body), { month: '2000-01', category: 'Food', limitPaise: 10000 });
  assert.equal(calls[0].options.method, 'POST');
  assert.equal(calls[1].options.method, 'PUT');
  assert.equal(JSON.parse(calls[1].options.body).version, 0);
  assert.equal(calls[1].options.headers['X-Spendwise-Request'], '1');
});
test('budget deletion sends a version and never calls transaction deletion', async () => {
  const calls = [];
  const api = createFinanceApi(async (url, options) => { calls.push({ url, options }); return new Response(null, { status: 204 }); });
  await api.removeBudget(budget);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, `/api/finance/budgets/${budget.id}`);
  assert.equal(calls[0].options.method, 'DELETE');
  assert.deepEqual(JSON.parse(calls[0].options.body), { version: 0 });
});
test('an account month rejects partial success when either collection fails', async () => {
  for (const failing of ['transactions', 'budgets']) {
    const api = {
      listMonth: async () => { if (failing === 'transactions') throw new Error('Unavailable'); return [transaction]; },
      listBudgetMonth: async () => { if (failing === 'budgets') throw new Error('Unavailable'); return [budget]; },
    };
    await assert.rejects(loadAccountMonth(api, '2000-01'), /Unavailable/);
  }
});
test('account summaries, categories, and budget progress reconcile from the same loaded records', async () => {
  const income = { ...transaction, id: '000000000000000000000004', type: 'income', category: 'Allowance', amountPaise: 100000 };
  const transport = { ...transaction, id: '000000000000000000000005', category: 'Transport', amountPaise: 5000 };
  const api = createFinanceApi(async (url) => url.includes('/budgets?') ? page([budget]) : page([transaction, income, transport]));
  const loaded = await loadAccountMonth(api, '2000-01');
  const summary = getMonthlySummary(loaded.transactions, '2000-01');
  const spending = getMonthlySpending(loaded.transactions, '2000-01');
  const progress = getBudgetProgress(loaded.budgets, loaded.transactions, '2000-01');
  assert.deepEqual(summary, { incomePaise: 100000, expensePaise: 17550, netPaise: 82450, transactionCount: 3 });
  assert.equal(spending.totalPaise, summary.expensePaise);
  assert.equal(progress.spentPaise + progress.unbudgetedPaise, summary.expensePaise);
  assert.equal(progress.items[0].status, 'over');
  assert.equal(progress.remainingPaise, -2550);
});
test('budget failures preserve authentication and stale-edit status without retrying writes', async () => {
  for (const status of [401, 409, 503]) {
    let calls = 0;
    const api = createFinanceApi(async () => { calls++; return Response.json({ error: { message: 'Unavailable', code: 'TEST' } }, { status }); });
    await assert.rejects(api.saveBudget(budget, true), { status });
    assert.equal(calls, 1);
  }
});
