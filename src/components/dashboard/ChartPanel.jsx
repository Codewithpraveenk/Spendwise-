import { useId } from 'react';

export default function ChartPanel({ title, description, children }) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="min-w-0 rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
      <h2 id={headingId} className="font-semibold text-slate-800">{title}</h2>
      <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>
      <div className="mt-6">{children}</div>
    </section>
  );
}
