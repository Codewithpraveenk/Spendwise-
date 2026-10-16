import test from 'node:test';
import assert from 'node:assert/strict';
import { workspaceReducer, recordPayment } from './workspaceReducer.js';
import { transactions } from '../data/transactions.js';
import { budgets } from '../data/budgets.js';
import { recurringPayments, demoToday } from '../data/recurringPayments.js';
import { getPaymentOccurrences, getBudgetProgress } from '../utils/planning.js';
import { getMonthlySummary } from '../utils/finance.js';
import { selectTransactions } from '../utils/transactions.js';

const initial = () => ({ records: structuredClone(transactions), budgets: structuredClone(budgets), recurringPayments: structuredClone(recurringPayments), lastDeleted: null });
const payment = { type: 'payment-record', scheduleId: 'cloud', month: '2026-10', date: demoToday, today: demoToday };

test('payment recording atomically creates one expense and its occurrence link', () => {
  const before = initial();
  const result = workspaceReducer(before, payment);
  assert.equal(result.records.length, 15);
  assert.equal(getMonthlySummary(result.records, '2026-10').expensePaise, 918700);
  assert.equal(getPaymentOccurrences(result.recurringPayments, result.records, '2026-10', demoToday).find((entry) => entry.id === 'cloud').status, 'paid');
  assert.equal(getBudgetProgress(result.budgets, result.records, '2026-10').items.find((entry) => entry.category === 'Subscriptions').spentPaise, 20800);
  assert.equal(before.records.length, 14);
  assert.deepEqual(before.recurringPayments.find((entry) => entry.id === 'cloud').paidTransactions, {});
  const linkedId = result.recurringPayments.find((entry) => entry.id === 'cloud').paidTransactions['2026-10'];
  assert.equal(selectTransactions(result.records, { id: linkedId }).length, 1);
});

test('duplicate submissions and existing changed links cannot create a second expense', () => {
  const once = workspaceReducer(initial(), payment);
  assert.equal(workspaceReducer(once, payment), once);
  const linked = once.recurringPayments.find((entry) => entry.id === 'cloud').paidTransactions['2026-10'];
  const modified = workspaceReducer(once, { type: 'update', record: { ...once.records.find((entry) => entry.id === linked), type: 'income', category: 'Gift' } });
  assert.ok(recordPayment(modified, payment).error);
  assert.equal(workspaceReducer(modified, payment), modified);
});

test('deleting and re-recording a linked payment cannot later duplicate it through undo', () => {
  const once = workspaceReducer(initial(), payment);
  const id = once.recurringPayments.find((entry) => entry.id === 'cloud').paidTransactions['2026-10'];
  const deleted = workspaceReducer(once, { type: 'delete', id });
  assert.equal(deleted.recurringPayments.length, 6);
  const again = workspaceReducer(deleted, payment);
  assert.equal(again.lastDeleted, null);
  const undone = workspaceReducer(again, { type: 'undo' });
  assert.equal(undone.records.filter((record) => record.id === id).length, 1);
  // Also covers replacing a deleted legacy sample expense with a new linked ID.
  const rentDeleted = workspaceReducer(initial(), { type: 'delete', id: 't02' });
  const rentRecorded = workspaceReducer(rentDeleted, { ...payment, scheduleId: 'rent' });
  assert.equal(rentRecorded.lastDeleted, null);
});

test('late payment belongs to payment-date expense month and settles the original bill month', () => {
  const state = initial();
  state.recurringPayments.find((entry) => entry.id === 'rent').paidTransactions = {};
  const result = workspaceReducer(state, { ...payment, scheduleId: 'rent', month: '2026-09' });
  assert.equal(getMonthlySummary(result.records, '2026-09').expensePaise, 1610000);
  assert.equal(getMonthlySummary(result.records, '2026-10').expensePaise, 1453800);
  assert.equal(getPaymentOccurrences(result.recurringPayments, result.records, '2026-09', demoToday)[0].status, 'paid');
});

test('invalid dates, future dates and inactive schedule months leave state unchanged', () => {
  const state = initial();
  for (const action of [{ ...payment, date: '2026-10-17' }, { ...payment, date: '2026-02-30' }, { ...payment, month: '2026-08' }, { ...payment, scheduleId: 'missing' }]) assert.equal(workspaceReducer(state, action), state);
});

test('early payments settle a future bill and count only in the actual payment month', () => {
  const state = workspaceReducer(initial(), { ...payment, month: '2026-11' });
  assert.equal(getPaymentOccurrences(state.recurringPayments, state.records, '2026-11', demoToday).find((entry) => entry.id === 'cloud').status, 'paid');
  assert.equal(getMonthlySummary(state.records, '2026-11').expensePaise, 0);
  assert.equal(getMonthlySummary(state.records, '2026-10').expensePaise, 918700);
});

test('budget editing rejects duplicates, respects month boundaries and leaves expenses unchanged', () => {
  const state = initial();
  const food = state.budgets.find((entry) => entry.month === '2026-10' && entry.category === 'Food');
  const edited = workspaceReducer(state, { type: 'budget-save', budget: { ...food, limitPaise: 150000 } });
  assert.equal(edited.budgets.find((entry) => entry.id === food.id).limitPaise, 150000);
  assert.equal(edited.budgets.find((entry) => entry.month === '2026-09' && entry.category === 'Food').limitPaise, 200000);
  assert.equal(workspaceReducer(edited, { type: 'budget-save', budget: { ...food, id: 'duplicate' } }), edited);
  assert.equal(workspaceReducer(edited, { type: 'budget-save', budget: { ...food, limitPaise: 0 } }), edited);
  const removed = workspaceReducer(edited, { type: 'budget-delete', id: food.id });
  assert.equal(getBudgetProgress(removed.budgets, removed.records, '2026-10').unbudgetedPaise, 133000);
  assert.deepEqual(removed.records, state.records);
});

test('schedule editing preserves payment links and cannot hide linked history', () => {
  const state = initial();
  const rent = state.recurringPayments[0];
  const edited = workspaceReducer(state, { type: 'schedule-save', schedule: { ...rent, name: 'Updated rent', amountPaise: 600000, paidTransactions: {} } });
  assert.deepEqual(edited.recurringPayments[0].paidTransactions, rent.paidTransactions);
  assert.deepEqual(edited.records, state.records);
  assert.equal(workspaceReducer(state, { type: 'schedule-save', schedule: { ...rent, startMonth: '2026-11' } }), state);
  const removed = workspaceReducer(edited, { type: 'schedule-delete', id: rent.id });
  assert.equal(removed.recurringPayments.length, 5);
  assert.deepEqual(removed.records, state.records);
});
