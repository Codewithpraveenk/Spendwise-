import { useState } from 'react';
import Modal from '../ui/Modal';
import FormField, { inputClass, primaryButtonClass, secondaryButtonClass } from '../ui/FormField';
import { categoriesByType } from '../../data/categories';
import { validateBudgetForm } from '../../utils/planningValidation';
import { parseAmount } from '../../utils/transactionValidation';

export default function BudgetForm({ budget, month, budgets, onSave, onClose, storage = 'local', onReload }) {
  const [values, setValues] = useState({ month: budget?.month ?? month, category: budget?.category ?? 'Food', amount: budget ? (budget.limitPaise / 100).toFixed(2) : '' });
  const [errors, setErrors] = useState({});
  const [saveError, setSaveError] = useState('');
  const [pending, setPending] = useState(false);
  const [requiresReload, setRequiresReload] = useState(false);
  function field(name) {
    const update = (event) => { const value = event.target.value; setValues((previous) => ({ ...previous, [name]: value })); setErrors((previous) => ({ ...previous, [name]: undefined })); if (!requiresReload) setSaveError(''); };
    return { id: `budget-${name}`, name, value: values[name], className: inputClass, required: true, 'aria-invalid': Boolean(errors[name]), 'aria-describedby': errors[name] ? `budget-${name}-error` : undefined, onChange: update, ...(name === 'month' ? { onInput: update } : {}) };
  }
  async function submit(event) {
    event.preventDefault();
    if (pending || requiresReload) return;
    const nextErrors = validateBudgetForm(values, budgets, budget?.id);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) { event.currentTarget.elements.namedItem(Object.keys(nextErrors)[0])?.focus(); return; }
    setPending(true);
    try {
      const result = await onSave({ id: budget?.id ?? crypto.randomUUID(), month: values.month, category: values.category, limitPaise: parseAmount(values.amount), ...(budget?.version !== undefined ? { version: budget.version } : {}) }, Boolean(budget));
      if (result.error) { setSaveError(result.error); setRequiresReload(Boolean(result.requiresReload)); }
      else onClose();
    } catch { setSaveError('The save could not be confirmed. Reload before submitting again.'); setRequiresReload(true); }
    finally { setPending(false); }
  }
  return (
    <Modal title={budget ? 'Edit category budget' : 'Add category budget'} description={`Set one category limit per month, saved ${storage === 'account' ? 'in your server account. Choose another month on the page before adding its limits' : 'in this browser'}.`} onClose={() => { if (!pending) onClose(); }}>
      <form noValidate onSubmit={submit} className="mt-6 space-y-4" aria-busy={pending}>
        {(Object.values(errors).some(Boolean) || saveError) && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{saveError || 'Check the highlighted fields.'}</p>}
        <fieldset disabled={pending} className="min-w-0 space-y-4"><legend className="sr-only">Budget details</legend>
        <FormField name="budget-month" label="Month" error={errors.month}><input {...field('month')} disabled={storage === 'account'} type="month" min="2000-01" max="2100-12" /></FormField>
        <FormField name="budget-category" label="Category" error={errors.category}><select {...field('category')}>{categoriesByType.expense.map((category) => <option key={category}>{category}</option>)}</select></FormField>
        <FormField name="budget-amount" label="Monthly limit (₹)" error={errors.amount}><input {...field('amount')} type="text" inputMode="decimal" autoFocus placeholder="0.00" /></FormField>
        <div className="flex flex-wrap justify-end gap-3 border-t border-slate-100 pt-5"><button type="button" onClick={onClose} className={secondaryButtonClass}>Cancel</button>{requiresReload && onReload ? <button type="button" onClick={onReload} className={primaryButtonClass}>Discard draft and reload</button> : <button type="submit" disabled={requiresReload} className={`${primaryButtonClass} disabled:opacity-50`}>{pending ? 'Saving…' : 'Save budget'}</button>}</div>
        </fieldset>
      </form>
    </Modal>
  );
}
