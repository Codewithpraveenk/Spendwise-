import { lazy, Suspense } from 'react';
import { Link } from 'react-router';
import useAccountMonth from '../../hooks/useAccountMonth';
import { getMonthlySummary, getMonthlySpending } from '../../utils/finance';
import { getBudgetProgress } from '../../utils/planning';
import SummaryCard from './SummaryCard';
import CategoryBreakdown from './CategoryBreakdown';
import RecentTransactions from './RecentTransactions';
import ChartErrorBoundary from './ChartErrorBoundary';
import BudgetList from '../budgets/BudgetList';
import MonthSelect from '../ui/MonthSelect';
import { AccountStorageNotice } from '../layout/StorageView';
import AccountMonthStatus from '../layout/AccountMonthStatus';
import { secondaryButtonClass } from '../ui/FormField';
import { getAccountOccurrences } from '../../utils/accountRecurring';
import useToday from '../../hooks/useToday';
import PaymentList from '../recurring/PaymentList';

const SpendingChart = lazy(() => import('./SpendingChart'));

export default function AccountOverview() {
  const state = useAccountMonth(true);
  const today = useToday();
  const { month, monthLabel, ready, transactions, budgets, setMonth, reload } = state;
  const summary = ready ? getMonthlySummary(transactions, month) : null;
  const spending = ready ? getMonthlySpending(transactions, month) : null;
  const progress = ready ? getBudgetProgress(budgets, transactions, month) : null;
  const unpaid = ready ? getAccountOccurrences(state.schedules, state.payments, month, today).filter((item) => item.status !== 'paid') : [];
  return <section>
    <div className="flex flex-wrap items-end justify-between gap-4"><div><h1 className="text-3xl font-semibold tracking-tight">Account overview</h1><p className="mt-2 text-sm text-slate-600">Your recorded account income, spending, and budget progress.</p></div><MonthSelect value={month} onChange={setMonth} /></div>
    <AccountStorageNotice />
    <button type="button" onClick={reload} className={`${secondaryButtonClass} mt-4`}>Reload account month</button>
    <AccountMonthStatus state={state} />
    {ready && <>
      <p role="status" className="mt-4 text-sm text-slate-600">{summary.transactionCount} account transactions in {monthLabel}.</p>
      <dl className="mt-5 grid gap-4 md:grid-cols-3"><SummaryCard title="Income" amountPaise={summary.incomePaise} description="Recorded account income" /><SummaryCard title="Expenses" amountPaise={summary.expensePaise} description="Recorded account spending" /><SummaryCard title="Net balance" amountPaise={summary.netPaise} tone={summary.netPaise < 0 ? 'negative' : summary.netPaise > 0 ? 'positive' : 'neutral'} description="Recorded income minus expenses" /></dl>
      <p className="mt-3 text-xs leading-5 text-slate-500">These totals reflect recorded transactions, rather than a bank account balance.</p>
      {summary.transactionCount === 0 && <div className="mt-5 rounded-xl border border-dashed border-slate-300 p-6"><h2 className="font-semibold">No account transactions for {monthLabel}</h2><Link to={`/transactions?source=account&month=${month}`} className="mt-3 inline-flex min-h-11 items-center text-sm font-medium text-indigo-700 underline">Add or review account transactions</Link></div>}
      <div className="mt-6 grid items-start gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]"><ChartErrorBoundary><Suspense fallback={<p role="status" className="rounded-xl bg-white p-6">Loading spending chart…</p>}><SpendingChart daily={spending.daily} totalPaise={spending.totalPaise} monthLabel={monthLabel} /></Suspense></ChartErrorBoundary><CategoryBreakdown categories={spending.categories} totalPaise={spending.totalPaise} /></div>
      <RecentTransactions transactions={transactions} month={month} monthLabel={monthLabel} source="account" />
      <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5 sm:p-6"><div className="mb-6 flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold">Account budget progress</h2><Link to={`/budgets?source=account&month=${month}`} className="inline-flex min-h-11 items-center text-sm font-medium text-indigo-700 underline">View account budgets</Link></div><BudgetList items={[...progress.items].sort((a, b) => b.percentage - a.percentage).slice(0, 3)} /><p className="mt-4 text-xs leading-5 text-slate-500">Showing up to three categories nearest their limit. View account budgets for all limits and unbudgeted expenses.</p></section>
      <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5 sm:p-6"><div className="mb-6 flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold">Account payments due</h2><Link to={`/recurring?source=account&month=${month}`} className="inline-flex min-h-11 items-center text-sm font-medium text-indigo-700 underline">View account payments</Link></div><PaymentList items={unpaid.slice(0, 3)} emptyMessage="No unpaid account bills for this month." /><p className="mt-4 text-xs text-slate-500">Showing up to three unpaid bills, ordered by due date.</p></section>
    </>}
  </section>;
}
