import { useState } from 'react';
import Modal from '../ui/Modal';
import FormField, { inputClass, primaryButtonClass, secondaryButtonClass } from '../ui/FormField';
import { categoriesByType } from '../../data/categories';
import { validateScheduleForm } from '../../utils/planningValidation';
import { parseAmount } from '../../utils/transactionValidation';

export default function ScheduleForm({ schedule, month, onSave, onClose, storage = 'local', onReload }) {
  const [values, setValues] = useState({ name: schedule?.name ?? '', category: schedule?.category ?? 'Utilities', amount: schedule ? (schedule.amountPaise / 100).toFixed(2) : '', dueDay: String(schedule?.dueDay ?? 1), startMonth: schedule?.startMonth ?? month, endMonth: schedule?.endMonth ?? '' });
  const [errors, setErrors] = useState({});
  const [saveError, setSaveError] = useState('');
  const [pending, setPending] = useState(false);
  const [requiresReload, setRequiresReload] = useState(false);
  const protectedHistory = storage === 'account' && schedule?.hasPaymentHistory;
  function field(name) {
    const update = (event) => { const value = event.target.value; setValues((previous) => ({ ...previous, [name]: value })); setErrors((previous) => ({ ...previous, [name]: undefined })); if (!requiresReload) setSaveError(''); };
    return { id: `schedule-${name}`, name, value: values[name], disabled: protectedHistory && name !== 'endMonth', className: inputClass, 'aria-invalid': Boolean(errors[name]), 'aria-describedby': errors[name] ? `schedule-${name}-error` : undefined, onChange: update, ...(name === 'startMonth' || name === 'endMonth' ? { onInput: update } : {}), required: name !== 'endMonth' };
  }
  async function submit(event) {
    event.preventDefault();
    if (pending || requiresReload) return;
    const nextErrors = validateScheduleForm(values, schedule?.paidTransactions);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) { event.currentTarget.elements.namedItem(Object.keys(nextErrors)[0])?.focus(); return; }
    setPending(true);
    try {
      const result = await onSave({ id: schedule?.id ?? crypto.randomUUID(), name: values.name.trim(), category: values.category, amountPaise: parseAmount(values.amount), dueDay: Number(values.dueDay), startMonth: values.startMonth, ...(values.endMonth ? { endMonth: values.endMonth } : {}), ...(schedule?.version !== undefined ? { version: schedule.version } : {}) }, Boolean(schedule));
      if (result.error) { setSaveError(result.error); setRequiresReload(Boolean(result.requiresReload)); }
      else onClose();
    } catch { setSaveError('The save could not be confirmed. Reload before submitting again.'); setRequiresReload(true); }
    finally { setPending(false); }
  }
  return (
    <Modal title={schedule ? 'Edit monthly schedule' : 'Add monthly schedule'} description={`A schedule tracks an expected bill ${storage === 'account' ? 'in your server account' : 'in this browser'}. It creates no expense until you record a payment.`} onClose={() => { if (!pending) onClose(); }}>
      <form noValidate onSubmit={submit} className="mt-6 space-y-4" aria-busy={pending}>
        {(Object.values(errors).some(Boolean) || saveError) && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{saveError || 'Check the highlighted fields.'}</p>}
        {protectedHistory && <p className="rounded-lg bg-amber-50 p-3 text-sm leading-6 text-amber-950">This schedule has paid history. Only its final month can change, and every recorded bill must stay included.</p>}
        <fieldset disabled={pending} className="min-w-0 space-y-4"><legend className="sr-only">Schedule details</legend>
        <FormField name="schedule-name" label="Payment name" error={errors.name}><input {...field('name')} type="text" maxLength={100} autoFocus placeholder="e.g. Internet bill" /></FormField>
        <FormField name="schedule-category" label="Category" error={errors.category}><select {...field('category')}>{categoriesByType.expense.map((category) => <option key={category}>{category}</option>)}</select></FormField>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField name="schedule-amount" label="Amount (₹)" error={errors.amount}><input {...field('amount')} type="text" inputMode="decimal" placeholder="0.00" /></FormField>
          <FormField name="schedule-dueDay" label="Due day of month" error={errors.dueDay} hint="Days 29–31 use the last day of shorter months."><input {...field('dueDay')} type="number" min="1" max="31" step="1" /></FormField>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField name="schedule-startMonth" label="Starting month" error={errors.startMonth}><input {...field('startMonth')} type="month" min="2000-01" max="2100-12" /></FormField>
          <FormField name="schedule-endMonth" label="Final month (optional)" error={errors.endMonth} hint="Inclusive. Leave blank to keep repeating."><input {...field('endMonth')} type="month" min={values.startMonth || '2000-01'} max="2100-12" /></FormField>
        </div>
        {schedule && !protectedHistory && <p className="rounded-lg bg-slate-50 p-3 text-xs leading-5 text-slate-600">Changes apply across this schedule’s active months. Set a final month to stop future occurrences.</p>}
        <div className="flex flex-wrap justify-end gap-3 border-t border-slate-100 pt-5"><button type="button" onClick={onClose} className={secondaryButtonClass}>Cancel</button>{requiresReload && onReload ? <button type="button" onClick={onReload} className={primaryButtonClass}>Discard draft and reload</button> : <button type="submit" disabled={requiresReload} className={`${primaryButtonClass} disabled:opacity-50`}>{pending ? 'Saving…' : 'Save schedule'}</button>}</div>
        </fieldset>
      </form>
    </Modal>
  );
}
