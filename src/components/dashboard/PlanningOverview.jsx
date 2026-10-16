import { Link } from 'react-router';
import BudgetList from '../budgets/BudgetList';
import PaymentList from '../recurring/PaymentList';
import { useTransactions } from '../../state/TransactionsContext';
import { getBudgetProgress, getPaymentOccurrences } from '../../utils/planning';
import { formatDate } from '../../utils/formatters';

export default function PlanningOverview({ transactions, month, monthLabel }) {
  const { budgets, recurringPayments, today } = useTransactions();
  const budget = getBudgetProgress(budgets, transactions, month);
  // Surface over-budget categories first, then categories nearest their limit.
  const priorityBudgets = [...budget.items].sort((a, b) => b.percentage - a.percentage).slice(0, 3);
  const unpaid = getPaymentOccurrences(recurringPayments, transactions, month, today).filter((item) => item.status !== 'paid');
  return (
    <div className="mt-6 grid items-start gap-6 xl:grid-cols-2">
      <section aria-labelledby="budget-overview-heading" className="min-w-0 rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
        <div className="mb-6 flex flex-wrap justify-between gap-3"><div><h2 id="budget-overview-heading" className="font-semibold">Budget progress</h2><p className="mt-1 text-sm text-slate-500">Closest to the limit · {monthLabel}</p></div><Link to={`/budgets?month=${month}`} className="h-fit rounded-md text-sm font-medium text-indigo-700 hover:underline">View budgets</Link></div>
        <BudgetList items={priorityBudgets} />
      </section>
      <section aria-labelledby="payments-overview-heading" className="min-w-0 rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
        <div className="mb-6 flex flex-wrap justify-between gap-3"><div><h2 id="payments-overview-heading" className="font-semibold">Payments due</h2><p className="mt-1 text-sm text-slate-500">Unpaid in {monthLabel}</p></div><Link to={`/recurring?month=${month}`} className="h-fit rounded-md text-sm font-medium text-indigo-700 hover:underline">View payments</Link></div>
        <PaymentList items={unpaid.slice(0, 3)} emptyMessage="No unpaid payments scheduled for this month." />
        <p className="mt-5 border-t border-slate-100 pt-4 text-xs leading-5 text-slate-500">As of {formatDate(today)} (India). {unpaid.length > 3 ? `Showing 3 of ${unpaid.length} unpaid payments.` : 'Record a payment to add its expense.'}</p>
      </section>
    </div>
  );
}
