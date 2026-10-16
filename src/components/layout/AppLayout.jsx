import { Link, NavLink, Outlet, useLocation, useSearchParams } from 'react-router';
import { useEffect, useRef } from 'react';
import { useAuth } from '../../state/useAuth';

const navigation = [
  { to: '/', label: 'Overview', mark: '01' },
  { to: '/transactions', label: 'Transactions', mark: '02' },
  { to: '/budgets', label: 'Budgets', mark: '03' },
  { to: '/recurring', label: 'Recurring payments', mark: '04' },
  { to: '/data', label: 'Data & backups', mark: '05' },
  { to: '/account', label: 'Account', mark: '06' },
];

export default function AppLayout() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const [params] = useSearchParams();
  const accountLink = (path) => ['/', '/transactions', '/budgets', '/recurring', '/data'].includes(path) ? `${path}?source=account${params.get('month') ? `&month=${encodeURIComponent(params.get('month'))}` : ''}` : path;
  const mainRef = useRef(null);
  const previousPath = useRef(null);
  useEffect(() => {
    const page = navigation.find((item) => item.to === pathname)?.label ?? ({ '/login': 'Sign in', '/register': 'Create account', '/forgot-password': 'Forgot password', '/reset-password': 'Reset password' }[pathname] ?? 'Page not found');
    document.title = `${page} | SpendWise`;
    if (previousPath.current !== null && previousPath.current !== pathname) {
      mainRef.current?.focus({ preventScroll: true });
      window.scrollTo(0, 0);
    }
    previousPath.current = pathname;
  }, [pathname]);
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[248px_minmax(0,1fr)]">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:p-3">
        Skip to content
      </a>
      <aside className="bg-[#101b33] px-5 py-7 text-white lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:px-6 lg:py-9">
        <NavLink to={accountLink('/')} className="flex items-center gap-3 text-xl font-bold tracking-tight" aria-label="SpendWise home">
          <span aria-hidden="true" className="grid size-10 place-items-center rounded-xl bg-indigo-500">₹</span>
          SpendWise
        </NavLink>
        <p className="mt-2 text-xs text-slate-400">Student finance manager</p>
        <nav aria-label="Main navigation" className="mt-7 flex gap-2 overflow-x-auto pb-2 lg:mt-12 lg:flex-col">
          {navigation.map(({ to, label, mark }) => (
            <NavLink key={to} to={accountLink(to)} end={to === '/'} className={({ isActive }) => `flex shrink-0 items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors ${isActive ? 'bg-indigo-500 text-white' : 'text-slate-300 hover:bg-white/10 hover:text-white'}`}>
              <span aria-hidden="true" className="text-xs opacity-60">{mark}</span>{label}
            </NavLink>
          ))}
        </nav>
        <p className="mt-auto hidden pt-8 text-xs text-slate-400 lg:block">Account workspace · Server storage</p>
      </aside>
      <div className="min-w-0">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 bg-white px-5 py-5 sm:px-8 lg:px-10">
          <div>
            <p className="text-sm font-medium text-slate-700">Account workspace</p>
            <p className="mt-1 text-xs text-slate-500">All amounts in INR</p>
          </div>
          <div className="flex flex-wrap items-center gap-3"><span className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-500">Saved to your account</span><Link to="/account" className="inline-flex min-h-11 items-center rounded-lg border border-slate-200 px-3 text-sm font-medium text-indigo-700">{user?.name || 'Your account'}</Link></div>
        </header>
        <main ref={mainRef} id="main-content" tabIndex={-1} className="mx-auto max-w-7xl px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
