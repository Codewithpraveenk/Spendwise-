import { secondaryButtonClass } from '../ui/FormField';

export default function AccountMonthStatus({ state }) {
  if (state.ready) return null;
  return state.status === 'error' ? <div role="alert" className="mt-6 rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-900"><p>{state.error.message}</p><button type="button" onClick={state.reload} className={`${secondaryButtonClass} mt-3 bg-white`}>Retry account month</button></div> : <p role="status" className="mt-6 rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">Loading account month…</p>;
}
