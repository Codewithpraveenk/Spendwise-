import { useState } from 'react';
import { useSearchParams } from 'react-router';
import TransactionsTable from '../components/transactions/TransactionsTable';
import TransactionForm from '../components/transactions/TransactionForm';
import RestoreSamplesDialog from '../components/transactions/RestoreSamplesDialog';
import { useTransactions } from '../state/TransactionsContext';
import { allCategories } from '../data/categories';
import { selectTransactions, transactionSortOptions } from '../utils/transactions';
import { formatINR } from '../utils/formatters';
import { useAuth } from '../state/useAuth';
import AccountTransactions, { SignedOutTransactions } from '../components/transactions/AccountTransactions';

const categories = allCategories;
const controlClass = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800';

function FilterSelect({ name, label, value, options, onChange }) {
  return (
    <div>
      <label htmlFor={`filter-${name}`} className="mb-2 block text-xs font-medium text-slate-600">{label}</label>
      <select id={`filter-${name}`} value={value} onChange={(event) => onChange(name, event.target.value)} className={controlClass}>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </div>
  );
}

export default function TransactionsPage() {
  const [params, setParams] = useSearchParams();
  const { user } = useAuth();
  const account = params.get('source') === 'account';
  return <>
    <div role="group" aria-label="Transaction storage" className="mb-6 flex flex-wrap gap-2">
      {[['local', 'Local workspace'], ['account', 'Account data']].map(([source, label]) => <button key={source} type="button" aria-pressed={account === (source === 'account')} onClick={() => setParams(source === 'account' ? { source: 'account' } : {}, { replace: true })} className={`rounded-lg border px-4 py-2.5 text-sm font-medium ${account === (source === 'account') ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300 bg-white text-slate-700'}`}>{label}</button>)}
    </div>
    {account ? (user ? <AccountTransactions key={user.id} /> : <SignedOutTransactions />) : <LocalTransactionsPage />}
  </>;
}

function LocalTransactionsPage() {
  const { transactions, availableMonths, saveTransaction, deleteTransaction, restoreSamples } = useTransactions();
  const [editor, setEditor] = useState(null);
  const [showRestore, setShowRestore] = useState(false);
  const [params, setParams] = useSearchParams();
  // Validate URL values so a pasted or edited URL cannot leave controls unmatched.
  const readOption = (name, allowed, fallback) => allowed.includes(params.get(name)) ? params.get(name) : fallback;
  const filters = {
    id: params.get('id') ?? '',
    month: readOption('month', ['all', ...availableMonths.map((month) => month.value)], 'all'),
    type: readOption('type', ['all', 'income', 'expense'], 'all'),
    category: readOption('category', ['all', ...categories], 'all'),
    sort: readOption('sort', transactionSortOptions.map((option) => option.value), 'newest'),
    query: params.get('query') ?? '',
  };
  const records = selectTransactions(transactions, filters);
  const income = records.filter((record) => record.type === 'income').reduce((total, record) => total + record.amountPaise, 0);
  const expenses = records.filter((record) => record.type === 'expense').reduce((total, record) => total + record.amountPaise, 0);
  const hasFilters = Boolean(filters.id) || filters.month !== 'all' || filters.type !== 'all' || filters.category !== 'all' || filters.query !== '' || filters.sort !== 'newest';

  function updateFilter(name, value) {
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      if (!value || value === 'all' || (name === 'sort' && value === 'newest')) next.delete(name);
      else next.set(name, value);
      return next;
    }, { replace: true });
  }

  function clearFilters() {
    setParams({}, { replace: true });
  }

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div><h1 className="text-3xl font-semibold tracking-tight">Transactions</h1><p className="mt-2 text-sm leading-6 text-slate-500">Manage your income and expenses. Changes stay in this browser.</p></div>
        <button type="button" onClick={() => setEditor({ transaction: null })} className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700">Add transaction</button>
      </div>
      <section aria-label="Transaction filters" className="mt-8 rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
        {filters.id && <p className="mb-4 text-sm text-indigo-700">Viewing a linked expense. Clear filters to see all transactions.</p>}
        <div>
          <label htmlFor="transaction-search" className="mb-2 block text-xs font-medium text-slate-600">Search transactions</label>
          <input id="transaction-search" type="search" value={filters.query} onChange={(event) => updateFilter('query', event.target.value)} placeholder="Search description or category" className={controlClass} />
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <FilterSelect name="month" label="Month" value={filters.month} onChange={updateFilter} options={[{ value: 'all', label: 'All months' }, ...availableMonths]} />
          <FilterSelect name="type" label="Type" value={filters.type} onChange={updateFilter} options={[{ value: 'all', label: 'All types' }, { value: 'income', label: 'Income' }, { value: 'expense', label: 'Expense' }]} />
          <FilterSelect name="category" label="Category" value={filters.category} onChange={updateFilter} options={[{ value: 'all', label: 'All categories' }, ...categories.map((category) => ({ value: category, label: category }))]} />
          <FilterSelect name="sort" label="Sort by" value={filters.sort} onChange={updateFilter} options={transactionSortOptions} />
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p role="status" className="text-sm text-slate-500">{records.length} of {transactions.length} transactions</p>
          <button type="button" disabled={!hasFilters} onClick={clearFilters} className="rounded-lg px-3 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-50 disabled:cursor-default disabled:text-slate-400 disabled:hover:bg-transparent">Clear filters</button>
        </div>
      </section>
      <section aria-labelledby="records-heading" className="mt-6 min-w-0 rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-start justify-between gap-4 p-5 sm:p-6">
          <div><h2 id="records-heading" className="font-semibold">Transaction records</h2><p className="mt-1 text-xs text-slate-500">Totals reflect only the matching records.</p></div>
          <dl className="flex flex-wrap gap-x-6 gap-y-3 text-sm"><div><dt className="text-xs text-slate-500">Income</dt><dd className="mt-1 font-medium tabular-nums text-emerald-700">{formatINR(income)}</dd></div><div><dt className="text-xs text-slate-500">Expenses</dt><dd className="mt-1 font-medium tabular-nums">{formatINR(expenses)}</dd></div></dl>
        </div>
        <TransactionsTable records={records} onEdit={(transaction) => setEditor({ transaction })} onDelete={deleteTransaction} caption="Transactions matching the selected filters" emptyTitle={transactions.length ? 'No matching transactions' : 'No transactions yet'} emptyDescription={transactions.length ? 'Try a different month, category, or search term.' : 'Add your first income or expense to get started.'} action={hasFilters ? <button type="button" onClick={clearFilters} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50">Clear filters</button> : <button type="button" onClick={() => setEditor({ transaction: null })} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50">Add your first transaction</button>} />
        {records.length > 0 && <p className="px-5 py-3 text-xs text-slate-500 sm:hidden">Scroll horizontally to see all columns.</p>}
      </section>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
        <p>Started with fictional records. Local changes are saved only in this browser and device.</p>
        <button type="button" onClick={() => setShowRestore(true)} className="rounded-md px-2 py-2 font-medium text-slate-600 underline hover:text-slate-900">Restore sample data</button>
      </div>
      {editor && <TransactionForm transaction={editor.transaction} initialMonth={filters.month === 'all' ? null : filters.month} onSave={(record, isEditing) => {
        const result = saveTransaction(record, isEditing);
        // Reveal the changed record even if an old search or category would hide it.
        if (!result.error) setParams({ month: record.date.slice(0, 7) }, { replace: true });
        return result;
      }} onClose={() => setEditor(null)} />}
      {showRestore && <RestoreSamplesDialog onConfirm={restoreSamples} onClose={() => setShowRestore(false)} />}
    </>
  );
}
