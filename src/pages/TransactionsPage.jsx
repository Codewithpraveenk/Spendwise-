import StorageView from '../components/layout/StorageView';
import AccountTransactions from '../components/transactions/AccountTransactions';

export default function TransactionsPage() {
  return <StorageView account={AccountTransactions} />;
}
