import { loadTransactions } from './transactionStorage.js';
import { isValidWorkspace } from '../utils/workspaceValidation.js';
export { isValidWorkspace } from '../utils/workspaceValidation.js';

export const WORKSPACE_KEY = 'spendwise.workspace.v2';

export function loadWorkspace(storage, seed) {
  try {
    const raw = storage.getItem(WORKSPACE_KEY);
    if (raw !== null) {
      const data = JSON.parse(raw);
      if (!isValidWorkspace(data)) throw new Error('Invalid workspace');
      return { records: data.transactions, budgets: data.budgets, recurringPayments: data.recurringPayments, error: null };
    }
    // Preserve the old transaction list, including deliberate empty lists.
    // The legacy key is retained; no existing records are reseeded during migration.
    const previous = loadTransactions(storage, seed.transactions);
    return { records: previous.records, budgets: structuredClone(seed.budgets), recurringPayments: structuredClone(seed.recurringPayments), error: previous.error };
  } catch {
    return { records: structuredClone(seed.transactions), budgets: structuredClone(seed.budgets), recurringPayments: structuredClone(seed.recurringPayments), error: 'read' };
  }
}

export function saveWorkspace(storage, state) {
  const data = { version: 2, transactions: state.records, budgets: state.budgets, recurringPayments: state.recurringPayments };
  try {
    if (!isValidWorkspace(data)) return false;
    // One setItem stores the bill link and expense together.
    storage.setItem(WORKSPACE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}
