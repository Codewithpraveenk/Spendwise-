import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { createFinanceApi, loadAccountMonth } from '../services/financeApi';
import { isValidMonth } from '../utils/planningValidation';
import { getToday } from '../utils/transactionValidation';
import { formatMonth } from '../utils/formatters';
import { useAuth } from '../state/useAuth';

const api = createFinanceApi();

export default function useAccountMonth(includeRecurring = false) {
  const { user, expire } = useAuth();
  const [params, setParams] = useSearchParams();
  const month = isValidMonth(params.get('month')) ? params.get('month') : getToday().slice(0, 7);
  const [data, setData] = useState({ month: null, status: 'loading' });
  const [revision, setRevision] = useState(0);
  const reload = useCallback(() => { setData({ month: null, status: 'loading' }); setRevision((value) => value + 1); }, []);
  const setMonth = useCallback((value) => {
    if (isValidMonth(value)) setParams({ source: 'account', month: value }, { replace: true });
  }, [setParams]);
  useEffect(() => {
    const controller = new AbortController();
    setData({ month, status: 'loading' });
    loadAccountMonth(api, month, controller.signal, includeRecurring).then((records) => {
      if (!controller.signal.aborted) setData({ ...records, month, status: 'ready', loadedAt: new Date() });
    }).catch((error) => {
      if (controller.signal.aborted) return;
      controller.abort();
      if (error.status === 401) expire();
      else setData({ month, status: 'error', error });
    });
    return () => controller.abort();
  }, [month, revision, user.id, expire, includeRecurring]);
  return { ...data, month, monthLabel: formatMonth(month), ready: data.month === month && data.status === 'ready', reload, setMonth };
}
