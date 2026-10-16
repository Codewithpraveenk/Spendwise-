import { Link } from 'react-router';
import { useState } from 'react';
import BudgetList from '../components/budgets/BudgetList';
import SummaryCard from '../components/dashboard/SummaryCard';
import MonthSelect from '../components/ui/MonthSelect';
import useMonthQuery from '../hooks/useMonthQuery';
import BudgetForm from '../components/budgets/BudgetForm';
import Modal from '../components/ui/Modal';
import { useTransactions } from '../state/TransactionsContext';
import { getBudgetProgress } from '../utils/planning';
import { formatINR } from '../utils/formatters';
import StorageView from '../components/layout/StorageView';
import AccountBudgets from '../components/budgets/AccountBudgets';

export default function BudgetsPage() {
  return <StorageView local={LocalBudgetsPage} account={AccountBudgets} />;
}

function LocalBudgetsPage() {
  const { transactions, budgets, saveBudget, deleteBudget } = useTransactions();
  const [editor, setEditor] = useState(null);
  const [removing, setRemoving] = useState(null);
  const { month, monthLabel, setMonth } = useMonthQuery();
  const progress = getBudgetProgress(budgets, transactions, month);
  const overCount = progress.items.filter((item) => item.status === 'over').length;
  return (
    <>
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div><h1 className="text-3xl font-semibold tracking-tight">Budgets</h1><p className="mt-2 text-sm leading-6 text-slate-500">Monthly category limits compared with recorded expenses.</p></div>
        <MonthSelect value={month} onChange={setMonth} />
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-slate-500">Your monthly category limits</p><button type="button" onClick={() => setEditor({ budget: null })} className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700">Add category budget</button></div>
      {progress.items.length > 0 ? (
        <>
          <dl className="mt-6 grid gap-4 md:grid-cols-3">
            <SummaryCard title="Planned budget" amountPaise={progress.limitPaise} description={`Across ${progress.items.length} categories`} />
            <SummaryCard title="Spent in planned categories" amountPaise={progress.spentPaise} description="Derived from recorded expenses" />
            <SummaryCard title="Remaining overall" amountPaise={progress.remainingPaise} tone={progress.remainingPaise < 0 ? 'negative' : 'neutral'} description="Unused limits can coexist with an overspent category" />
          </dl>
          <p role="status" className="mt-4 text-sm text-slate-600">{overCount ? `${overCount} ${overCount === 1 ? 'category is' : 'categories are'} over budget in ${monthLabel}.` : `No categories are over budget in ${monthLabel}.`}</p>
          <section aria-labelledby="category-limits-heading" className="mt-6 rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
            <h2 id="category-limits-heading" className="font-semibold">Category limits</h2>
            <p className="mb-6 mt-1 text-sm text-slate-500">Near limit means at least 80% used. Overspending remains visible above 100%.</p>
            <div className="max-w-3xl"><BudgetList items={progress.items} onEdit={(budget) => setEditor({ budget })} onRemove={setRemoving} /></div>
          </section>
        </>
      ) : (
        <section className="mt-6 rounded-xl border border-dashed border-slate-300 p-8 text-center">
          <h2 className="font-semibold">No budget plan for {monthLabel}</h2>
          <p className="mt-2 text-sm text-slate-500">Add a category limit to start planning this month.</p>
          <button type="button" onClick={() => setEditor({ budget: null })} className="mt-4 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50">Create a budget</button>
        </section>
      )}
      {progress.unbudgeted.length > 0 && (
        <section aria-labelledby="unbudgeted-heading" className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-5 sm:p-6">
          <h2 id="unbudgeted-heading" className="font-semibold text-amber-950">Expenses without a category budget</h2>
          <p className="mt-2 text-sm text-amber-900">{formatINR(progress.unbudgetedPaise)} is outside the planned categories and is excluded from the budget summary above.</p>
          <ul className="mt-3 space-y-2 text-sm text-amber-950">{progress.unbudgeted.map((entry) => <li key={entry.category} className="flex flex-wrap justify-between gap-2"><span>{entry.category}</span><span className="tabular-nums">{formatINR(entry.amountPaise)}</span></li>)}</ul>
        </section>
      )}
      <Link to={`/transactions?month=${month}&type=expense`} className="mt-6 inline-block rounded-md text-sm font-medium text-indigo-700 hover:underline">Review this month’s expenses →</Link>
      {editor && <BudgetForm budget={editor.budget} month={month} budgets={budgets} onSave={(budget, isEditing) => { const result = saveBudget(budget, isEditing); if (!result.error) setMonth(budget.month); return result; }} onClose={() => setEditor(null)} />}
      {removing && <Modal title={`Remove ${removing.category} budget?`} description="This removes the category limit for this month. Recorded expenses stay in your transaction history and will appear as unbudgeted spending. This removal cannot be undone automatically." onClose={() => setRemoving(null)}><div className="mt-6 flex flex-wrap justify-end gap-3"><button type="button" autoFocus onClick={() => setRemoving(null)} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium hover:bg-slate-50">Keep budget</button><button type="button" onClick={() => { deleteBudget(removing.id); setRemoving(null); }} className="rounded-lg bg-rose-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-rose-800">Remove budget</button></div></Modal>}
    </>
  );
}
