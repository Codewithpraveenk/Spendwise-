import { lazy, Suspense, useState } from 'react';
import { Link } from 'react-router';
import SummaryCard from '../components/dashboard/SummaryCard';
import CategoryBreakdown from '../components/dashboard/CategoryBreakdown';
import ChartErrorBoundary from '../components/dashboard/ChartErrorBoundary';
import RecentTransactions from '../components/dashboard/RecentTransactions';
import PlanningOverview from '../components/dashboard/PlanningOverview';
import MonthSelect from '../components/ui/MonthSelect';
import { formatMonth } from '../utils/formatters';
import { useTransactions } from '../state/TransactionsContext';
import { getMonthlySpending, getMonthlySummary } from '../utils/finance';
import StorageView from '../components/layout/StorageView';
import AccountOverview from '../components/dashboard/AccountOverview';

// Load the chart library separately so the rest of the dashboard can render first.
const SpendingChart = lazy(() => import('../components/dashboard/SpendingChart'));

export default function OverviewPage() {
  return <StorageView local={LocalOverviewPage} account={AccountOverview} />;
}

function LocalOverviewPage() {
  const { transactions, defaultMonth } = useTransactions();
  const [selectedMonth, setSelectedMonth] = useState(defaultMonth);
  const summary = getMonthlySummary(transactions, selectedMonth);
  const spending = getMonthlySpending(transactions, selectedMonth);
  const monthLabel = formatMonth(selectedMonth);

  return (
    <>
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Overview</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">Your income and spending for the month.</p>
        </div>
        <MonthSelect value={selectedMonth} onChange={setSelectedMonth} />
      </div>
      <section aria-labelledby="summary-heading" className="mt-8">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 id="summary-heading" className="text-sm font-semibold text-slate-700">Monthly summary</h2>
          <p className="text-xs text-slate-500">Recorded transactions · INR</p>
        </div>
        <div aria-live="polite" aria-atomic="true">
          <p className="sr-only">{monthLabel}: {summary.transactionCount} recorded transactions.</p>
          <dl className="grid gap-4 md:grid-cols-3">
            <SummaryCard title="Income" amountPaise={summary.incomePaise} description="Total recorded income" />
            <SummaryCard title="Expenses" amountPaise={summary.expensePaise} description="Total recorded spending" />
            <SummaryCard title="Net balance" amountPaise={summary.netPaise} tone={summary.netPaise < 0 ? 'negative' : summary.netPaise > 0 ? 'positive' : 'neutral'} description={summary.netPaise < 0 ? 'Spending exceeded income this month' : 'Income minus expenses this month'} />
          </dl>
          {summary.transactionCount > 0 ? (
            <p className="mt-4 text-xs leading-5 text-slate-500">Based on {summary.transactionCount} transactions in {monthLabel}. Net balance reflects these records, rather than a bank account balance.</p>
          ) : (
            <div className="mt-5 rounded-xl border border-dashed border-slate-300 px-6 py-10 text-center">
              <h3 className="font-medium text-slate-800">No transactions for {monthLabel}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-500">{transactions.length ? 'Choose another month or add a transaction for this month.' : 'Add your first income or expense to start tracking your money.'}</p>
              <Link to={`/transactions?month=${selectedMonth}`} className="mt-4 inline-block rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50">Add or review transactions</Link>
            </div>
          )}
        </div>
      </section>
      <div className="mt-6 grid items-start gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <ChartErrorBoundary>
          <Suspense fallback={<div role="status" className="flex min-h-96 items-center justify-center rounded-xl border border-slate-200 bg-white text-sm text-slate-500">Loading spending chart…</div>}>
            <SpendingChart daily={spending.daily} totalPaise={spending.totalPaise} monthLabel={monthLabel} />
          </Suspense>
        </ChartErrorBoundary>
        <CategoryBreakdown categories={spending.categories} totalPaise={spending.totalPaise} />
      </div>
      <RecentTransactions transactions={transactions} month={selectedMonth} monthLabel={monthLabel} />
      <PlanningOverview transactions={transactions} month={selectedMonth} monthLabel={monthLabel} />
    </>
  );
}
