import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { connectDatabase } from '../src/database.js';
import { createFinanceService } from '../src/services/finance.js';

test('real MongoDB persists records and enforces unique indexes', { timeout: 180000 }, async (t) => {
  // This creates a disposable database; it never reads MONGODB_URI or user data.
  const mongo = await MongoMemoryServer.create();
  t.after(() => mongo.stop());
  const database = await connectDatabase(mongo.getUri('spendwise_test'), { autoIndex: true });
  t.after(() => database.close());
  assert.equal(await database.isReady(), true);
  const { User, Transaction, Budget, RecurringPayment, PaymentOccurrence } = database.models;
  const user = await User.create({ name: 'Test student', email: 'student@example.com', passwordHash: 'test-only-placeholder' });
  await assert.rejects(User.create({ name: 'Duplicate', email: 'STUDENT@example.com', passwordHash: 'test' }), { code: 11000 });
  assert.equal((await User.findById(user._id)).passwordHash, undefined);
  const expense = await Transaction.create({ owner: user._id, description: 'Lunch', category: 'Food', type: 'expense', amountPaise: 12500, date: '2026-10-16' });
  assert.equal((await Transaction.findById(expense._id)).amountPaise, 12500);
  const budget = { owner: user._id, month: '2026-10', category: 'Food', limitPaise: 400000 };
  await Budget.create(budget);
  await assert.rejects(Budget.create(budget), { code: 11000 });
  await Budget.create({ ...budget, owner: new mongoose.Types.ObjectId() });
  const schedule = await RecurringPayment.create({ owner: user._id, name: 'Lunch plan', category: 'Food', amountPaise: 12500, dueDay: 16, startMonth: '2026-10' });
  const occurrence = { owner: user._id, schedule: schedule._id, billMonth: '2026-10', transaction: expense._id };
  await PaymentOccurrence.create(occurrence);
  await assert.rejects(PaymentOccurrence.create({ ...occurrence, transaction: new mongoose.Types.ObjectId() }), { code: 11000 });
  await assert.rejects(PaymentOccurrence.create({ ...occurrence, billMonth: '2026-11' }), { code: 11000 });
  // The single-node standalone fixture deliberately cannot perform transactions.
  await assert.rejects(createFinanceService(database).create('transactions', user._id, {
    description: 'Must not save', type: 'expense', category: 'Food', amountPaise: 100, date: '2000-01-01',
  }), { status: 503, code: 'TRANSACTIONS_REQUIRED' });
  assert.equal(await Transaction.countDocuments({ description: 'Must not save' }), 0);
  await database.close();
  assert.equal(await database.isReady(), false);
});
