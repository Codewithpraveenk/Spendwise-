import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { createModels, categories } from '../src/models/index.js';
import { categoriesByType } from '../../src/data/categories.js';

const connection = mongoose.createConnection();
const models = createModels(connection);
const owner = new mongoose.Types.ObjectId();
const expense = { owner, description: 'Lunch', type: 'expense', category: 'Food', amountPaise: 12500, date: '2026-10-16' };

test('server categories match the frontend categories', () => assert.deepEqual(categories, categoriesByType));

test('transactions validate category, real dates, owner and integer paise', async () => {
  await new models.Transaction(expense).validate();
  for (const patch of [{ owner: undefined }, { category: 'Allowance' }, { amountPaise: 1.5 }, { amountPaise: 0 }, { amountPaise: 1_000_000_001 }, { date: '2026-02-29' }, { date: '2026-04-31' }]) {
    await assert.rejects(new models.Transaction({ ...expense, ...patch }).validate(), mongoose.Error.ValidationError);
  }
  await new models.Transaction({ ...expense, date: '2028-02-29' }).validate();
  assert.throws(() => new models.Transaction({ ...expense, unexpected: true }), /strict mode/);
});

test('recurring schedules validate month range and due day', async () => {
  const base = { owner, name: 'Internet', category: 'Utilities', amountPaise: 59900, dueDay: 31, startMonth: '2026-10' };
  await new models.RecurringPayment(base).validate();
  for (const patch of [{ dueDay: 32 }, { dueDay: 1.5 }, { endMonth: '2026-09' }, { startMonth: '2026-13' }]) {
    await assert.rejects(new models.RecurringPayment({ ...base, ...patch }).validate());
  }
});

test('user JSON omits password hashes and rejects plaintext password fields', async () => {
  const user = new models.User({ name: 'Student', email: ' STUDENT@example.com ', passwordHash: 'test-hash-only' });
  await user.validate();
  assert.equal(user.email, 'student@example.com');
  assert.equal(user.toJSON().passwordHash, undefined);
  assert.throws(() => new models.User({ password: 'plaintext' }), /strict mode/);
});
