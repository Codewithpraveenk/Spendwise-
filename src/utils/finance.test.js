import test from 'node:test';
import assert from 'node:assert/strict';
import { getMonthlySpending, getMonthlySummary } from './finance.js';
import { transactions } from '../data/transactions.js';

test('daily and category expenses reconcile with monthly cards, excluding income', () => {
  for (const month of ['2026-10', '2026-09', '2026-08']) {
    const spending = getMonthlySpending(transactions, month);
    const summary = getMonthlySummary(transactions, month);
    assert.equal(spending.totalPaise, summary.expensePaise);
    assert.equal(spending.categories.reduce((sum, entry) => sum + entry.amountPaise, 0), summary.expensePaise);
  }
  const october = getMonthlySpending(transactions, '2026-10');
  assert.equal(october.totalPaise, 903800);
  assert.equal(october.categories[0].category, 'Housing');
  assert.equal(october.categories.find((entry) => entry.category === 'Food').amountPaise, 133000);
  assert.ok(Math.abs(october.categories.reduce((sum, entry) => sum + entry.percentage, 0) - 100) < 0.000001);
});

test('multiple expenses on one day aggregate, without including another month or income', () => {
  const records = [
    { date: '2024-02-29', type: 'expense', category: 'Food', amountPaise: 10025 },
    { date: '2024-02-29', type: 'expense', category: 'Food', amountPaise: 20050 },
    { date: '2024-02-29', type: 'income', category: 'Work', amountPaise: 90000 },
    { date: '2024-03-01', type: 'expense', category: 'Food', amountPaise: 50000 },
  ];
  const result = getMonthlySpending(records, '2024-02');
  assert.equal(result.daily.length, 29);
  assert.equal(result.daily[28].amountPaise, 30075);
  assert.equal(result.totalPaise, 30075);
  assert.equal(result.categories.length, 1);
  assert.equal(result.categories[0].percentage, 100);
});

test('empty months retain a full calendar and never produce invalid percentages', () => {
  for (const [month, days] of [['2026-02', 28], ['2026-09', 30], ['2026-10', 31]]) {
    const result = getMonthlySpending([], month);
    assert.equal(result.daily.length, days);
    assert.equal(result.totalPaise, 0);
    assert.deepEqual(result.categories, []);
    assert.ok(result.daily.every((entry) => entry.amountPaise === 0));
  }
});
