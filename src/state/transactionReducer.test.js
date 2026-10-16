import test from 'node:test';
import assert from 'node:assert/strict';
import { transactionReducer } from './transactionReducer.js';
import { transactions } from '../data/transactions.js';
import { getMonthlySummary } from '../utils/finance.js';
import { getBudgetProgress, getPaymentOccurrences } from '../utils/planning.js';
import { budgets } from '../data/budgets.js';
import { demoToday, recurringPayments } from '../data/recurringPayments.js';

test('add and edit update derived summary and budgets without changing IDs or seed data', () => {
  const record = { id: 'new', date: '2026-10-16', description: 'Lunch', category: 'Food', type: 'expense', amountPaise: 12550 };
  const initial = { records: structuredClone(transactions), lastDeleted: null };
  const added = transactionReducer(initial, { type: 'add', record });
  assert.equal(getMonthlySummary(added.records, '2026-10').expensePaise, 916350);
  assert.equal(getBudgetProgress(budgets, added.records, '2026-10').items.find((item) => item.category === 'Food').spentPaise, 145550);
  const edited = transactionReducer(added, { type: 'update', record: { ...record, amountPaise: 20000 } });
  assert.equal(edited.records.find((entry) => entry.id === 'new').amountPaise, 20000);
  assert.deepEqual(initial.records, transactions);
  assert.equal(initial.records.length, 14);
});

test('delete and undo preserve recurring links, original position, and exact record', () => {
  const initial = { records: structuredClone(transactions), lastDeleted: null };
  const deleted = transactionReducer(initial, { type: 'delete', id: 't02' });
  assert.equal(getPaymentOccurrences(recurringPayments, deleted.records, '2026-10', demoToday).find((item) => item.id === 'rent').status, 'overdue');
  const restored = transactionReducer(deleted, { type: 'undo' });
  assert.deepEqual(restored, initial);
  assert.equal(getPaymentOccurrences(recurringPayments, restored.records, '2026-10', demoToday).find((item) => item.id === 'rent').status, 'paid');
  assert.equal(transactionReducer(restored, { type: 'undo' }), restored);
});

test('unknown deletes and duplicate additions do not lose or duplicate data', () => {
  const initial = { records: transactions, lastDeleted: null };
  assert.equal(transactionReducer(initial, { type: 'delete', id: 'missing' }), initial);
  assert.equal(transactionReducer(initial, { type: 'add', record: transactions[0] }), initial);
  assert.deepEqual(transactionReducer({ records: [], lastDeleted: {} }, { type: 'restore', records: transactions }), initial);
});
