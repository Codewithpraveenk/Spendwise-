import { Navigate, Outlet } from 'react-router';
import { useAuth } from '../../state/useAuth';
import { TransactionsProvider } from '../../state/TransactionsContext';

export default function RequireAccount() {
  const { user, status } = useAuth();
  if (status === 'loading') return <main className="grid min-h-screen place-items-center px-5"><p role="status" className="text-sm text-slate-600">Checking your session…</p></main>;
  if (!user) return <Navigate to="/login" replace />;
  // Mount browser-backup support only after authentication, and reset it between users.
  return <TransactionsProvider key={user.id}><Outlet /></TransactionsProvider>;
}
