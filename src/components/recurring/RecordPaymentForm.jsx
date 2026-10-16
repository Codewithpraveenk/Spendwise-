import { useState } from 'react';
import Modal from '../ui/Modal';
import FormField, { inputClass, primaryButtonClass, secondaryButtonClass } from '../ui/FormField';
import { formatDate, formatINR } from '../../utils/formatters';
import { isValidDate } from '../../utils/transactionValidation';

export default function RecordPaymentForm({ payment, month, today, onSave, onClose, onReload }) {
  const [date, setDate] = useState(today);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [requiresReload, setRequiresReload] = useState(false);
  function updateDate(event) { setDate(event.target.value); if (!requiresReload) setError(''); }
  async function submit(event) {
    event.preventDefault();
    if (pending || requiresReload) return;
    if (!isValidDate(date) || date > today) { setError('Choose a valid payment date on or before today.'); event.currentTarget.elements.namedItem('date').focus(); return; }
    setPending(true);
    try {
      const result = await onSave(payment.id, month, date);
      if (result.error) { setError(result.error); setRequiresReload(Boolean(result.requiresReload)); }
      else onClose();
    } catch { setError('The recording could not be confirmed. Reload before submitting again.'); setRequiresReload(true); }
    finally { setPending(false); }
  }
  return (
    <Modal title={`Record payment: ${payment.name}`} description={`This adds one ${formatINR(payment.amountPaise)} expense in ${payment.category} and links it to this bill. It does not transfer money.`} onClose={() => { if (!pending) onClose(); }}>
      <form noValidate onSubmit={submit} className="mt-6 space-y-4" aria-busy={pending}>
        <fieldset disabled={pending} className="min-w-0 space-y-4"><legend className="sr-only">Payment details</legend>
        <p className="text-sm text-slate-600">Bill due: {formatDate(payment.dueDate)} · {formatINR(payment.amountPaise)}</p>
        <FormField name="payment-date" label="Date paid" error={error} hint="Expenses count in the month you actually paid, even if the bill was due in another month."><input id="payment-date" name="date" value={date} onChange={updateDate} onInput={updateDate} type="date" min="2000-01-01" max={today} autoFocus required aria-invalid={Boolean(error)} aria-describedby={error ? 'payment-date-error payment-date-hint' : 'payment-date-hint'} className={inputClass} /></FormField>
        {error && <p role="alert" className="text-sm text-rose-700">{requiresReload ? 'Reload to check whether the payment was recorded.' : 'Check the message above before recording.'}</p>}
        <div className="flex flex-wrap justify-end gap-3 border-t border-slate-100 pt-5"><button type="button" onClick={onClose} className={secondaryButtonClass}>Cancel</button>{requiresReload && onReload ? <button type="button" onClick={onReload} className={primaryButtonClass}>Reload account records</button> : <button type="submit" disabled={requiresReload} className={`${primaryButtonClass} disabled:opacity-50`}>{pending ? 'Recording…' : 'Record expense'}</button>}</div>
        </fieldset>
      </form>
    </Modal>
  );
}
