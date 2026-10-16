import ChartPanel from './ChartPanel';
import { formatINR } from '../../utils/formatters';

export default function CategoryBreakdown({ categories, totalPaise }) {
  return (
    <ChartPanel title="Spending by category" description="Share of this month’s recorded expenses">
      {categories.length === 0 ? (
        <p className="flex min-h-64 items-center justify-center text-sm text-slate-500">Categories appear when expenses are recorded.</p>
      ) : (
        <>
          <ul className="space-y-5">
            {categories.map(({ category, amountPaise, percentage }) => (
              <li key={category}>
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-sm">
                  <span className="font-medium text-slate-700">{category}</span>
                  <span className="tabular-nums text-slate-700">{formatINR(amountPaise)} <span className="ml-1 text-xs text-slate-500">({percentage.toFixed(1)}%)</span></span>
                </div>
                <div aria-hidden="true" className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-indigo-400" style={{ width: `${percentage}%` }} /></div>
              </li>
            ))}
          </ul>
          <div className="mt-6 flex justify-between gap-3 border-t border-slate-200 pt-4 text-sm font-semibold"><span>Total expenses</span><span className="tabular-nums">{formatINR(totalPaise)}</span></div>
          <p className="mt-2 text-xs text-slate-500">Percentages are rounded to one decimal place.</p>
        </>
      )}
    </ChartPanel>
  );
}
