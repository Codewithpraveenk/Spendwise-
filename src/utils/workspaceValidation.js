import { isValidTransactionList } from './transactionValidation.js';
import { isValidBudgetList, isValidScheduleList } from './planningValidation.js';

export function isValidWorkspace(data) {
  return data !== null && typeof data === 'object' && data.version === 2
    && isValidTransactionList(data.transactions) && isValidBudgetList(data.budgets) && isValidScheduleList(data.recurringPayments);
}

// Copy known fields only; imported metadata does not become application state.
export function normalizeWorkspace(data) {
  return {
    version: 2,
    transactions: data.transactions.map(({ id, date, description, category, type, amountPaise }) => ({ id, date, description, category, type, amountPaise })),
    budgets: data.budgets.map(({ id, month, category, limitPaise }) => ({ id, month, category, limitPaise })),
    recurringPayments: data.recurringPayments.map(({ id, name, category, amountPaise, dueDay, startMonth, endMonth, paidTransactions }) => ({ id, name, category, amountPaise, dueDay, startMonth, ...(endMonth ? { endMonth } : {}), paidTransactions: { ...paidTransactions } })),
  };
}
