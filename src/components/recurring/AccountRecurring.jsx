import { useState } from 'react';
import { useSearchParams } from 'react-router';
import useAccountMonth from '../../hooks/useAccountMonth';
import useAccountMutation from '../../hooks/useAccountMutation';
import useToday from '../../hooks/useToday';
import { createFinanceApi } from '../../services/financeApi';
import { getAccountOccurrences } from '../../utils/accountRecurring';
import { paymentStatusLabels } from '../../utils/planning';
import { formatDate, formatINR, formatMonth } from '../../utils/formatters';
import SummaryCard from '../dashboard/SummaryCard';
import MonthSelect from '../ui/MonthSelect';
import Modal from '../ui/Modal';
import { inputClass, primaryButtonClass, secondaryButtonClass } from '../ui/FormField';
import { AccountStorageNotice } from '../layout/StorageView';
import AccountMonthStatus from '../layout/AccountMonthStatus';
import PaymentList from './PaymentList';
import ScheduleForm from './ScheduleForm';
import RecordPaymentForm from './RecordPaymentForm';

const api = createFinanceApi();
const statuses = ['all', 'unpaid', 'overdue', 'due-today', 'upcoming', 'paid'];

export default function AccountRecurring() {
  const state = useAccountMonth(true);
  const mutation = useAccountMutation(state.reload);
  const today = useToday();
  const [params, setParams] = useSearchParams();
  const [editor, setEditor] = useState(null);
  const [recording, setRecording] = useState(null);
  const [removing, setRemoving] = useState(null);
  const [notice, setNotice] = useState('');
  const status = statuses.includes(params.get('status')) ? params.get('status') : 'all';
  const occurrences = state.ready ? getAccountOccurrences(state.schedules, state.payments, state.month, today) : [];
  const visible = occurrences.filter((item) => status === 'all' || (status === 'unpaid' ? item.status !== 'paid' : item.status === status));
  const sum = (items) => items.reduce((total, item) => total + item.amountPaise, 0);
  const unpaid = occurrences.filter((item) => item.status !== 'paid');
  const overdue = occurrences.filter((item) => item.status === 'overdue');
  function reload() { setEditor(null); setRecording(null); setRemoving(null); mutation.clearFailure(); state.reload(); }
  return <section>
    <div className="flex flex-wrap items-end justify-between gap-4"><div><h1 className="text-3xl font-semibold tracking-tight">Account recurring payments</h1><p className="mt-2 text-sm text-slate-600">Monthly bills and subscriptions saved in your account.</p></div><MonthSelect value={state.month} onChange={(value) => { if (!mutation.pending) { setNotice(''); state.setMonth(value); } }} /></div>
    <AccountStorageNotice />
    <div className="mt-5 flex flex-wrap gap-3"><button type="button" disabled={!state.ready || mutation.busy} onClick={() => setEditor({ schedule: null })} className={`${primaryButtonClass} disabled:opacity-50`}>Add account schedule</button><button type="button" disabled={mutation.pending} onClick={reload} className={secondaryButtonClass}>Reload account month</button></div>
    <p className="mt-4 text-xs text-slate-500">As of {formatDate(today)} · India time. Recording tracks an expense; it does not transfer money.</p>
    <p role="status" className="mt-3 text-sm text-emerald-800">{notice}</p>
    {mutation.failure && !editor && !recording && !removing && <p role="alert" className="mt-4 rounded-lg bg-amber-50 p-4 text-sm leading-6 text-amber-950">{mutation.failure.error}</p>}
    <AccountMonthStatus state={state} />
    {state.ready && <>
      <dl className="mt-6 grid gap-4 md:grid-cols-3"><SummaryCard title="Scheduled this month" amountPaise={sum(occurrences)} description={`${occurrences.length} account bills`} /><SummaryCard title="Still to pay" amountPaise={sum(unpaid)} description={`${unpaid.length} unpaid, including overdue bills`} /><SummaryCard title="Overdue" amountPaise={sum(overdue)} tone={overdue.length ? 'negative' : 'neutral'} description={`${overdue.length} past their due date`} /></dl>
      <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5 sm:p-6"><div className="mb-6 flex flex-wrap items-end justify-between gap-4"><div><h2 className="font-semibold">Account payment schedule</h2><p role="status" className="mt-2 text-sm text-slate-500">{visible.length} of {occurrences.length} bills in {state.monthLabel}</p></div><div><label htmlFor="account-payment-status" className="mb-2 block text-sm">Status</label><select id="account-payment-status" value={status} onChange={(event) => setParams((previous) => { const next = new URLSearchParams(previous); if (event.target.value === 'all') next.delete('status'); else next.set('status', event.target.value); return next; }, { replace: true })} className={inputClass}><option value="all">All statuses</option><option value="unpaid">All unpaid</option>{statuses.slice(2).map((value) => <option key={value} value={value}>{paymentStatusLabels[value]}</option>)}</select></div></div>
        <PaymentList items={visible} source="account" disabled={mutation.busy} onRecord={setRecording} onRemovePayment={(item) => { mutation.clearFailure(); setRemoving({ payment: item }); }} emptyMessage={occurrences.length ? 'No account bills match this status.' : 'No account payments scheduled for this month.'} />
      </section>
      <p className="mt-4 text-xs leading-5 text-slate-500">Scheduled totals cover the full bill month regardless of the filter. Expenses count in their actual payment month. Removing a recording deletes its expense and marks the bill unpaid again.</p>
      <details className="mt-6 rounded-xl border border-slate-200 bg-white p-5 sm:p-6"><summary className="cursor-pointer font-semibold">Manage account schedules ({state.schedules.length})</summary><p className="mt-3 text-sm leading-6 text-slate-500">Includes inactive schedules. Paid history protects a schedule’s details; you can still set a final month that includes all recorded bills.</p><ul className="mt-3 divide-y divide-slate-100">{state.schedules.map((schedule) => <li key={schedule.id} className="flex flex-wrap justify-between gap-3 py-4"><div className="min-w-0"><h2 className="break-words text-sm font-semibold">{schedule.name}</h2><p className="mt-1 text-xs leading-5 text-slate-500">{formatMonth(schedule.startMonth)} → {schedule.endMonth ? formatMonth(schedule.endMonth) : 'Ongoing'} · Due day {schedule.dueDay}</p>{schedule.hasPaymentHistory && <p className="mt-1 text-xs text-amber-800">Paid history kept · Final month can be edited</p>}</div><div className="flex flex-wrap gap-2"><button type="button" disabled={mutation.busy} onClick={() => setEditor({ schedule })} aria-label={`Edit account schedule for ${schedule.name}`} className={secondaryButtonClass}>Edit schedule</button><button type="button" disabled={mutation.busy || schedule.hasPaymentHistory} onClick={() => { mutation.clearFailure(); setRemoving({ schedule }); }} aria-label={`Remove account schedule for ${schedule.name}`} className={`${secondaryButtonClass} disabled:opacity-50`}>Remove schedule</button></div></li>)}</ul></details>
    </>}
    {editor && <ScheduleForm schedule={editor.schedule} month={state.month} storage="account" onReload={reload} onClose={() => setEditor(null)} onSave={async (schedule, editing) => { const result = await mutation.run((signal) => api.saveSchedule(schedule, editing, signal)); if (!result.error) { setNotice(editing ? 'Account schedule updated.' : 'Account schedule added.'); if (!editing) state.setMonth(schedule.startMonth); } return result; }} />}
    {recording && <RecordPaymentForm payment={recording} month={state.month} today={today} onReload={reload} onClose={() => setRecording(null)} onSave={async (_id, month, date) => { const result = await mutation.run((signal) => api.recordPayment(recording, month, date, signal)); if (!result.error) setNotice('Payment recorded as one linked account expense.'); return result; }} />}
    {removing && <Modal title={removing.payment ? `Remove payment: ${removing.payment.name}?` : `Remove schedule: ${removing.schedule.name}?`} description={removing.payment ? `This deletes the ${formatINR(removing.payment.paidAmountPaise)} expense paid on ${formatDate(removing.payment.paidDate)} and its bill recording. It cannot be undone automatically. It does not refund money.` : 'This deletes the unpaid schedule from your account. It has no recorded payment history. Removal has no undo.'} onClose={() => { if (!mutation.pending) setRemoving(null); }}>
      {mutation.failure && <p role="alert" className="mt-4 text-sm leading-6 text-rose-800">{mutation.failure.error}</p>}
      <div className="mt-6 flex flex-wrap justify-end gap-3"><button type="button" disabled={mutation.pending} onClick={() => setRemoving(null)} className={secondaryButtonClass}>Cancel</button>{mutation.failure?.requiresReload ? <button type="button" onClick={reload} className={primaryButtonClass}>Reload account records</button> : <button type="button" disabled={mutation.pending} className={`${primaryButtonClass} disabled:opacity-50`} onClick={async () => { const result = await mutation.run((signal) => removing.payment ? api.removePayment(removing.payment.recordedPayment, signal) : api.removeSchedule(removing.schedule, signal)); if (!result.error) { setRemoving(null); setNotice(removing.payment ? 'Payment recording and linked expense removed.' : 'Account schedule removed.'); } }}>{mutation.pending ? 'Removing…' : removing.payment ? 'Remove recording and expense' : 'Remove account schedule'}</button>}</div>
    </Modal>}
  </section>;
}
