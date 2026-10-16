import { useId } from 'react';
import { isValidMonth } from '../../utils/planningValidation';

export default function MonthSelect({ value, onChange }) {
  const id = useId();
  function update(event) {
    if (isValidMonth(event.target.value)) onChange(event.target.value);
  }
  return (
    <div className="w-full sm:w-48">
      <label htmlFor={id} className="mb-2 block text-xs font-medium text-slate-600">Month</label>
      <input id={id} type="month" min="2000-01" max="2100-12" value={value} onChange={update} onInput={update} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800" />
    </div>
  );
}
