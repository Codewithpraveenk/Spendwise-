import { ApiError } from './authApi.js';
import { isValidTransaction } from '../utils/transactionValidation.js';
import { isValidBudget, isValidBudgetList, isValidMonth, isValidSchedule } from '../utils/planningValidation.js';
import { getAccountOccurrences } from '../utils/accountRecurring.js';

const validRecord = (record) => isValidTransaction(record) && /^[a-f\d]{24}$/i.test(record.id) && Number.isSafeInteger(record.version) && record.version >= 0;
const validBudget = (record) => isValidBudget(record) && /^[a-f\d]{24}$/i.test(record.id) && Number.isSafeInteger(record.version) && record.version >= 0;
const validId = (value) => typeof value === 'string' && /^[a-f\d]{24}$/i.test(value);
const versioned = (record) => record && validId(record.id) && Number.isSafeInteger(record.version) && record.version >= 0;
const validSchedule = (record) => versioned(record) && isValidSchedule({ ...record, paidTransactions: {} });
const validPayment = (record) => versioned(record) && validId(record.schedule) && validId(record.transaction) && isValidMonth(record.billMonth);
const invalidResponse = () => new ApiError('The server returned invalid financial data. Reload before continuing.', { code: 'INVALID_RESPONSE' });

export function transactionPayload(record, editing = false) {
  const body = Object.fromEntries(['description', 'type', 'category', 'amountPaise', 'date'].map((key) => [key, record[key]]));
  if (editing) body.version = record.version;
  return body;
}

export function createFinanceApi(fetcher = (...args) => fetch(...args), timeoutMs = 15000) {
  async function request(path, { method = 'GET', body, signal } = {}) {
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) abort();
    const timeout = setTimeout(abort, timeoutMs);
    try {
      const response = await fetcher(`/api/finance/${path}`, {
        method, credentials: 'include', signal: controller.signal,
        headers: { Accept: 'application/json', ...(body === undefined ? {} : { 'Content-Type': 'application/json', 'X-Spendwise-Request': '1' }) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      if (response.status === 204) return null;
      let data;
      try { data = await response.json(); }
      catch (error) {
        if (controller.signal.aborted) throw error;
        if (response.status >= 500) throw new ApiError('Cannot reach the finance server. Check that the backend and MongoDB are running, then reload.', { status: response.status, code: 'API_UNAVAILABLE' });
        throw invalidResponse();
      }
      if (!response.ok) throw new ApiError(data.error?.message ?? 'The transaction request failed.', { status: response.status, code: data.error?.code ?? 'REQUEST_FAILED' });
      return data;
    } catch (error) {
      if (signal?.aborted) throw error;
      if (error instanceof ApiError) throw error;
      throw new ApiError(controller.signal.aborted ? 'The request timed out.' : 'Cannot reach the finance server. Check your connection and backend.');
    } finally { clearTimeout(timeout); signal?.removeEventListener('abort', abort); }
  }
  async function list(kind, month, signal) {
      if (month !== null && !isValidMonth(month)) throw new ApiError('Choose a valid month.', { code: 'INVALID_INPUT', status: 400 });
      const records = [];
      const ids = new Set();
      const cursors = new Set();
      let cursor;
      do {
        const query = new URLSearchParams({ ...(month ? { month } : {}), limit: '100', ...(cursor ? { cursor } : {}) });
        const data = await request(`${kind}?${query}`, { signal });
        const acceptable = (record) => {
          if (kind === 'recurring') return validSchedule(record) && typeof record.hasPaymentHistory === 'boolean';
          if (kind === 'payments') return validPayment(record) && record.billMonth === month && validRecord(record.expense) && record.expense.id === record.transaction && record.expense.type === 'expense';
          return kind === 'budgets' ? validBudget(record) && record.month === month : validRecord(record) && record.date.slice(0, 7) === month;
        };
        if (!Array.isArray(data?.items) || data.items.length > 100 || !data.items.every(acceptable) || (data.nextCursor !== null && !validId(data.nextCursor))) throw invalidResponse();
        for (const record of data.items) {
          if (ids.has(record.id)) throw invalidResponse();
          ids.add(record.id); records.push(record);
        }
        if (records.length > 10000 || (records.length === 10000 && data.nextCursor)) throw new ApiError('This month has over 10,000 records. The complete month cannot be displayed here; no partial totals are shown.', { code: 'MONTH_TOO_LARGE' });
        if (kind === 'recurring' && (records.length > 1000 || (records.length === 1000 && data.nextCursor))) throw new ApiError('This account has over 1,000 schedules. They cannot all be displayed here.', { code: 'SCHEDULE_LIMIT' });
        cursor = data.nextCursor;
        if (cursor && (cursors.has(cursor) || data.items.length === 0)) throw invalidResponse();
        if (cursor) cursors.add(cursor);
      } while (cursor);
      if (kind === 'budgets' && !isValidBudgetList(records)) throw invalidResponse();
      return records;
  }
  return {
    listMonth: (month, signal) => list('transactions', month, signal),
    listBudgetMonth: (month, signal) => list('budgets', month, signal),
    listSchedules: (signal) => list('recurring', null, signal),
    listPaymentMonth: (month, signal) => list('payments', month, signal),
    async saveSchedule(record, editing, signal) {
      if (editing && !validSchedule(record)) throw invalidResponse();
      const body = { name: record.name, category: record.category, amountPaise: record.amountPaise, dueDay: record.dueDay, startMonth: record.startMonth, endMonth: record.endMonth || null, ...(editing ? { version: record.version } : {}) };
      const data = await request(editing ? `recurring/${record.id}` : 'recurring', { method: editing ? 'PUT' : 'POST', body, signal });
      if (!validSchedule(data?.item)) throw invalidResponse();
      return data.item;
    },
    async removeSchedule(record, signal) {
      if (!validSchedule(record)) throw invalidResponse();
      await request(`recurring/${record.id}`, { method: 'DELETE', body: { version: record.version }, signal });
    },
    async recordPayment(schedule, billMonth, date, signal) {
      if (!validSchedule(schedule)) throw invalidResponse();
      const data = await request(`recurring/${schedule.id}/payments`, { method: 'POST', body: { billMonth, date, version: schedule.version }, signal });
      if (!validPayment(data?.payment) || !validRecord(data?.transaction) || !validSchedule(data?.schedule) || data.payment.transaction !== data.transaction.id || data.payment.schedule !== schedule.id || data.payment.billMonth !== billMonth || data.transaction.date !== date || data.transaction.type !== 'expense' || data.transaction.amountPaise !== schedule.amountPaise) throw invalidResponse();
      return data;
    },
    async removePayment(payment, signal) {
      if (!validPayment(payment)) throw invalidResponse();
      await request(`payments/${payment.id}`, { method: 'DELETE', body: { version: payment.version }, signal });
    },
    async saveBudget(record, editing, signal) {
      if (editing && !validBudget(record)) throw invalidResponse();
      const body = { month: record.month, category: record.category, limitPaise: record.limitPaise, ...(editing ? { version: record.version } : {}) };
      const data = await request(editing ? `budgets/${record.id}` : 'budgets', { method: editing ? 'PUT' : 'POST', body, signal });
      if (!validBudget(data?.item)) throw invalidResponse();
      return data.item;
    },
    async removeBudget(record, signal) {
      if (!validBudget(record)) throw invalidResponse();
      await request(`budgets/${record.id}`, { method: 'DELETE', body: { version: record.version }, signal });
    },
    async save(record, editing, signal) {
      if (editing && (!/^[a-f\d]{24}$/i.test(record.id) || !Number.isSafeInteger(record.version) || record.version < 0)) throw invalidResponse();
      const data = await request(editing ? `transactions/${record.id}` : 'transactions', { method: editing ? 'PUT' : 'POST', body: transactionPayload(record, editing), signal });
      if (!validRecord(data?.item)) throw invalidResponse();
      return data.item;
    },
    async remove(record, signal) {
      if (!validRecord(record)) throw invalidResponse();
      await request(`transactions/${record.id}`, { method: 'DELETE', body: { version: record.version }, signal });
    },
  };
}

export async function loadAccountMonth(api, month, signal, includeRecurring = false) {
  const [transactions, budgets, schedules, payments] = await Promise.all([api.listMonth(month, signal), api.listBudgetMonth(month, signal), ...(includeRecurring ? [api.listSchedules(signal), api.listPaymentMonth(month, signal)] : [])]);
  if (includeRecurring) getAccountOccurrences(schedules, payments, month, '2100-12-31');
  return { transactions, budgets, ...(includeRecurring ? { schedules, payments } : {}) };
}

export function transactionFailure(error) {
  const requiresReload = error.status === 409 || !error.status || error.status >= 500;
  const hint = error.status === 409 ? ' Reload the latest account records before making another change.' : requiresReload ? ' Reload account records before submitting again; the server may already have saved your change.' : '';
  return { error: error.message + hint, requiresReload };
}
