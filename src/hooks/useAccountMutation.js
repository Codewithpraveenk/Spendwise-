import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../state/useAuth';
import { transactionFailure } from '../services/financeApi';

export default function useAccountMutation(reload) {
  const { status, expire } = useAuth();
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState(null);
  const operation = useRef(null);
  const mounted = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; operation.current?.abort(); }; }, []);
  const busy = pending || status !== 'authenticated' || Boolean(failure?.requiresReload);
  async function run(work) {
    if (busy || operation.current) return { error: 'Wait for the current request to finish.' };
    const controller = new AbortController(); operation.current = controller; setPending(true); setFailure(null);
    try {
      const value = await work(controller.signal);
      if (!mounted.current || controller.signal.aborted) return { error: 'Reload account records to check the saved result.', requiresReload: true };
      reload();
      return { error: null, value };
    } catch (error) {
      if (error.status === 401) expire();
      const result = transactionFailure(error);
      if (mounted.current) setFailure(result);
      return result;
    } finally { if (operation.current === controller) operation.current = null; if (mounted.current) setPending(false); }
  }
  return { run, pending, busy, failure, clearFailure: () => setFailure(null) };
}
