import { formatINR } from '../../utils/formatters';

const accentStyles = {
  neutral: 'text-slate-900',
  positive: 'text-emerald-700',
  negative: 'text-rose-700',
};

export default function SummaryCard({ title, amountPaise, description, tone = 'neutral' }) {
  return (
    <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
      <dt className="text-sm font-medium text-slate-600">{title}</dt>
      <dd className={`mt-3 break-words text-3xl font-semibold tracking-tight tabular-nums ${accentStyles[tone]}`}>{formatINR(amountPaise)}</dd>
      <dd className="mt-3 text-sm leading-6 text-slate-500">{description}</dd>
    </div>
  );
}
