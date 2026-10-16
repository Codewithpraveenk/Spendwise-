import test from 'node:test';
import assert from 'node:assert/strict';
import { getBudgetProgress, getPaymentOccurrences } from './planning.js';
import { budgets } from '../data/budgets.js';
import { demoToday, recurringPayments } from '../data/recurringPayments.js';
import { transactions } from '../data/transactions.js';

test('budgets reconcile to expenses and keep category overspending visible', () => {
  const result = getBudgetProgress(budgets, transactions, '2026-10');
  assert.equal(result.limitPaise, 1000000);
  assert.equal(result.spentPaise, 903800);
  assert.equal(result.remainingPaise, 96200);
  assert.equal(result.items.find((item) => item.category === 'Education').status, 'over');
  assert.equal(result.items.find((item) => item.category === 'Education').percentage, 125);
  assert.equal(result.items.find((item) => item.category === 'Housing').status, 'at-limit');
  assert.equal(result.items.find((item) => item.category === 'Food').status, 'within');
  const september = getBudgetProgress(budgets, transactions, '2026-09');
  assert.equal(september.remainingPaise, -610000);
});

test('unplanned expenses are separate from planned-category spending and income', () => {
  const records = [
    { date: '2026-10-01', category: 'Food', type: 'expense', amountPaise: 8000 },
    { date: '2026-10-02', category: 'Health', type: 'expense', amountPaise: 5000 },
    { date: '2026-10-02', category: 'Food', type: 'income', amountPaise: 50000 },
  ];
  const plans = [{ id: 'food', month: '2026-10', category: 'Food', limitPaise: 10000 }];
  const result = getBudgetProgress(plans, records, '2026-10');
  assert.equal(result.spentPaise, 8000);
  assert.equal(result.items[0].status, 'near');
  assert.equal(result.unbudgetedPaise, 5000);
  assert.equal(result.unbudgeted[0].category, 'Health');
  const noPlan = getBudgetProgress([], records, '2026-10');
  assert.equal(noPlan.unbudgetedPaise, 13000);
  assert.equal(noPlan.items.length, 0);
});

test('empty month has no plan or scheduled payments before their start', () => {
  assert.deepEqual(getBudgetProgress(budgets, transactions, '2026-08').items, []);
  assert.deepEqual(getPaymentOccurrences(recurringPayments, transactions, '2026-08', demoToday), []);
});

test('payment statuses derive from reference date and linked expenses', () => {
  const before = structuredClone(transactions);
  const items = getPaymentOccurrences(recurringPayments, transactions, '2026-10', demoToday);
  const find = (id) => items.find((item) => item.id === id);
  assert.equal(items.length, 6);
  assert.equal(find('rent').status, 'paid');
  assert.equal(find('rent').paidDate, '2026-10-02');
  assert.equal(find('gym').status, 'overdue');
  assert.equal(find('cloud').status, 'due-today');
  assert.equal(find('wifi').status, 'upcoming');
  assert.equal(items.filter((item) => item.status !== 'paid').reduce((sum, item) => sum + item.amountPaise, 0), 134800);
  assert.deepEqual(transactions, before);
});

test('missing, future and income payment links cannot mark a bill paid', () => {
  const schedule = { id: 'sample', name: 'Sample', category: 'Food', amountPaise: 100, dueDay: 10, startMonth: '2026-01', paidTransactions: { '2026-10': 'linked' } };
  for (const record of [
    { id: 'other', type: 'expense', date: '2026-10-01' },
    { id: 'linked', type: 'expense', date: '2026-10-17' },
    { id: 'linked', type: 'income', date: '2026-10-01' },
  ]) assert.equal(getPaymentOccurrences([schedule], [record], '2026-10', demoToday)[0].status, 'overdue');
});

test('month-end due dates respect leap years and schedule end month', () => {
  const schedule = { id: 'month-end', dueDay: 31, startMonth: '2024-01', endMonth: '2026-02', paidTransactions: {} };
  assert.equal(getPaymentOccurrences([schedule], [], '2024-02', demoToday)[0].dueDate, '2024-02-29');
  assert.equal(getPaymentOccurrences([schedule], [], '2026-02', demoToday)[0].dueDate, '2026-02-28');
  assert.deepEqual(getPaymentOccurrences([schedule], [], '2026-03', demoToday), []);
});
