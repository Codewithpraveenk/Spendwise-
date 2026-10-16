import { ApiError } from './authApi.js';
import { isValidWorkspace, normalizeWorkspace } from '../utils/workspaceValidation.js';
import { describeBackup, MAX_BACKUP_BYTES } from './workspaceBackup.js';

const invalid = () => new ApiError('The server returned an invalid account workspace. No backup or import was confirmed.', { code: 'INVALID_RESPONSE' });
const validCounts = (value) => value && ['transactions', 'budgets', 'schedules', 'payments'].every((key) => Number.isSafeInteger(value[key]) && value[key] >= 0);
export function workspaceCounts(workspace) {
  return { transactions: workspace.transactions.length, budgets: workspace.budgets.length, schedules: workspace.recurringPayments.length, payments: workspace.recurringPayments.reduce((sum, item) => sum + Object.keys(item.paidTransactions).length, 0) };
}
export function checkedWorkspace(value) {
  if (!isValidWorkspace(value) || describeBackup(value).missingLinks) throw invalid();
  const expenses = new Map(value.transactions.map((item) => [item.id, item]));
  for (const schedule of value.recurringPayments) for (const id of Object.values(schedule.paidTransactions)) {
    const expense = expenses.get(id);
    if (expense.type !== 'expense' || expense.category !== schedule.category || expense.amountPaise !== schedule.amountPaise) throw invalid();
  }
  return normalizeWorkspace(value);
}
export function createAccountWorkspaceApi(fetcher = (...args) => fetch(...args), timeoutMs = 30000) {
  async function request(path, body, signal) {
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) abort();
    const timer = setTimeout(abort, timeoutMs);
    try {
      const text = body === undefined ? undefined : JSON.stringify(body);
      if (text && new TextEncoder().encode(text).byteLength > MAX_BACKUP_BYTES) throw new ApiError('The import request exceeds 5 MB. No records were sent.', { status: 400, code: 'IMPORT_LIMIT' });
      const response = await fetcher(`/api/workspace${path}`, { method: body === undefined ? 'GET' : 'POST', credentials: 'include', signal: controller.signal, headers: { Accept: 'application/json', ...(body === undefined ? {} : { 'Content-Type': 'application/json', 'X-Spendwise-Request': '1' }) }, ...(text ? { body: text } : {}) });
      let data;
      try { data = await response.json(); } catch { throw invalid(); }
      if (!response.ok) throw new ApiError(data.error?.message || 'The account workspace request failed.', { status: response.status, code: data.error?.code || 'REQUEST_FAILED' });
      return data;
    } catch (error) {
      if (signal?.aborted || error instanceof ApiError) throw error;
      throw new ApiError(controller.signal.aborted ? 'The account request timed out.' : 'Cannot reach the account server. Check your connection and backend.');
    } finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); }
  }
  return {
    async export(signal) { return checkedWorkspace((await request('', undefined, signal))?.workspace); },
    async preview(workspace, signal) {
      const clean = checkedWorkspace(workspace);
      const data = await request('/preview', { workspace: clean }, signal);
      const expected = workspaceCounts(clean);
      if (!validCounts(data?.counts) || !validCounts(data.current) || typeof data.canImport !== 'boolean' || Object.keys(expected).some((key) => expected[key] !== data.counts[key]) || (data.canImport && Object.values(data.current).some(Boolean))) throw invalid();
      return data;
    },
    async import(workspace, requestId, signal) {
      const clean = checkedWorkspace(workspace);
      const data = await request('/import', { workspace: clean, requestId }, signal);
      const expected = workspaceCounts(clean);
      if (!validCounts(data?.counts) || typeof data.replayed !== 'boolean' || Object.keys(expected).some((key) => expected[key] !== data.counts[key])) throw invalid();
      return data;
    },
  };
}
