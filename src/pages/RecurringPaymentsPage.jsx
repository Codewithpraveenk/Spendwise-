import { useSearchParams } from 'react-router';
import { useState } from 'react';
import SummaryCard from '../components/dashboard/SummaryCard';
import PaymentList from '../components/recurring/PaymentList';
import MonthSelect from '../components/ui/MonthSelect';
import useMonthQuery from '../hooks/useMonthQuery';
import ScheduleForm from '../components/recurring/ScheduleForm';
import RecordPaymentForm from '../components/recurring/RecordPaymentForm';
import Modal from '../components/ui/Modal';
import { useTransactions } from '../state/TransactionsContext';
import { getPaymentOccurrences, paymentStatusLabels } from '../utils/planning';
import { formatDate, formatMonth } from '../utils/formatters';
import StorageView from '../components/layout/StorageView';
import AccountRecurring from '../components/recurring/AccountRecurring';

const statusOptions = ['all', 'unpaid', 'overdue', 'due-today', 'upcoming', 'paid'];

export default function RecurringPaymentsPage() {
  return <StorageView local={LocalRecurringPage} account={AccountRecurring} />;
}

function LocalRecurringPage() {
  const { transactions, recurringPayments, today, saveSchedule, deleteSchedule, recordPayment } = useTransactions();
  const [editor, setEditor] = useState(null);
  const [recording, setRecording] = useState(null);
  const [removing, setRemoving] = useState(null);
  const { month, monthLabel, setMonth } = useMonthQuery();
  const [params, setParams] = useSearchParams();
  const status = statusOptions.includes(params.get('status')) ? params.get('status') : 'all';
  const occurrences = getPaymentOccurrences(recurringPayments, transactions, month, today);
  const visible = occurrences.filter((item) => status === 'all' || (status === 'unpaid' ? item.status !== 'paid' : item.status === status));
  const sum = (items) => items.reduce((total, item) => total + item.amountPaise, 0);
  const unpaid = occurrences.filter((item) => item.status !== 'paid');
  const overdue = occurrences.filter((item) => item.status === 'overdue');

  function setStatus(value) {
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      if (value === 'all') next.delete('status');
      else next.set('status', value);
      return next;
    }, { replace: true });
  }

  return (
    <>
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div><h1 className="text-3xl font-semibold tracking-tight">Recurring payments</h1><p className="mt-2 text-sm leading-6 text-slate-500">Monthly bills and subscriptions, ordered by due date.</p></div>
        <MonthSelect value={month} onChange={setMonth} />
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-slate-500">As of <time dateTime={today}>{formatDate(today)}</time> · India time</p><button type="button" onClick={() => setEditor({ schedule: null })} className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700">Add monthly schedule</button></div>
      <dl className="mt-6 grid gap-4 md:grid-cols-3">
        <SummaryCard title="Scheduled this month" amountPaise={sum(occurrences)} description={`${occurrences.length} monthly payments`} />
        <SummaryCard title="Still to pay" amountPaise={sum(unpaid)} description={`${unpaid.length} unpaid, including overdue payments`} />
        <SummaryCard title="Overdue" amountPaise={sum(overdue)} tone={overdue.length ? 'negative' : 'neutral'} description={`${overdue.length} past the due date`} />
      </dl>
      <section aria-labelledby="payment-schedule-heading" className="mt-6 rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
        <div className="mb-6 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div><h2 id="payment-schedule-heading" className="font-semibold">Payment schedule</h2><p role="status" className="mt-1 text-sm text-slate-500">{visible.length} of {occurrences.length} payments in {monthLabel}</p></div>
          <div className="w-full sm:w-48"><label htmlFor="payment-status" className="mb-2 block text-xs font-medium text-slate-600">Status</label><select id="payment-status" value={status} onChange={(event) => setStatus(event.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm"><option value="all">All statuses</option><option value="unpaid">All unpaid</option>{statusOptions.slice(2).map((value) => <option key={value} value={value}>{paymentStatusLabels[value]}</option>)}</select></div>
        </div>
        <div className="max-w-3xl"><PaymentList items={visible} onRecord={setRecording} emptyMessage={occurrences.length ? 'No payments match this status.' : 'No payments scheduled for this month.'} /></div>
        {visible.length === 0 && status !== 'all' && <button type="button" onClick={() => setStatus('all')} className="mt-3 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50">Show all statuses</button>}
      </section>
      <p className="mt-4 text-xs leading-5 text-slate-500">Summary amounts cover the full selected month, regardless of the status filter. Scheduled amounts are separate from recorded expenses. Paid entries are linked to existing transactions.</p>
      <details className="mt-6 rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
        <summary className="w-fit cursor-pointer font-semibold">Manage monthly schedules ({recurringPayments.length})</summary>
        <p className="mt-3 text-sm leading-6 text-slate-500">Includes schedules outside the selected month. Edit a schedule’s final month to stop future occurrences.</p>
        <ul className="mt-4 divide-y divide-slate-100">{recurringPayments.map((schedule) => <li key={schedule.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><div><h2 className="text-sm font-medium">{schedule.name}</h2><p className="mt-1 text-xs text-slate-500">{formatMonth(schedule.startMonth)} → {schedule.endMonth ? formatMonth(schedule.endMonth) : 'Ongoing'} · Due day {schedule.dueDay}</p></div><div className="flex gap-2"><button type="button" onClick={() => setEditor({ schedule })} aria-label={`Edit schedule for ${schedule.name}`} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium hover:bg-slate-50">Edit schedule</button><button type="button" onClick={() => setRemoving(schedule)} aria-label={`Remove schedule for ${schedule.name}`} className="rounded-lg px-3 py-2 text-xs font-medium text-slate-500 hover:bg-slate-100">Remove</button></div></li>)}</ul>
      </details>
      {editor && <ScheduleForm schedule={editor.schedule} month={month} onSave={(schedule, isEditing) => { const result = saveSchedule(schedule, isEditing); if (!result.error) setParams({ month: schedule.startMonth }, { replace: true }); return result; }} onClose={() => setEditor(null)} />}
      {recording && <RecordPaymentForm payment={recording} month={month} today={today} onSave={recordPayment} onClose={() => setRecording(null)} />}
      {removing && <Modal title={`Remove ${removing.name} schedule?`} description="This removes the schedule and its bill history from this page. Recorded expenses stay in Transactions. Set a final month instead if you want to keep the schedule history. Removal cannot be undone automatically." onClose={() => setRemoving(null)}><div className="mt-6 flex flex-wrap justify-end gap-3"><button type="button" autoFocus onClick={() => setRemoving(null)} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium hover:bg-slate-50">Keep schedule</button><button type="button" onClick={() => { deleteSchedule(removing.id); setRemoving(null); }} className="rounded-lg bg-rose-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-rose-800">Remove schedule</button></div></Modal>}
    </>
  );
}
