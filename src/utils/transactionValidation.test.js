import test from 'node:test';
import assert from 'node:assert/strict';
import { isValidDate, isValidTransactionList, parseAmount, validateTransactionForm } from './transactionValidation.js';
import { transactions } from '../data/transactions.js';

test('rupee parser preserves paise and rejects ambiguous or out-of-range inputs', () => {
  assert.equal(parseAmount('0.01'), 1);
  assert.equal(parseAmount('299.05'), 29905);
  assert.equal(parseAmount(' 1250 '), 125000);
  assert.equal(parseAmount('10000000.00'), 1000000000);
  for (const value of ['', '0', '-10', '1.005', '1,000', '1e3', 'Infinity', '10000000.01', '.50']) assert.equal(parseAmount(value), null, value);
});

test('calendar validation rejects impossible dates and accepts leap days', () => {
  assert.equal(isValidDate('2024-02-29'), true);
  for (const date of ['2026-02-29', '2026-04-31', '2026-13-01', '1999-12-31', '2101-01-01', 'not-a-date']) assert.equal(isValidDate(date), false, date);
});

test('form validates required fields, category compatibility and future dates', () => {
  const valid = { description: 'Lunch', amount: '125.50', date: '2026-10-16', type: 'expense', category: 'Food' };
  assert.deepEqual(validateTransactionForm(valid, '2026-10-16'), {});
  const errors = validateTransactionForm({ ...valid, description: ' ', amount: '0', date: '2026-10-17', category: 'Allowance' }, '2026-10-16');
  assert.deepEqual(Object.keys(errors).sort(), ['amount', 'category', 'date', 'description']);
});

test('storage records must be valid, uniquely identified and use integer paise', () => {
  assert.equal(isValidTransactionList(transactions), true);
  assert.equal(isValidTransactionList([]), true);
  assert.equal(isValidTransactionList([...transactions, transactions[0]]), false);
  assert.equal(isValidTransactionList([{ ...transactions[0], amountPaise: 0.5 }]), false);
  assert.equal(isValidTransactionList([{ ...transactions[0], category: 'Food' }]), false);
});
