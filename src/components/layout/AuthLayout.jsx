import { useEffect } from 'react';
import { Link, Outlet, useLocation } from 'react-router';

export default function AuthLayout() {
  const { pathname } = useLocation();
  useEffect(() => {
    const title = { '/login': 'Sign in', '/register': 'Create account', '/forgot-password': 'Forgot password', '/reset-password': 'Reset password' }[pathname] ?? 'Sign in';
    document.title = `${title} | SpendWise`;
    window.scrollTo(0, 0);
  }, [pathname]);
  return <div className="min-h-screen bg-slate-50">
    <header className="border-b border-slate-200 bg-white px-5 py-5 sm:px-8"><Link to="/login" className="mx-auto flex max-w-6xl items-center gap-3 text-xl font-bold tracking-tight" aria-label="SpendWise sign in"><span aria-hidden="true" className="grid size-10 place-items-center rounded-xl bg-indigo-600 text-white">₹</span>SpendWise</Link></header>
    <main id="main-content" className="mx-auto max-w-6xl px-5 py-10 sm:py-14"><Outlet /></main>
  </div>;
}
