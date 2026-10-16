import { Link } from 'react-router';
import { useAuth } from '../state/useAuth';
import { primaryButtonClass, secondaryButtonClass } from '../components/ui/FormField';

export function AccountError({ error }) {
  if (!error) return null;
  return <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm leading-6 text-rose-900">
    <p>{error.message}</p>
    {import.meta.env.DEV && (error.code === 'NETWORK_ERROR' || (error.code === 'INVALID_RESPONSE' && error.status >= 500)) && <p className="mt-2">For local development, start both services from your project’s VS Code terminal with <code className="font-semibold">npm run dev</code>. Check them with <code className="font-semibold">npm run doctor</code>.</p>}
    {error.code === 'DATABASE_UNAVAILABLE' && <p className="mt-1">The backend needs a working MongoDB connection before accounts are available.</p>}
    {error.status === 429 && <p className="mt-1">Wait before trying again{error.retryAfter ? ` (about ${Math.ceil(Number(error.retryAfter) / 60)} minutes)` : ''}.</p>}
  </div>;
}

export default function AccountPage() {
  const { user, status, error, refresh, logout } = useAuth();
  const busy = status === 'loading' || status === 'submitting';
  return <section className="max-w-2xl">
    <p className="text-xs font-semibold uppercase tracking-widest text-indigo-600">Your account</p>
    <h1 className="mt-2 text-3xl font-bold tracking-tight">Account & sign-in</h1>
    <p className="mt-3 text-sm leading-6 text-slate-600">Manage your SpendWise session.</p>
    <div className="mt-7 rounded-xl border border-slate-200 bg-white p-5 sm:p-7" aria-busy={busy}>
      <div className="space-y-5">
        {status === 'loading' && <p role="status" className="text-sm text-slate-600">Checking your session…</p>}
        <AccountError error={error} />
        {user ? <>
          <div><h2 className="text-xl font-semibold break-words">{user.name}</h2><p className="mt-2 break-all text-sm text-slate-600">{user.email}</p></div>
          <p className="text-sm leading-6 text-slate-600">You’re signed in. Your finance pages use this account’s saved records. Signing out returns you to the sign-in page.</p>
          <button type="button" disabled={busy} onClick={logout} className={`${secondaryButtonClass} disabled:opacity-50`}>{status === 'submitting' ? 'Signing out…' : 'Sign out'}</button>
          <Link to="/forgot-password" className="inline-flex min-h-11 items-center text-sm font-medium text-indigo-700 underline">Reset your password by email</Link>
        </> : status !== 'loading' && <>
          <h2 className="text-lg font-semibold">{error ? 'Account connection needs attention' : 'You’re browsing locally'}</h2>
          <p className="text-sm leading-6 text-slate-600">Sign in to an existing account or create one. You can keep using the local workspace without an account.</p>
          <div className="flex flex-wrap gap-3"><Link to="/login" className={primaryButtonClass}>Sign in</Link><Link to="/register" className={secondaryButtonClass}>Create account</Link>{error && <button type="button" onClick={refresh} className={secondaryButtonClass}>Retry connection</button>}</div>
        </>}
      </div>
    </div>
    <div className="mt-5 rounded-lg border border-indigo-100 bg-indigo-50 p-4 text-sm leading-6 text-indigo-950"><strong>Account storage:</strong> Your dashboard, transactions, budgets and recurring payments use your saved account records. New accounts start empty. Older browser records can only be imported through the reviewed import in Data & backups.<Link to="/" className="mt-3 block font-medium underline">Open overview</Link><Link to="/data" className="mt-2 block font-medium underline">Open backups</Link></div>
  </section>;
}
