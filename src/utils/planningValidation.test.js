import test from 'node:test';
import assert from 'node:assert/strict';
import { validateBudgetForm, validateScheduleForm, isValidScheduleList } from './planningValidation.js';
import { budgets } from '../data/budgets.js';
import { recurringPayments } from '../data/recurringPayments.js';
import { formatMonth } from './formatters.js';

test('budget form rejects duplicates and zero limits but allows editing the same budget', () => {
  const values = { month: '2026-10', category: 'Food', amount: '2000' };
  assert.ok(validateBudgetForm(values, budgets).category);
  assert.deepEqual(validateBudgetForm(values, budgets, '2026-10-Food'), {});
  assert.ok(validateBudgetForm({ ...values, amount: '0' }, []).amount);
  assert.ok(validateBudgetForm({ ...values, month: '2026-13' }, []).month);
});

test('schedule form rejects invalid due days, date ranges and lost payment history', () => {
  const values = { name: 'Wi-Fi', category: 'Utilities', amount: '499', dueDay: '31', startMonth: '2026-10', endMonth: '' };
  assert.deepEqual(validateScheduleForm(values), {});
  assert.ok(validateScheduleForm({ ...values, dueDay: '32' }).dueDay);
  assert.ok(validateScheduleForm({ ...values, dueDay: '1.5' }).dueDay);
  assert.ok(validateScheduleForm({ ...values, endMonth: '2026-09' }).endMonth);
  assert.ok(validateScheduleForm(values, { '2026-09': 'paid' }).startMonth);
  assert.ok(validateScheduleForm({ ...values, endMonth: '2026-10' }, { '2026-11': 'paid' }).endMonth);
});

test('one expense cannot be linked to multiple bill occurrences in stored schedules', () => {
  assert.equal(isValidScheduleList(recurringPayments), true);
  const changed = structuredClone(recurringPayments);
  changed[1].paidTransactions['2026-10'] = 't02';
  assert.equal(isValidScheduleList(changed), false);
});

test('month labels support future months without requiring a sample record', () => {
  assert.equal(formatMonth('2026-11'), 'November 2026');
});
