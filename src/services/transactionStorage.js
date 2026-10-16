import { isValidTransactionList } from '../utils/transactionValidation.js';

export const STORAGE_KEY = 'spendwise.transactions.v1';

// Legacy transaction-only adapter, retained for migration and regression tests.
// New writes use the complete workspace adapter in workspaceStorage.js.
export function loadTransactions(storage, seed) {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (raw === null) return { records: structuredClone(seed), error: null };
    const data = JSON.parse(raw);
    if (data.version !== 1 || !isValidTransactionList(data.records)) throw new Error('Invalid stored records');
    return { records: data.records, error: null };
  } catch {
    // Keep the unreadable value untouched until the user explicitly restores data.
    return { records: structuredClone(seed), error: 'read' };
  }
}

export function saveTransactions(storage, records) {
  try {
    if (!isValidTransactionList(records)) return false;
    storage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, records }));
    return true;
  } catch {
    return false;
  }
}
