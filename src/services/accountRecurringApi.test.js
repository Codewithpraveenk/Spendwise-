import test from 'node:test';
import assert from 'node:assert/strict';
import { createFinanceApi, loadAccountMonth } from './financeApi.js';
import { getAccountOccurrences } from '../utils/accountRecurring.js';
import { getMonthlySummary } from '../utils/finance.js';

const schedule = { id: '000000000000000000000001', version: 0, name: 'Internet', category: 'Utilities', amountPaise: 59900, dueDay: 31, startMonth: '2026-01', endMonth: null, hasPaymentHistory: false };
const expense = { id: '000000000000000000000002', version: 0, description: 'Internet', type: 'expense', category: 'Utilities', amountPaise: 59900, date: '2026-03-05' };
const payment = { id: '000000000000000000000003', version: 0, schedule: schedule.id, transaction: expense.id, billMonth: '2026-02', expense };
const page = (items) => Response.json({ items, nextCursor: null });

test('schedule and bill lists include history and cross-month expense details', async () => {
  const calls = [];
  const api = createFinanceApi(async (url) => { calls.push(url); return page(url.includes('/recurring?') ? [schedule] : [payment]); });
  assert.deepEqual(await api.listSchedules(), [schedule]);
  assert.deepEqual(await api.listPaymentMonth('2026-02'), [payment]);
  assert.equal(calls[0], '/api/finance/recurring?limit=100');
  assert.match(calls[1], /payments\?month=2026-02/);
});
test('invalid history or missing/wrong linked expenses reject a bill month', async () => {
  await assert.rejects(createFinanceApi(async () => page([{ ...schedule, hasPaymentHistory: undefined }])).listSchedules(), { code: 'INVALID_RESPONSE' });
  for (const record of [{ ...payment, expense: null }, { ...payment, expense: { ...expense, type: 'income', category: 'Allowance' } }, { ...payment, transaction: schedule.id }]) {
    await assert.rejects(createFinanceApi(async () => page([record])).listPaymentMonth('2026-02'), { code: 'INVALID_RESPONSE' });
  }
});
test('schedule saves whitelist editable fields and preserve optimistic versions', async () => {
  const calls = [];
  const api = createFinanceApi(async (url, options) => { calls.push({ url, options }); return Response.json({ item: schedule }); });
  await api.saveSchedule({ ...schedule, owner: 'forged', paidTransactions: { '2026-02': expense.id } }, false);
  await api.saveSchedule(schedule, true);
  const created = JSON.parse(calls[0].options.body);
  assert.equal(created.owner, undefined); assert.equal(created.hasPaymentHistory, undefined); assert.equal(created.paidTransactions, undefined); assert.equal(created.id, undefined);
  assert.equal(created.endMonth, null);
  assert.equal(JSON.parse(calls[1].options.body).version, 0);
});
test('recording sends billing month, actual date, and the reviewed schedule version', async () => {
  let call;
  const api = createFinanceApi(async (url, options) => { call = { url, options }; return Response.json({ payment, transaction: expense, schedule: { ...schedule, version: 1 } }); });
  await api.recordPayment(schedule, '2026-02', '2026-03-05');
  assert.equal(call.url, `/api/finance/recurring/${schedule.id}/payments`);
  assert.deepEqual(JSON.parse(call.options.body), { billMonth: '2026-02', date: '2026-03-05', version: 0 });
  assert.equal(call.options.credentials, 'include');
});
test('recording rejects an unexpected amount after a nominal success', async () => {
  const api = createFinanceApi(async () => Response.json({ payment, transaction: { ...expense, amountPaise: 99900 }, schedule }));
  await assert.rejects(api.recordPayment(schedule, '2026-02', expense.date), { code: 'INVALID_RESPONSE' });
});
test('removal uses versioned payment endpoint rather than direct transaction deletion', async () => {
  let call;
  const api = createFinanceApi(async (url, options) => { call = { url, options }; return new Response(null, { status: 204 }); });
  await api.removePayment(payment);
  assert.equal(call.url, `/api/finance/payments/${payment.id}`);
  assert.deepEqual(JSON.parse(call.options.body), { version: 0 });
  await api.removeSchedule(schedule);
  assert.equal(call.url, `/api/finance/recurring/${schedule.id}`);
});
test('late payment settles its original bill without moving expense totals', () => {
  const items = getAccountOccurrences([schedule], [payment], '2026-02', '2026-03-06');
  assert.equal(items[0].dueDate, '2026-02-28');
  assert.equal(items[0].status, 'paid');
  assert.equal(items[0].paidDate, '2026-03-05');
  assert.equal(items[0].recordedPayment.id, payment.id);
  assert.equal(getMonthlySummary([expense], '2026-02').expensePaise, 0);
  assert.equal(getMonthlySummary([expense], '2026-03').expensePaise, 59900);
});
test('early payments and month-end leap years preserve bill identity', () => {
  const leap = { ...schedule, startMonth: '2024-01' };
  const early = { ...payment, billMonth: '2024-02', expense: { ...expense, date: '2024-01-30' } };
  const items = getAccountOccurrences([leap], [early], '2024-02', '2024-01-31');
  assert.equal(items[0].dueDate, '2024-02-29');
  assert.equal(items[0].status, 'paid');
});
test('unpaid statuses and inactive schedule months stay accurate', () => {
  const entries = [1, 16, 31].map((dueDay) => ({ ...schedule, id: String(dueDay), dueDay }));
  assert.deepEqual(getAccountOccurrences(entries, [], '2026-01', '2026-01-16').map((item) => item.status), ['overdue', 'due-today', 'upcoming']);
  assert.deepEqual(getAccountOccurrences([{ ...schedule, endMonth: '2026-02' }], [], '2026-03', '2026-03-05'), []);
});
test('orphan and duplicate bill links fail rather than becoming unpaid', () => {
  assert.throws(() => getAccountOccurrences([], [payment], '2026-02', '2026-03-06'), { code: 'INVALID_RESPONSE' });
  assert.throws(() => getAccountOccurrences([schedule], [payment, { ...payment, id: expense.id }], '2026-02', '2026-03-06'), { code: 'INVALID_RESPONSE' });
});
test('recurring read failures prevent partial dashboard totals', async () => {
  const api = { listMonth: async () => [], listBudgetMonth: async () => [], listSchedules: async () => [schedule], listPaymentMonth: async () => { throw new Error('Payment storage unavailable'); } };
  await assert.rejects(loadAccountMonth(api, '2026-02', undefined, true), /Payment storage unavailable/);
});
