import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTransactions, saveTransactions, STORAGE_KEY } from './transactionStorage.js';
import { transactions } from '../data/transactions.js';

function memoryStorage() {
  const entries = new Map();
  return { getItem: (key) => entries.get(key) ?? null, setItem: (key, value) => entries.set(key, value) };
}

test('new workspace seeds once and saved empty workspace stays empty', () => {
  const storage = memoryStorage();
  const initial = loadTransactions(storage, transactions);
  assert.deepEqual(initial.records, transactions);
  assert.notEqual(initial.records, transactions);
  assert.equal(saveTransactions(storage, []), true);
  assert.deepEqual(loadTransactions(storage, transactions), { records: [], error: null });
});

test('valid records round-trip without changing amount or IDs', () => {
  const storage = memoryStorage();
  assert.equal(saveTransactions(storage, transactions), true);
  assert.deepEqual(loadTransactions(storage, []).records, transactions);
});

test('corrupt and unsupported data is not overwritten during loading', () => {
  for (const raw of ['{broken', JSON.stringify({ version: 2, records: transactions }), JSON.stringify({ version: 1, records: [{}] })]) {
    const storage = memoryStorage();
    storage.setItem(STORAGE_KEY, raw);
    assert.equal(loadTransactions(storage, transactions).error, 'read');
    assert.equal(storage.getItem(STORAGE_KEY), raw);
  }
});

test('blocked storage is reported without throwing or claiming a save', () => {
  const storage = { getItem() { throw new Error('Denied'); }, setItem() { throw new Error('Quota exceeded'); } };
  assert.equal(loadTransactions(storage, transactions).error, 'read');
  assert.equal(saveTransactions(storage, transactions), false);
  assert.equal(saveTransactions(memoryStorage(), [{}]), false);
});
