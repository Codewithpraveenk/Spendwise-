import { Link } from 'react-router';
import TransactionsTable from '../transactions/TransactionsTable';
import { selectTransactions } from '../../utils/transactions';

export default function RecentTransactions({ transactions, month, monthLabel, source = 'local' }) {
  const recent = selectTransactions(transactions, { month }).slice(0, 5);
  return (
    <section aria-labelledby="recent-transactions-heading" className="mt-6 min-w-0 rounded-xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 p-5 sm:p-6">
        <div><h2 id="recent-transactions-heading" className="font-semibold text-slate-800">Recent transactions</h2><p className="mt-1 text-sm text-slate-500">Latest five records in {monthLabel}</p></div>
        <Link to={`/transactions?month=${month}${source === 'account' ? '&source=account' : ''}`} className="rounded-md px-2 py-1 text-sm font-medium text-indigo-700 hover:underline">View all transactions <span aria-hidden="true">→</span></Link>
      </div>
      <TransactionsTable records={recent} caption={`Recent transactions for ${monthLabel}`} />
      {recent.length > 0 && <p className="px-5 py-3 text-xs text-slate-500 sm:hidden">Scroll horizontally to see all columns.</p>}
    </section>
  );
}
