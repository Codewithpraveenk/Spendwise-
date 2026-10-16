import { createContext, useContext, useEffect, useReducer, useState } from 'react';
import { transactions as sampleTransactions, availableMonths as sampleMonths } from '../data/transactions';
import { budgets as sampleBudgets } from '../data/budgets';
import { recurringPayments as sampleSchedules } from '../data/recurringPayments';
import { loadWorkspace, saveWorkspace } from '../services/workspaceStorage';
import { workspaceReducer, recordPayment as preparePayment } from './workspaceReducer';
import { isValidTransaction } from '../utils/transactionValidation';
import { isValidBudget, isValidSchedule } from '../utils/planningValidation';
import useToday from '../hooks/useToday';
import { isValidWorkspace } from '../utils/workspaceValidation';

const TransactionsContext = createContext(null);
const monthFormatter = new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const seed = { transactions: sampleTransactions, budgets: sampleBudgets, recurringPayments: sampleSchedules };
const browserStorage = {
  getItem: (key) => window.localStorage.getItem(key),
  setItem: (key, value) => window.localStorage.setItem(key, value),
};

// Kept under its original name so existing pages can use the same public hook.
// The provider now owns the complete finance workspace.
export function TransactionsProvider({ children }) {
  const [initial] = useState(() => loadWorkspace(browserStorage, { transactions: [], budgets: [], recurringPayments: [] }));
  const [state, dispatch] = useReducer(workspaceReducer, { records: initial.records, budgets: initial.budgets, recurringPayments: initial.recurringPayments, lastDeleted: null });
  const [readBlocked, setReadBlocked] = useState(Boolean(initial.error));
  const [storageError, setStorageError] = useState(initial.error);
  const [retry, setRetry] = useState(0);
  const [notice, setNotice] = useState('');
  const today = useToday();
  const defaultMonth = today.slice(0, 7);

  useEffect(() => {
    if (readBlocked) return;
    setStorageError(saveWorkspace(browserStorage, { records: state.records, budgets: state.budgets, recurringPayments: state.recurringPayments }) ? null : 'write');
  }, [state.records, state.budgets, state.recurringPayments, readBlocked, retry]);

  function saveTransaction(record, isEditing) {
    if (!isValidTransaction(record)) return { error: 'This transaction is invalid. Check its fields and try again.' };
    if (isEditing && !state.records.some((entry) => entry.id === record.id)) return { error: 'This transaction no longer exists.' };
    if (!isEditing && state.records.length >= 10000) return { error: 'This browser workspace supports up to 10,000 transactions.' };
    dispatch({ type: isEditing ? 'update' : 'add', record });
    setNotice(isEditing ? 'Transaction updated.' : 'Transaction added.');
    return { error: null };
  }

  function deleteTransaction(id) {
    dispatch({ type: 'delete', id });
    setNotice('Transaction deleted. You can undo the most recent deletion until you refresh.');
  }

  function undoDelete() {
    dispatch({ type: 'undo' });
    setNotice('Deleted transaction restored.');
  }

  function restoreSamples() {
    dispatch(readBlocked ? { type: 'workspace-restore', seed } : { type: 'restore', records: sampleTransactions });
    setReadBlocked(false);
    setNotice(readBlocked ? 'Sample workspace restored.' : 'Sample transactions restored. Your budgets and schedules were kept.');
  }

  function saveBudget(budget, isEditing) {
    if (!isValidBudget(budget)) return { error: 'Check the month, category, and positive limit.' };
    if (isEditing && !state.budgets.some((entry) => entry.id === budget.id)) return { error: 'This budget no longer exists.' };
    if (state.budgets.some((entry) => entry.id !== budget.id && entry.month === budget.month && entry.category === budget.category)) return { error: 'This category already has a budget for the selected month.' };
    if (!isEditing && state.budgets.length >= 10000) return { error: 'The workspace has reached its budget limit.' };
    dispatch({ type: 'budget-save', budget });
    setNotice(isEditing ? 'Budget updated.' : 'Category budget added.');
    return { error: null };
  }

  function deleteBudget(id) {
    dispatch({ type: 'budget-delete', id });
    setNotice('Category budget removed. Recorded expenses were kept.');
  }

  function saveSchedule(schedule, isEditing) {
    const existing = state.recurringPayments.find((entry) => entry.id === schedule.id);
    const next = { ...schedule, paidTransactions: existing?.paidTransactions ?? {} };
    if (isEditing && !existing) return { error: 'This schedule no longer exists.' };
    if (!isValidSchedule(next)) return { error: 'Check the schedule fields. Months with linked payments must stay inside its date range.' };
    if (!existing && state.recurringPayments.length >= 1000) return { error: 'The workspace supports up to 1,000 schedules.' };
    dispatch({ type: 'schedule-save', schedule: next });
    setNotice(existing ? 'Payment schedule updated.' : 'Payment schedule added.');
    return { error: null };
  }

  function recordPayment(scheduleId, month, date) {
    const action = { type: 'payment-record', scheduleId, month, date, today };
    const result = preparePayment(state, action);
    if (result.error) return { error: result.error };
    dispatch(action);
    setNotice('Payment recorded as one linked expense. Dashboard and budgets updated.');
    return { error: null };
  }

  function deleteSchedule(id) {
    dispatch({ type: 'schedule-delete', id });
    setNotice('Schedule removed. Recorded expenses were kept.');
  }

  function restoreBackup(workspace) {
    if (!isValidWorkspace(workspace)) return { error: 'The backup is invalid. Your workspace has not been changed.' };
    dispatch({ type: 'workspace-import', workspace });
    setReadBlocked(false);
    setNotice('Backup restored. You can undo until your next change or refresh.');
    return { error: null };
  }

  function undoRestore() {
    dispatch({ type: 'workspace-undo-import' });
    setNotice('Your previous workspace was restored.');
  }

  const monthValues = new Set([
    ...sampleMonths.map((month) => month.value), today.slice(0, 7),
    ...state.records.map((record) => record.date.slice(0, 7)),
    ...state.budgets.map((budget) => budget.month),
    ...state.recurringPayments.flatMap((schedule) => [schedule.startMonth, ...(schedule.endMonth ? [schedule.endMonth] : []), ...Object.keys(schedule.paidTransactions)]),
  ]);
  const availableMonths = [...monthValues].sort().reverse().map((value) => ({ value, label: monthFormatter.format(new Date(`${value}-01T00:00:00Z`)) }));

  return (
    <TransactionsContext.Provider value={{ transactions: state.records, budgets: state.budgets, recurringPayments: state.recurringPayments, today, availableMonths, defaultMonth, storageError, readBlocked, notice, canUndo: Boolean(state.lastDeleted), canUndoRestore: Boolean(state.lastImport), restoreBackup, undoRestore, saveTransaction, deleteTransaction, undoDelete, restoreSamples, saveBudget, deleteBudget, saveSchedule, deleteSchedule, recordPayment, retrySave: () => setRetry((value) => value + 1) }}>
      {children}
    </TransactionsContext.Provider>
  );
}

export function useTransactions() {
  const context = useContext(TransactionsContext);
  if (!context) throw new Error('useTransactions must be used within TransactionsProvider');
  return context;
}
