import test from 'node:test';
import assert from 'node:assert/strict';
import { selectTransactions } from './transactions.js';
import { formatDate, formatINR } from './formatters.js';
import { transactions } from '../data/transactions.js';

test('combined search, month, category and type filters select only matching records', () => {
  const records = selectTransactions(transactions, { month: '2026-10', type: 'expense', category: 'Food', query: '  GROCERIES ' });
  assert.deepEqual(records.map((record) => record.id), ['t06']);
  assert.equal(selectTransactions(transactions, { month: '2026-08' }).length, 0);
  assert.equal(selectTransactions(transactions, { type: 'income', category: 'Food' }).length, 0);
  assert.equal(selectTransactions(transactions, { query: 'no such record' }).length, 0);
  assert.equal(selectTransactions(transactions, { query: 'housing' }).length, 2);
});

test('all sort orders work without changing the shared sample data', () => {
  const before = structuredClone(transactions);
  const newest = selectTransactions(transactions);
  const oldest = selectTransactions(transactions, { sort: 'oldest' });
  const descending = selectTransactions(transactions, { sort: 'amount-desc' });
  const ascending = selectTransactions(transactions, { sort: 'amount-asc' });
  assert.equal(newest[0].id, 't10');
  assert.equal(oldest[0].id, 't11');
  for (let index = 1; index < transactions.length; index++) {
    assert.ok(newest[index - 1].date >= newest[index].date);
    assert.ok(oldest[index - 1].date <= oldest[index].date);
    assert.ok(descending[index - 1].amountPaise >= descending[index].amountPaise);
    assert.ok(ascending[index - 1].amountPaise <= ascending[index].amountPaise);
  }
  assert.deepEqual(transactions, before);
});

test('recent records are restricted to selected month and limited to five', () => {
  const recent = selectTransactions(transactions, { month: '2026-10' }).slice(0, 5);
  assert.deepEqual(recent.map((record) => record.id), ['t10', 't09', 't08', 't07', 't06']);
});

test('equal dates and amounts sort deterministically', () => {
  const records = ['b', 'a'].map((id) => ({ id, date: '2026-10-01', description: 'Sample', category: 'Food', type: 'expense', amountPaise: 100 }));
  for (const sort of ['newest', 'oldest', 'amount-asc', 'amount-desc']) {
    assert.deepEqual(selectTransactions(records, { sort }).map((record) => record.id), ['a', 'b']);
  }
});

test('date-only formatting and Indian currency grouping stay consistent', () => {
  assert.equal(formatDate('2026-10-01'), '1 Oct 2026');
  assert.equal(formatINR(12345678), '₹1,23,456.78');
});
