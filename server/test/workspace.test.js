import test from 'node:test';
import assert from 'node:assert/strict';
import { validateWorkspace } from '../src/services/workspace.js';

export const fixture = () => ({ version: 2,
  transactions: [{ id: 'local-expense', description: 'Internet', type: 'expense', category: 'Utilities', amountPaise: 59900, date: '2000-01-01' }],
  budgets: [{ id: 'local-budget', month: '2026-10', category: 'Utilities', limitPaise: 100000 }],
  recurringPayments: [{ id: 'local-schedule', name: 'Internet', category: 'Utilities', amountPaise: 59900, dueDay: 31, startMonth: '2026-09', paidTransactions: { '2026-10': 'local-expense' } }],
});
test('workspace import normalizes only documented fields and preserves cross-month links', () => {
  const data = validateWorkspace(fixture());
  assert.equal(data.recurringPayments[0].endMonth, null);
  assert.equal(data.recurringPayments[0].paidTransactions['2026-10'], data.transactions[0].id);
  const extra = fixture(); extra.transactions[0].owner = 'another-user';
  assert.throws(() => validateWorkspace(extra), { status: 400 });
});
test('workspace import rejects invalid money, dates, duplicate IDs/budgets and broken payment links', () => {
  const changes = [
    (w) => { w.transactions[0].amountPaise = 1.5; },
    (w) => { w.transactions[0].date = '2100-01-01'; },
    (w) => { w.transactions.push({ ...w.transactions[0] }); },
    (w) => { w.budgets.push({ ...w.budgets[0], id: 'other' }); },
    (w) => { w.recurringPayments[0].paidTransactions['2026-10'] = 'missing'; },
    (w) => { w.transactions[0].category = 'Food'; },
    (w) => { w.recurringPayments.push({ ...w.recurringPayments[0], id: 'another' }); },
    (w) => { w.recurringPayments[0].endMonth = '2026-09'; },
    (w) => { w.version = 1; },
    (w) => { w.transactions = Array(10001).fill(w.transactions[0]); },
  ];
  for (const change of changes) { const data = fixture(); change(data); assert.throws(() => validateWorkspace(data), { status: 400 }); }
  assert.throws(() => validateWorkspace({ version: 2, transactions: [], budgets: [], recurringPayments: [] }), { status: 400 });
});
