import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useAuth } from '../../state/useAuth';
import { createFinanceApi, transactionFailure } from '../../services/financeApi';
import { getToday } from '../../utils/transactionValidation';
import { selectTransactions, transactionSortOptions } from '../../utils/transactions';
import { formatINR } from '../../utils/formatters';
import { allCategories } from '../../data/categories';
import TransactionsTable from './TransactionsTable';
import TransactionForm from './TransactionForm';
import Modal from '../ui/Modal';
import { inputClass, primaryButtonClass, secondaryButtonClass } from '../ui/FormField';
import { AccountStorageNotice } from '../layout/StorageView';

const api = createFinanceApi();
const validMonth = (value) => /^(20\d{2}|2100)-(0[1-9]|1[0-2])$/.test(value ?? '');

export default function AccountTransactions() {
  const { user, status: authStatus, expire } = useAuth();
  const [params, setParams] = useSearchParams();
  const month = validMonth(params.get('month')) ? params.get('month') : getToday().slice(0, 7);
  const [data, setData] = useState({ month: null, records: [], status: 'loading', error: null });
  const [revision, setRevision] = useState(0);
  const [editor, setEditor] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [deleteError, setDeleteError] = useState(null);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState('');
  const [lockedError, setLockedError] = useState(null);
  const operation = useRef(null);
  const mounted = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; operation.current?.abort(); }; }, []);
  useEffect(() => {
    const controller = new AbortController();
    setData({ month, records: [], status: 'loading', error: null });
    api.listMonth(month, controller.signal).then((records) => {
      if (!controller.signal.aborted) setData({ month, records, status: 'ready', error: null });
    }).catch((error) => {
      if (controller.signal.aborted) return;
      if (error.status === 401) expire();
      else setData({ month, records: [], status: 'error', error });
    });
    return () => controller.abort();
  }, [month, revision, user.id, expire]);

  const ready = data.month === month && data.status === 'ready';
  const busy = pending || authStatus !== 'authenticated' || Boolean(lockedError);
  const read = (name, allowed, fallback) => allowed.includes(params.get(name)) ? params.get(name) : fallback;
  const filters = {
    query: params.get('query') ?? '', type: read('type', ['all', 'expense', 'income'], 'all'),
    category: read('category', ['all', ...allCategories], 'all'),
    sort: read('sort', transactionSortOptions.map((entry) => entry.value), 'newest'), id: params.get('id') ?? '',
  };
  const records = ready ? selectTransactions(data.records, filters) : [];
  const income = records.filter((record) => record.type === 'income').reduce((sum, record) => sum + record.amountPaise, 0);
  const expenses = records.filter((record) => record.type === 'expense').reduce((sum, record) => sum + record.amountPaise, 0);
  function update(name, value) {
    setNotice('');
    setParams((previous) => {
      const next = new URLSearchParams(previous); next.set('source', 'account');
      if (!value || value === 'all' || (name === 'sort' && value === 'newest')) next.delete(name); else next.set(name, value);
      return next;
    }, { replace: true });
  }
  const reload = useCallback(() => { setEditor(null); setDeleting(null); setDeleteError(null); setLockedError(null); setData({ month: null, records: [], status: 'loading', error: null }); setRevision((value) => value + 1); }, []);
  async function mutate(work) {
    if (operation.current || busy) return { error: 'Wait for the current account request to finish.' };
    const controller = new AbortController(); operation.current = controller; setPending(true);
    try {
      await work(controller.signal);
      if (!mounted.current || controller.signal.aborted) return { error: 'View changed. Reload account records to check the saved result.', requiresReload: true };
      setData({ month: null, records: [], status: 'loading', error: null });
      setRevision((value) => value + 1);
      return { error: null };
    } catch (error) {
      if (error.status === 401) expire();
      const failure = transactionFailure(error);
      if (mounted.current && failure.requiresReload) setLockedError(failure.error);
      return failure;
    } finally {
      if (operation.current === controller) operation.current = null;
      if (mounted.current) setPending(false);
    }
  }
  return <section>
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><h1 className="text-3xl font-semibold tracking-tight">Account transactions</h1><p className="mt-2 break-words text-sm leading-6 text-slate-600">Private records for {user.email}. Saved on the server.</p></div>
      <button type="button" disabled={!ready || busy} onClick={() => setEditor({ transaction: null })} className={`${primaryButtonClass} disabled:opacity-50`}>Add account transaction</button>
    </div>
    <AccountStorageNotice />
    <div role="status" className="mt-4 text-sm text-emerald-800">{notice}</div>
    {lockedError && <p role="alert" className="mt-4 rounded-lg bg-amber-50 p-4 text-sm leading-6 text-amber-950">{lockedError}</p>}
    <section aria-label="Account transaction filters" className="mt-5 space-y-4 rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-end gap-4"><div><label htmlFor="account-month" className="mb-2 block text-sm font-medium">Account month</label><input id="account-month" onInput={(event) => { if (validMonth(event.target.value)) update('month', event.target.value); }} type="month" min="2000-01" max="2100-12" value={month} onChange={(event) => { if (validMonth(event.target.value)) update('month', event.target.value); }} className={inputClass} disabled={pending} /></div><button type="button" onClick={reload} disabled={pending || authStatus !== 'authenticated'} className={`${secondaryButtonClass} disabled:opacity-50`}>Reload account records</button></div>
      <label className="block text-sm font-medium" htmlFor="account-search">Search this month</label><input id="account-search" type="search" value={filters.query} onChange={(event) => update('query', event.target.value)} className={inputClass} placeholder="Description or category" />
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          ['type', 'Type', [{ value: 'all', label: 'All types' }, { value: 'income', label: 'Income' }, { value: 'expense', label: 'Expense' }]],
          ['category', 'Category', [{ value: 'all', label: 'All categories' }, ...allCategories.map((category) => ({ value: category, label: category }))]],
          ['sort', 'Sort by', transactionSortOptions],
        ].map(([name, label, options]) => <div key={name}><label htmlFor={`account-${name}`} className="mb-2 block text-sm font-medium">{label}</label><select id={`account-${name}`} value={filters[name]} onChange={(event) => update(name, event.target.value)} className={inputClass}>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>)}
      </div>
      <button type="button" onClick={() => setParams({ source: 'account', month }, { replace: true })} className="min-h-11 text-sm font-medium text-indigo-700 underline">Clear search and filters</button>
    </section>
    {!ready && data.status !== 'error' && <p role="status" className="mt-6 rounded-lg bg-white p-6">Loading the complete account month…</p>}
    {data.month === month && data.status === 'error' && <div role="alert" className="mt-6 rounded-lg border border-rose-200 bg-rose-50 p-5 text-sm text-rose-900"><p>{data.error.message}</p><button type="button" onClick={reload} className={`${secondaryButtonClass} mt-3 bg-white`}>Retry loading transactions</button></div>}
    {ready && <section aria-label="Account transaction records" className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="flex flex-wrap justify-between gap-4 p-5 text-sm"><p>{records.length} of {data.records.length} records in {month}</p><p>Matching income: <strong>{formatINR(income)}</strong> · Expenses: <strong>{formatINR(expenses)}</strong></p></div>
      <TransactionsTable records={records} caption={`Account transactions for ${month}`} emptyTitle={data.records.length ? 'No matching account transactions' : 'No account transactions this month'} emptyDescription={data.records.length ? 'Clear filters or change the search.' : 'Add a transaction or choose another month. Your local records are in the Local workspace tab.'} onEdit={!busy ? (transaction) => setEditor({ transaction }) : undefined} onDelete={!busy ? (id) => { setDeleting(data.records.find((record) => record.id === id)); setDeleteError(null); } : undefined} />
    </section>}
    {editor && <TransactionForm transaction={editor.transaction} initialMonth={month} storage="account" onReload={reload} onClose={() => setEditor(null)} onSave={async (record, editing) => {
      const result = await mutate((signal) => api.save(record, editing, signal));
      if (!result.error) { setNotice(editing ? 'Account transaction updated.' : 'Account transaction added.'); setParams({ source: 'account', month: record.date.slice(0, 7) }, { replace: true }); }
      return result;
    }} />}
    {deleting && <Modal title="Delete account transaction?" description={`Delete “${deleting.description}” (${formatINR(deleting.amountPaise)}) from this account? This server deletion has no undo. Local records are unaffected.`} onClose={() => { if (!pending) setDeleting(null); }}>
      {deleteError && <p role="alert" className="mt-4 text-sm leading-6 text-rose-800">{deleteError.error}</p>}
      <div className="mt-6 flex flex-wrap justify-end gap-3"><button type="button" disabled={pending} onClick={() => setDeleting(null)} className={secondaryButtonClass}>Cancel</button>{deleteError?.requiresReload ? <button type="button" onClick={reload} className={primaryButtonClass}>Reload account records</button> : <button type="button" disabled={pending} className={`${primaryButtonClass} disabled:opacity-50`} onClick={async () => { const result = await mutate((signal) => api.remove(deleting, signal)); if (result.error) setDeleteError(result); else { setDeleting(null); setNotice('Account transaction deleted.'); } }}>{pending ? 'Deleting…' : 'Delete from account'}</button>}</div>
    </Modal>}
  </section>;
}

export function SignedOutTransactions() {
  const { status } = useAuth();
  return <section className="rounded-xl border border-slate-200 bg-white p-6"><h1 className="text-2xl font-semibold">Account transactions</h1><p className="mt-3 text-sm leading-6 text-slate-600">{status === 'loading' ? 'Checking your session…' : 'Sign in to view private account records. The local workspace remains available separately.'}</p>{status !== 'loading' && <Link to="/login" className={`${primaryButtonClass} mt-5 inline-block`}>Sign in</Link>}</section>;
}
