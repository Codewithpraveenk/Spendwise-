import { useAuth } from '../../state/useAuth';

// Finance pages always use the signed-in account, including old local-view URLs.
export default function StorageView({ account: AccountPage }) {
  const { user } = useAuth();
  return user ? <AccountPage key={user.id} /> : null;
}

export function AccountStorageNotice() {
  return <p className="mt-4 text-sm leading-6 text-slate-500">These records are saved to your account. Only transactions you add or explicitly import contribute to your totals.</p>;
}
