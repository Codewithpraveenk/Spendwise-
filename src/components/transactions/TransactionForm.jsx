import { useState } from 'react';
import Modal from '../ui/Modal';
import { categoriesByType } from '../../data/categories';
import { getToday, parseAmount, validateTransactionForm } from '../../utils/transactionValidation';

const fieldClass = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm aria-invalid:border-rose-500';

function Field({ name, label, error, children }) {
  return (
    <div>
      <label htmlFor={`transaction-${name}`} className="mb-2 block text-sm font-medium text-slate-700">{label}</label>
      {children}
      {error && <p id={`${name}-error`} className="mt-1 text-xs leading-5 text-rose-700">{error}</p>}
    </div>
  );
}

export default function TransactionForm({ transaction, initialMonth, onSave, onClose, onReload, storage = 'local' }) {
  const today = getToday();
  const initialDate = initialMonth && initialMonth !== today.slice(0, 7) && initialMonth < today.slice(0, 7) ? `${initialMonth}-01` : today;
  const [values, setValues] = useState(transaction ? {
    description: transaction.description, amount: (transaction.amountPaise / 100).toFixed(2),
    date: transaction.date, type: transaction.type, category: transaction.category,
  } : { description: '', amount: '', date: initialDate, type: 'expense', category: 'Food' });
  const [errors, setErrors] = useState({});
  const [saveError, setSaveError] = useState('');
  const [pending, setPending] = useState(false);
  const [requiresReload, setRequiresReload] = useState(false);

  function update(name, value) {
    setValues((previous) => ({ ...previous, [name]: value, ...(name === 'type' ? { category: categoriesByType[value][0] } : {}) }));
    setErrors((previous) => ({ ...previous, [name]: undefined, ...(name === 'type' ? { category: undefined } : {}) }));
    if (!requiresReload) setSaveError('');
  }

  function attributes(name) {
    return { id: `transaction-${name}`, name, value: values[name], onChange: (event) => update(name, event.target.value), 'aria-invalid': Boolean(errors[name]), 'aria-describedby': errors[name] ? `${name}-error` : undefined, className: fieldClass, required: true };
  }

  async function submit(event) {
    event.preventDefault();
    if (pending || requiresReload) return;
    const nextErrors = validateTransactionForm(values, today);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      event.currentTarget.elements.namedItem(Object.keys(nextErrors)[0])?.focus();
      return;
    }
    const record = {
      id: transaction?.id ?? crypto.randomUUID(),
      description: values.description.trim(), amountPaise: parseAmount(values.amount),
      date: values.date, type: values.type, category: values.category,
      ...(transaction?.version !== undefined ? { version: transaction.version } : {}),
    };
    setPending(true);
    try {
      const result = await onSave(record, Boolean(transaction));
      if (result.error) { setSaveError(result.error); setRequiresReload(Boolean(result.requiresReload)); }
      else onClose();
    } catch { setSaveError('The save could not be confirmed. Reload the records before submitting again.'); setRequiresReload(true); }
    finally { setPending(false); }
  }

  return (
    <Modal title={transaction ? 'Edit transaction' : 'Add transaction'} description={`All fields are required. Enter the amount in rupees; changes are stored ${storage === 'account' ? 'in your server account' : 'in this browser'}.`} onClose={() => { if (!pending) onClose(); }}>
      <form noValidate onSubmit={submit} className="mt-6 space-y-4" aria-busy={pending}>
        {(Object.values(errors).some(Boolean) || saveError) && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{saveError || 'Check the highlighted fields before saving.'}</p>}
        <fieldset disabled={pending} className="min-w-0 space-y-4"><legend className="sr-only">Transaction details</legend>
        <Field name="description" label="Description" error={errors.description}><input {...attributes('description')} type="text" maxLength={100} autoFocus autoComplete="off" placeholder="e.g. Lunch at the canteen" /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field name="amount" label="Amount (₹)" error={errors.amount}><input {...attributes('amount')} type="text" inputMode="decimal" autoComplete="off" placeholder="0.00" /></Field>
          <Field name="date" label="Date" error={errors.date}><input {...attributes('date')} onInput={(event) => update('date', event.target.value)} type="date" min="2000-01-01" max={today} /></Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field name="type" label="Type" error={errors.type}><select {...attributes('type')}><option value="expense">Expense</option><option value="income">Income</option></select></Field>
          <Field name="category" label="Category" error={errors.category}><select {...attributes('category')}>{categoriesByType[values.type].map((category) => <option key={category} value={category}>{category}</option>)}</select></Field>
        </div>
        {transaction && <p className="text-xs leading-5 text-slate-500">{storage === 'account' ? 'Linked bill expenses cannot be edited here; the server preserves their payment history.' : 'Editing a linked bill’s record can change its recurring payment status.'}</p>}
        <div className="flex flex-wrap justify-end gap-3 border-t border-slate-100 pt-5">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium hover:bg-slate-50">Cancel</button>
          {requiresReload && onReload ? <button type="button" onClick={onReload} className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white">Discard draft and reload</button> : <button type="submit" disabled={requiresReload} className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">{pending ? 'Saving…' : transaction ? 'Save changes' : 'Add transaction'}</button>}
        </div>
        </fieldset>
      </form>
    </Modal>
  );
}
