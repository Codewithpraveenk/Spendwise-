import test from 'node:test';
import assert from 'node:assert/strict';
import { createBackup, createTransactionsCsv, describeBackup, MAX_BACKUP_BYTES, parseBackup } from './workspaceBackup.js';
import { workspaceReducer } from '../state/workspaceReducer.js';
import { transactions } from '../data/transactions.js';
import { budgets } from '../data/budgets.js';
import { recurringPayments } from '../data/recurringPayments.js';

const workspace = () => ({ version: 2, transactions: structuredClone(transactions), budgets: structuredClone(budgets), recurringPayments: structuredClone(recurringPayments) });
const stateFrom = (data) => ({ records: data.transactions, budgets: data.budgets, recurringPayments: data.recurringPayments, lastDeleted: null });

test('full backup round-trip preserves money, dates, budgets and payment links', () => {
  const data = workspace();
  const text = createBackup(data, '2026-10-16T00:00:00Z');
  assert.equal(JSON.parse(text).app, 'SpendWise');
  assert.deepEqual(parseBackup(text), data);
  assert.deepEqual(parseBackup(`\uFEFF${text}`), data);
});

test('invalid JSON, wrong formats, oversized content and invalid records are rejected', () => {
  assert.throws(() => parseBackup('{broken'), /valid JSON/);
  assert.throws(() => parseBackup(JSON.stringify({ app: 'Another app', formatVersion: 1 })), /supported/);
  assert.throws(() => parseBackup(' '.repeat(MAX_BACKUP_BYTES + 1)), /5 MB/);
  const data = workspace();
  data.transactions.push(data.transactions[0]);
  assert.throws(() => parseBackup(JSON.stringify({ app: 'SpendWise', formatVersion: 1, workspace: data })), /invalid or duplicate/);
  assert.throws(() => createBackup(data), /invalid/);
});

test('unknown imported fields are discarded without losing known records', () => {
  const data = workspace();
  data.transactions[0].unexpected = 'discard';
  data.extra = { unnecessary: true };
  const parsed = parseBackup(JSON.stringify({ app: 'SpendWise', formatVersion: 1, workspace: data }));
  assert.equal(parsed.extra, undefined);
  assert.equal(parsed.transactions[0].unexpected, undefined);
  assert.equal(parsed.transactions[0].amountPaise, transactions[0].amountPaise);
});

test('empty backups stay empty and missing payment links are previewed rather than invented', () => {
  const empty = { version: 2, transactions: [], budgets: [], recurringPayments: [] };
  assert.deepEqual(parseBackup(createBackup(empty)), empty);
  const data = workspace();
  data.transactions = [];
  assert.equal(describeBackup(data).missingLinks, 4);
});

test('CSV escapes commas, quotes and newlines and neutralizes spreadsheet formulas', () => {
  const record = { ...transactions[0], description: 'Allowance, "October"\nnotes' };
  const csv = createTransactionsCsv([record]);
  assert.ok(csv.startsWith('\uFEFF"Date","Description"'));
  assert.ok(csv.includes('"Allowance, ""October""\nnotes"'));
  assert.ok(csv.endsWith(',15000.00\r\n'));
  for (const description of ['=1+1', '+SUM(A1)', '-1+2', '@SUM(A1)', '  =1', '\t=2']) {
    assert.ok(createTransactionsCsv([{ ...record, description }]).includes(`"'${description}"`));
  }
  assert.equal(createTransactionsCsv([]).split('\r\n').length, 2);
});

test('restore is one immutable replacement and undo restores the previous visible workspace', () => {
  const old = stateFrom(workspace());
  const replacement = { version: 2, transactions: [transactions[0]], budgets: [], recurringPayments: [] };
  const restored = workspaceReducer(old, { type: 'workspace-import', workspace: replacement });
  assert.equal(restored.records.length, 1);
  assert.equal(restored.budgets.length, 0);
  assert.equal(old.records.length, 14);
  const undone = workspaceReducer(restored, { type: 'workspace-undo-import' });
  assert.deepEqual(undone.records, old.records);
  assert.deepEqual(undone.budgets, old.budgets);
  assert.deepEqual(undone.recurringPayments, old.recurringPayments);
  assert.equal(undone.lastImport, null);
  assert.equal(workspaceReducer(old, { type: 'workspace-import', workspace: {} }), old);
});

test('a later edit ends restore undo so it cannot silently discard the edit', () => {
  const restored = workspaceReducer(stateFrom(workspace()), { type: 'workspace-import', workspace: workspace() });
  const changed = workspaceReducer(restored, { type: 'update', record: { ...transactions[0], description: 'Edited after import' } });
  assert.equal(changed.lastImport, null);
  assert.equal(workspaceReducer(changed, { type: 'workspace-undo-import' }), changed);
});
