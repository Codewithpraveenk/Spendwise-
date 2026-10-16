import { formatINR } from '../../utils/formatters';

const styles = {
  over: { label: 'Over budget', text: 'text-rose-700', bar: 'bg-rose-500' },
  'at-limit': { label: 'At limit', text: 'text-amber-800', bar: 'bg-amber-500' },
  near: { label: 'Near limit', text: 'text-amber-800', bar: 'bg-amber-500' },
  within: { label: 'Within budget', text: 'text-slate-500', bar: 'bg-indigo-400' },
};

export default function BudgetList({ items, onEdit, onRemove }) {
  if (!items.length) return <p className="py-8 text-center text-sm text-slate-500">No budget plan for this month.</p>;
  return (
    <ul className="divide-y divide-slate-100">
      {items.map((item) => {
        const style = styles[item.status];
        return (
          <li key={item.id} className="py-5 first:pt-0 last:pb-0">
            <div className="flex flex-wrap items-baseline justify-between gap-2"><h3 className="text-sm font-medium text-slate-800">{item.category}</h3><span className={`text-xs font-medium ${style.text}`}>{style.label}</span></div>
            <p className="mt-2 text-sm tabular-nums text-slate-600"><span className="font-medium text-slate-800">{formatINR(item.spentPaise)}</span> of {formatINR(item.limitPaise)}</p>
            <div role="progressbar" aria-label={`${item.category} budget used`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, item.percentage)} aria-valuetext={`${item.percentage.toFixed(1)}% used. ${formatINR(Math.abs(item.remainingPaise))} ${item.remainingPaise < 0 ? 'over budget' : 'remaining'}.`} className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${style.bar}`} style={{ width: `${Math.min(100, item.percentage)}%` }} /></div>
            <div className="mt-2 flex flex-wrap justify-between gap-2 text-xs text-slate-500"><span>{item.percentage.toFixed(1)}% used</span><span className={item.remainingPaise < 0 ? 'text-rose-700' : ''}>{formatINR(Math.abs(item.remainingPaise))} {item.remainingPaise < 0 ? 'over' : 'left'}</span></div>
            {(onEdit || onRemove) && <div className="mt-3 flex gap-2">
              {onEdit && <button type="button" onClick={() => onEdit(item)} aria-label={`Edit ${item.category} budget`} className="rounded-md px-2 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-50">Edit limit</button>}
              {onRemove && <button type="button" onClick={() => onRemove(item)} aria-label={`Remove ${item.category} budget`} className="rounded-md px-2 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100">Remove</button>}
            </div>}
          </li>
        );
      })}
    </ul>
  );
}
