import { transactionReducer } from './transactionReducer.js';
import { isValidBudget, isValidSchedule, isValidMonth } from '../utils/planningValidation.js';
import { isValidDate, isValidTransaction } from '../utils/transactionValidation.js';
import { isValidWorkspace, normalizeWorkspace } from '../utils/workspaceValidation.js';

export function recordPayment(state, { scheduleId, month, date, today }) {
  const schedule = state.recurringPayments.find((entry) => entry.id === scheduleId);
  if (!schedule || !isValidMonth(month) || month < schedule.startMonth || (schedule.endMonth && month > schedule.endMonth)) return { error: 'This schedule is not active for the selected month.' };
  if (!isValidDate(date) || date > today) return { error: 'Choose a valid payment date on or before today.' };
  const linkedId = schedule.paidTransactions[month];
  if (state.records.some((record) => record.id === linkedId)) return { error: 'A transaction is already linked to this payment. Review it in Transactions before recording another.' };
  const id = `payment-${schedule.id}-${month}`;
  if (state.records.some((record) => record.id === id)) return { error: 'An expense already exists for this payment.' };
  if (state.records.length >= 10000) return { error: 'This browser workspace supports up to 10,000 transactions.' };
  const record = { id, description: schedule.name, category: schedule.category, type: 'expense', amountPaise: schedule.amountPaise, date };
  if (!isValidTransaction(record)) return { error: 'The schedule could not produce a valid expense.' };
  return {
    error: null,
    state: {
      ...state,
      records: [...state.records, record],
      recurringPayments: state.recurringPayments.map((entry) => entry.id === scheduleId ? { ...entry, paidTransactions: { ...entry.paidTransactions, [month]: id } } : entry),
      // A replaced payment cannot later be duplicated by undoing its old deletion.
      lastDeleted: state.lastDeleted && [linkedId, id].includes(state.lastDeleted.record.id) ? null : state.lastDeleted,
    },
  };
}

function applyWorkspaceAction(state, action) {
  switch (action.type) {
    case 'workspace-import': {
      if (!isValidWorkspace(action.workspace)) return state;
      const workspace = normalizeWorkspace(action.workspace);
      return { records: workspace.transactions, budgets: workspace.budgets, recurringPayments: workspace.recurringPayments, lastDeleted: null, lastImport: { records: state.records, budgets: state.budgets, recurringPayments: state.recurringPayments } };
    }
    case 'workspace-undo-import':
      return state.lastImport ? { ...state.lastImport, lastDeleted: null, lastImport: null } : state;
    case 'workspace-restore':
      return { records: structuredClone(action.seed.transactions), budgets: structuredClone(action.seed.budgets), recurringPayments: structuredClone(action.seed.recurringPayments), lastDeleted: null };
    case 'budget-save': {
      const budget = action.budget;
      if (!isValidBudget(budget) || state.budgets.some((entry) => entry.id !== budget.id && entry.month === budget.month && entry.category === budget.category)) return state;
      const exists = state.budgets.some((entry) => entry.id === budget.id);
      if (!exists && state.budgets.length >= 10000) return state;
      return { ...state, budgets: exists ? state.budgets.map((entry) => entry.id === budget.id ? budget : entry) : [...state.budgets, budget] };
    }
    case 'budget-delete':
      return { ...state, budgets: state.budgets.filter((entry) => entry.id !== action.id) };
    case 'schedule-delete':
      return { ...state, recurringPayments: state.recurringPayments.filter((entry) => entry.id !== action.id) };
    case 'schedule-save': {
      const existing = state.recurringPayments.find((entry) => entry.id === action.schedule.id);
      const schedule = { ...action.schedule, paidTransactions: existing?.paidTransactions ?? {} };
      if (!isValidSchedule(schedule) || (!existing && state.recurringPayments.length >= 1000)) return state;
      return { ...state, recurringPayments: existing ? state.recurringPayments.map((entry) => entry.id === schedule.id ? schedule : entry) : [...state.recurringPayments, schedule] };
    }
    case 'payment-record':
      return recordPayment(state, action).state ?? state;
    default: {
      // The transaction reducer returns only its own fields on delete/undo.
      const result = transactionReducer({ records: state.records, lastDeleted: state.lastDeleted }, action);
      return { ...state, ...result };
    }
  }
}

export function workspaceReducer(state, action) {
  const next = applyWorkspaceAction(state, action);
  // Import undo cannot discard a later edit: any other mutation ends that undo.
  if (next !== state && !['workspace-import', 'workspace-undo-import'].includes(action.type) && next.lastImport) return { ...next, lastImport: null };
  return next;
}
