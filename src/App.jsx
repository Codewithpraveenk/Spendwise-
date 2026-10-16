import { Link, Route, Routes } from 'react-router';
import AppLayout from './components/layout/AppLayout';
import OverviewPage from './pages/OverviewPage';
import TransactionsPage from './pages/TransactionsPage';
import BudgetsPage from './pages/BudgetsPage';
import RecurringPaymentsPage from './pages/RecurringPaymentsPage';
import DataPage from './pages/DataPage';
import AccountPage from './pages/AccountPage';
import AuthPage from './pages/AuthPage';
import RecoveryPage from './pages/RecoveryPage';

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<OverviewPage />} />
        <Route path="transactions" element={<TransactionsPage />} />
        <Route path="budgets" element={<BudgetsPage />} />
        <Route path="recurring" element={<RecurringPaymentsPage />} />
        <Route path="data" element={<DataPage />} />
        <Route path="account" element={<AccountPage />} />
        <Route path="login" element={<AuthPage key="login" />} />
        <Route path="register" element={<AuthPage key="register" registering />} />
        <Route path="forgot-password" element={<RecoveryPage key="forgot-password" />} />
        <Route path="reset-password" element={<RecoveryPage key="reset-password" resetting />} />
        <Route path="*" element={<section><h1 className="text-3xl font-bold">Page not found</h1><p className="mt-3 text-slate-600">This address does not match a SpendWise page.</p><Link className="mt-5 inline-block text-indigo-700 underline" to="/">Return to overview</Link></section>} />
      </Route>
    </Routes>
  );
}
