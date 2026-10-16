import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import ChartPanel from './ChartPanel';
import { formatINR } from '../../utils/formatters';

const axisFormatter = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });

export default function SpendingChart({ daily, totalPaise, monthLabel }) {
  const recordedDays = daily.filter((entry) => entry.amountPaise > 0);

  return (
    <ChartPanel title="Daily spending" description={`Recorded expenses in ${monthLabel}`}>
      {totalPaise === 0 ? (
        <p className="flex min-h-64 items-center justify-center text-sm text-slate-500">No expenses recorded for this month.</p>
      ) : (
        <>
          <div className="h-64 w-full min-w-0 sm:h-72">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <BarChart data={daily} margin={{ top: 8, right: 4, bottom: 8, left: 0 }} accessibilityLayer>
                <CartesianGrid vertical={false} stroke="#e2e8f0" strokeDasharray="3 3" />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} ticks={[1, 5, 10, 15, 20, 25, daily.length]} tickMargin={10} />
                <YAxis width={64} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(value) => `₹${axisFormatter.format(value / 100)}`} />
                <Tooltip cursor={{ fill: '#f1f5f9' }} formatter={(value) => [formatINR(value), 'Expenses']} labelFormatter={(day) => `${day} ${monthLabel}`} contentStyle={{ border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13 }} />
                <Bar dataKey="amountPaise" name="Expenses" fill="#6366f1" radius={[3, 3, 0, 0]} maxBarSize={20} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-2 text-xs leading-5 text-slate-500">Day of month · A blank day means no expense was recorded.</p>
          <details className="mt-4 border-t border-slate-100 pt-4">
            <summary className="w-fit cursor-pointer text-sm font-medium text-slate-600">View daily amounts</summary>
            <table className="mt-3 w-full text-left text-sm">
              <caption className="sr-only">Days with recorded expenses in {monthLabel}; all other days have no recorded expenses.</caption>
              <thead><tr className="border-b border-slate-200 text-slate-500"><th scope="col" className="py-2 font-medium">Day</th><th scope="col" className="py-2 text-right font-medium">Expenses</th></tr></thead>
              <tbody>{recordedDays.map((entry) => <tr key={entry.day} className="border-b border-slate-100"><th scope="row" className="py-2 font-normal">{entry.day} {monthLabel}</th><td className="py-2 text-right tabular-nums">{formatINR(entry.amountPaise)}</td></tr>)}</tbody>
            </table>
          </details>
        </>
      )}
    </ChartPanel>
  );
}
