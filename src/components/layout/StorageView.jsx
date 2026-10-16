import { Link, useSearchParams } from 'react-router';
import { useAuth } from '../../state/useAuth';
import { primaryButtonClass } from '../ui/FormField';

export default function StorageView({ local: LocalPage, account: AccountPage }) {
  const [params, setParams] = useSearchParams();
  const { user, status } = useAuth();
  const account = params.get('source') === 'account';
  return <>
    <div role="group" aria-label="Workspace storage" className="mb-6 flex flex-wrap gap-2">
      {[['local', 'Local workspace'], ['account', 'Account data']].map(([source, label]) => <button key={source} type="button" aria-pressed={account === (source === 'account')} onClick={() => setParams(source === 'account' ? { source: 'account', ...(params.get('month') ? { month: params.get('month') } : {}) } : {}, { replace: true })} className={`rounded-lg border px-4 py-2.5 text-sm font-medium ${account === (source === 'account') ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300 bg-white text-slate-700'}`}>{label}</button>)}
    </div>
    {account ? user ? <AccountPage key={user.id} /> : <section className="rounded-xl border border-slate-200 bg-white p-6"><h1 className="text-2xl font-semibold">Account workspace</h1><p className="mt-3 text-sm leading-6 text-slate-600">{status === 'loading' ? 'Checking your session…' : 'Sign in to view private account records. Your local workspace is available separately.'}</p>{status !== 'loading' && <Link to="/login" className={`${primaryButtonClass} mt-5 inline-block`}>Sign in</Link>}</section> : <LocalPage />}
  </>;
}

export function AccountStorageNotice() {
  return <p className="mt-4 rounded-lg border border-indigo-100 bg-indigo-50 p-4 text-sm leading-6 text-indigo-950">This account workspace uses server data. Choose Account data in Data & backups for a complete account export. Local records are never uploaded automatically.</p>;
}
