import { formatDate, formatINR } from '../../utils/formatters';

export default function TransactionsTable({ records, caption, emptyTitle = 'No transactions yet', emptyDescription = 'There are no recorded transactions for this month.', action, onEdit, onDelete }) {
  if (records.length === 0) {
    return (
      <div className="px-6 py-12 text-center">
        <h3 className="font-medium text-slate-800">{emptyTitle}</h3>
        <p className="mt-2 text-sm leading-6 text-slate-500">{emptyDescription}</p>
        {action && <div className="mt-4">{action}</div>}
      </div>
    );
  }

  return (
    <div role="region" aria-label={caption} tabIndex={0} className="overflow-x-auto rounded-b-xl">
      <table className="w-full min-w-[640px] text-left text-sm">
        <caption className="sr-only">{caption}. Amounts are in INR. Income is marked plus; expenses are marked minus.</caption>
        <thead className="border-y border-slate-200 bg-slate-50 text-xs text-slate-500">
          <tr>{['Transaction', 'Category', 'Date', 'Type', 'Amount', ...(onEdit || onDelete ? ['Actions'] : [])].map((label) => <th key={label} scope="col" className={`px-5 py-3 font-medium ${label === 'Amount' || label === 'Actions' ? 'text-right' : ''}`}>{label}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {records.map((record) => (
            <tr key={record.id} className="hover:bg-slate-50/70">
              <th scope="row" className="px-5 py-4 font-medium text-slate-800">{record.description}</th>
              <td className="px-5 py-4 text-slate-500">{record.category}</td>
              <td className="whitespace-nowrap px-5 py-4 text-slate-500"><time dateTime={record.date}>{formatDate(record.date)}</time></td>
              <td className="px-5 py-4"><span className={`rounded-md px-2 py-1 text-xs font-medium ${record.type === 'income' ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>{record.type === 'income' ? 'Income' : 'Expense'}</span></td>
              <td className={`whitespace-nowrap px-5 py-4 text-right font-medium tabular-nums ${record.type === 'income' ? 'text-emerald-700' : 'text-slate-800'}`}>{record.type === 'income' ? '+' : '−'}{formatINR(record.amountPaise)}</td>
              {(onEdit || onDelete) && <td className="whitespace-nowrap px-5 py-4 text-right">
                {onEdit && <button type="button" onClick={() => onEdit(record)} aria-label={`Edit ${record.description}, ${formatDate(record.date)}`} className="rounded-md px-2 py-2 text-xs font-medium text-indigo-700 hover:bg-indigo-50">Edit</button>}
                {onDelete && <button type="button" onClick={() => onDelete(record.id)} aria-label={`Delete ${record.description}, ${formatDate(record.date)}`} className="rounded-md px-2 py-2 text-xs font-medium text-rose-700 hover:bg-rose-50">Delete</button>}
              </td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
