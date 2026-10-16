import { formatDate, formatINR } from '../../utils/formatters';
import { paymentStatusLabels } from '../../utils/planning';
import { Link } from 'react-router';

const statusStyles = {
  paid: 'bg-emerald-50 text-emerald-800',
  overdue: 'bg-rose-50 text-rose-800',
  'due-today': 'bg-amber-50 text-amber-900',
  upcoming: 'bg-slate-100 text-slate-600',
};

export default function PaymentList({ items, emptyMessage = 'No payments scheduled for this month.', onRecord, onRemovePayment, source = 'local', disabled = false }) {
  if (!items.length) return <p className="py-8 text-center text-sm text-slate-500">{emptyMessage}</p>;
  return (
    <ul className="divide-y divide-slate-100">
      {items.map((item) => (
        <li key={item.id} className="flex flex-wrap items-start justify-between gap-3 py-5 first:pt-0 last:pb-0">
          <div className="min-w-0 max-w-full">
            <h3 className="break-words text-sm font-medium text-slate-800">{item.name}</h3>
            <p className="mt-1 text-xs leading-5 text-slate-500">{item.category} · Monthly</p>
            <p className="mt-1 text-xs text-slate-500">Due <time dateTime={item.dueDate}>{formatDate(item.dueDate)}</time></p>
            {item.paidDate && <p className="mt-1 text-xs text-slate-500">Paid {formatINR(item.paidAmountPaise)} on <time dateTime={item.paidDate}>{formatDate(item.paidDate)}</time></p>}
            {onRecord && <div className="mt-3">
              {item.linkedTransactionId ? (
                <><Link to={`/transactions?id=${encodeURIComponent(item.linkedTransactionId)}${source === 'account' ? `&source=account&month=${item.paidDate?.slice(0, 7) ?? item.dueDate.slice(0, 7)}` : ''}`} className="inline-flex min-h-11 items-center rounded-md text-xs font-medium text-indigo-700 hover:underline">Review linked expense</Link>{onRemovePayment && item.recordedPayment && <button type="button" disabled={disabled} onClick={() => onRemovePayment(item)} aria-label={`Remove recorded payment for ${item.name}`} className="ml-2 rounded-md px-2 py-2 text-xs font-medium text-rose-700 disabled:opacity-50">Remove recording</button>}{item.status !== 'paid' && <p className="mt-1 max-w-sm text-xs leading-5 text-amber-800">A linked transaction exists. Review it before recording again.</p>}</>
              ) : <button type="button" disabled={disabled} onClick={() => onRecord(item)} aria-label={`Record payment for ${item.name}`} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">Record payment</button>}
            </div>}
          </div>
          <div className="text-right"><p className="text-sm font-semibold tabular-nums">{formatINR(item.amountPaise)}</p><span className={`mt-2 inline-block rounded-md px-2 py-1 text-xs font-medium ${statusStyles[item.status]}`}>{paymentStatusLabels[item.status]}</span></div>
        </li>
      ))}
    </ul>
  );
}
