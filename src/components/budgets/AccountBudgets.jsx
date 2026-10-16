import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import useAccountMonth from '../../hooks/useAccountMonth';
import { useAuth } from '../../state/useAuth';
import { createFinanceApi, transactionFailure } from '../../services/financeApi';
import { getBudgetProgress } from '../../utils/planning';
import { formatINR } from '../../utils/formatters';
import BudgetForm from './BudgetForm';
import BudgetList from './BudgetList';
import SummaryCard from '../dashboard/SummaryCard';
import MonthSelect from '../ui/MonthSelect';
import Modal from '../ui/Modal';
import { primaryButtonClass, secondaryButtonClass } from '../ui/FormField';
import { AccountStorageNotice } from '../layout/StorageView';
import AccountMonthStatus from '../layout/AccountMonthStatus';

const api = createFinanceApi();

export default function AccountBudgets() {
  const state = useAccountMonth();
  const { status: authStatus, expire } = useAuth();
  const [editor, setEditor] = useState(null);
  const [removing, setRemoving] = useState(null);
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState(null);
  const [notice, setNotice] = useState('');
  const operation = useRef(null);
  const mounted = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; operation.current?.abort(); }; }, []);
  const busy = pending || authStatus !== 'authenticated' || Boolean(failure?.requiresReload);
  const progress = state.ready ? getBudgetProgress(state.budgets, state.transactions, state.month) : null;
  const reload = () => { setEditor(null); setRemoving(null); setFailure(null); state.reload(); };
  async function mutate(work) {
    if (operation.current || busy) return { error: 'Wait for the current account request to finish.' };
    const controller = new AbortController(); operation.current = controller; setPending(true); setFailure(null);
    try {
      await work(controller.signal);
      if (!mounted.current || controller.signal.aborted) return { error: 'Return to account budgets to check the saved result.', requiresReload: true };
      state.reload();
      return { error: null };
    } catch (error) {
      if (error.status === 401) expire();
      const result = transactionFailure(error);
      if (mounted.current) setFailure(result);
      return result;
    } finally { if (operation.current === controller) operation.current = null; if (mounted.current) setPending(false); }
  }
  return <section>
    <div className="flex flex-wrap items-end justify-between gap-4"><div><h1 className="text-3xl font-semibold tracking-tight">Account budgets</h1><p className="mt-2 text-sm text-slate-600">Server category limits compared with account expenses.</p></div><MonthSelect value={state.month} onChange={(value) => { if (!pending) { setNotice(''); setFailure(null); state.setMonth(value); } }} /></div>
    <AccountStorageNotice />
    <div className="mt-5 flex flex-wrap gap-3"><button type="button" disabled={!state.ready || busy} onClick={() => setEditor({ budget: null })} className={`${primaryButtonClass} disabled:opacity-50`}>Add account budget</button><button type="button" disabled={pending} onClick={reload} className={`${secondaryButtonClass} disabled:opacity-50`}>Reload account month</button></div>
    <p role="status" className="mt-4 text-sm text-emerald-800">{notice}</p>
    {failure && !editor && !removing && <p role="alert" className="mt-4 rounded-lg bg-amber-50 p-4 text-sm leading-6 text-amber-950">{failure.error}</p>}
    <AccountMonthStatus state={state} />
    {state.ready && <>
      <dl className="mt-6 grid gap-4 md:grid-cols-3"><SummaryCard title="Planned budget" amountPaise={progress.limitPaise} description={`Across ${progress.items.length} account categories`} /><SummaryCard title="Spent in planned categories" amountPaise={progress.spentPaise} description="Derived from account expenses" /><SummaryCard title="Remaining overall" amountPaise={progress.remainingPaise} tone={progress.remainingPaise < 0 ? 'negative' : 'neutral'} description="Check individual overspent categories below" /></dl>
      <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5 sm:p-6"><h2 className="font-semibold">Account category limits</h2><p className="mb-6 mt-2 text-sm text-slate-500">{state.monthLabel} · Near limit means at least 80% used. Overspending stays visible above 100%.</p><BudgetList items={progress.items} onEdit={!busy ? (budget) => setEditor({ budget }) : undefined} onRemove={!busy ? (budget) => { setFailure(null); setRemoving(budget); } : undefined} /></section>
      {progress.unbudgeted.length > 0 && <section className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-5"><h2 className="font-semibold">Account expenses without a budget</h2><p className="mt-2 text-sm leading-6">{formatINR(progress.unbudgetedPaise)} is outside the planned categories and excluded from the planned-spending total.</p><ul className="mt-3 space-y-2 text-sm">{progress.unbudgeted.map((item) => <li key={item.category} className="flex flex-wrap justify-between gap-2"><span>{item.category}</span><span>{formatINR(item.amountPaise)}</span></li>)}</ul></section>}
      <Link to={`/transactions?source=account&month=${state.month}&type=expense`} className="mt-5 inline-flex min-h-11 items-center text-sm font-medium text-indigo-700 underline">Review account expenses</Link>
    </>}
    {editor && <BudgetForm budget={editor.budget} month={state.month} budgets={state.budgets} storage="account" onReload={reload} onClose={() => setEditor(null)} onSave={async (budget, editing) => { const result = await mutate((signal) => api.saveBudget(budget, editing, signal)); if (!result.error) setNotice(editing ? 'Account budget updated.' : 'Account budget added.'); return result; }} />}
    {removing && <Modal title={`Remove ${removing.category} account budget?`} description="This deletes the server limit without deleting any expenses. Spending in this category becomes unbudgeted. This removal has no undo." onClose={() => { if (!pending) setRemoving(null); }}>
      {failure && <p role="alert" className="mt-4 text-sm leading-6 text-rose-800">{failure.error}</p>}
      <div className="mt-6 flex flex-wrap justify-end gap-3"><button type="button" disabled={pending} onClick={() => setRemoving(null)} className={secondaryButtonClass}>Keep budget</button>{failure?.requiresReload ? <button type="button" onClick={reload} className={primaryButtonClass}>Reload account month</button> : <button type="button" disabled={pending} onClick={async () => { const result = await mutate((signal) => api.removeBudget(removing, signal)); if (!result.error) { setRemoving(null); setNotice('Account budget removed. Expenses were kept.'); } }} className={`${primaryButtonClass} disabled:opacity-50`}>{pending ? 'Removing…' : 'Remove account budget'}</button>}</div>
    </Modal>}
  </section>;
}
