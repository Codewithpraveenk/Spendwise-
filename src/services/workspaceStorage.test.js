import test from 'node:test';
import assert from 'node:assert/strict';
import { loadWorkspace, saveWorkspace, WORKSPACE_KEY } from './workspaceStorage.js';
import { STORAGE_KEY } from './transactionStorage.js';
import { transactions } from '../data/transactions.js';
import { budgets } from '../data/budgets.js';
import { recurringPayments } from '../data/recurringPayments.js';

const seed = { transactions, budgets, recurringPayments };
const memoryStorage = () => { const map = new Map(); return { getItem: (key) => map.get(key) ?? null, setItem: (key, value) => map.set(key, value) }; };

test('migration preserves edited legacy transactions, including empty workspaces', () => {
  for (const records of [[], [{ ...transactions[0], description: 'User-edited allowance' }]]) {
    const storage = memoryStorage();
    const legacy = JSON.stringify({ version: 1, records });
    storage.setItem(STORAGE_KEY, legacy);
    const loaded = loadWorkspace(storage, seed);
    assert.deepEqual(loaded.records, records);
    assert.equal(saveWorkspace(storage, loaded), true);
    assert.deepEqual(loadWorkspace(storage, seed).records, records);
    assert.equal(storage.getItem(STORAGE_KEY), legacy);
  }
});

test('versioned workspace round-trips all collections and empty lists', () => {
  const storage = memoryStorage();
  const state = { records: [], budgets: [], recurringPayments: [] };
  assert.equal(saveWorkspace(storage, state), true);
  assert.deepEqual(loadWorkspace(storage, seed), { ...state, error: null });
});

test('invalid workspace or duplicate category limits are rejected without overwriting data', () => {
  const storage = memoryStorage();
  storage.setItem(WORKSPACE_KEY, '{invalid');
  assert.equal(loadWorkspace(storage, seed).error, 'read');
  assert.equal(storage.getItem(WORKSPACE_KEY), '{invalid');
  assert.equal(saveWorkspace(storage, { records: transactions, budgets: [...budgets, { ...budgets[0], id: 'other' }], recurringPayments }), false);
  assert.equal(storage.getItem(WORKSPACE_KEY), '{invalid');
});

test('blocked storage and corrupt legacy records report failure without reseeding silently', () => {
  const denied = { getItem() { throw new Error('Denied'); }, setItem() { throw new Error('Quota'); } };
  assert.equal(loadWorkspace(denied, seed).error, 'read');
  assert.equal(saveWorkspace(denied, { records: transactions, budgets, recurringPayments }), false);
  const storage = memoryStorage();
  storage.setItem(STORAGE_KEY, '{broken');
  assert.equal(loadWorkspace(storage, seed).error, 'read');
  assert.equal(storage.getItem(WORKSPACE_KEY), null);
});
