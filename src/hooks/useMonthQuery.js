import { useSearchParams } from 'react-router';
import { useTransactions } from '../state/TransactionsContext';
import { isValidMonth } from '../utils/planningValidation';
import { formatMonth } from '../utils/formatters';

export default function useMonthQuery() {
  const { defaultMonth } = useTransactions();
  const [params, setParams] = useSearchParams();
  const month = isValidMonth(params.get('month')) ? params.get('month') : defaultMonth;
  function setMonth(value) {
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      next.set('month', value);
      return next;
    }, { replace: true });
  }
  return { month, monthLabel: formatMonth(month), setMonth };
}
