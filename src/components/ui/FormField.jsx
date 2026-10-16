export const inputClass = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm aria-invalid:border-rose-500';
export const secondaryButtonClass = 'rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium hover:bg-slate-50';
export const primaryButtonClass = 'rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700';

export default function FormField({ name, label, error, hint, children }) {
  return (
    <div>
      <label htmlFor={name} className="mb-2 block text-sm font-medium text-slate-700">{label}</label>
      {children}
      {hint && <p id={`${name}-hint`} className="mt-1 text-xs leading-5 text-slate-500">{hint}</p>}
      {error && <p id={`${name}-error`} className="mt-1 text-xs leading-5 text-rose-700">{error}</p>}
    </div>
  );
}
