import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../../state/useAuth';
import { useTransactions } from '../../state/TransactionsContext';
import { createAccountWorkspaceApi, checkedWorkspace, workspaceCounts } from '../../services/accountWorkspaceApi';
import { createBackup, createTransactionsCsv, MAX_BACKUP_BYTES, parseBackup } from '../../services/workspaceBackup';
import { downloadText } from '../../utils/download';
import Modal from '../ui/Modal';
import { primaryButtonClass, secondaryButtonClass } from '../ui/FormField';

const api = createAccountWorkspaceApi();
const summary = (counts) => `${counts.transactions} transactions · ${counts.budgets} budgets · ${counts.schedules} schedules · ${counts.payments} payment links`;

export default function AccountData() {
  const { user, expire } = useAuth();
  const { transactions, budgets, recurringPayments, today } = useTransactions();
  const [snapshot, setSnapshot] = useState(null);
  const [candidate, setCandidate] = useState(null);
  const [preview, setPreview] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [uncertain, setUncertain] = useState(false);
  const operation = useRef(null);
  const mounted = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; operation.current?.abort(); }; }, []);

  async function run(work) {
    if (operation.current) return;
    const controller = new AbortController(); operation.current = controller; setBusy(true); setError(''); setMessage('');
    try { await work(controller.signal); }
    catch (failure) {
      if (controller.signal.aborted || !mounted.current) return;
      if (failure.status === 401) expire();
      else setError(failure.message || 'The request could not be completed.');
    } finally { if (operation.current === controller) operation.current = null; if (mounted.current) setBusy(false); }
  }
  function select(workspace, name) {
    setError(''); setMessage(''); setPreview(null); setUncertain(false); setConfirming(false);
    try { setCandidate({ workspace: checkedWorkspace(workspace), name, requestId: crypto.randomUUID() }); }
    catch (failure) { setCandidate(null); setError(failure.message); }
  }
  async function chooseFile(event) {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file) return;
    setCandidate(null); setPreview(null); setUncertain(false);
    if (file.size > MAX_BACKUP_BYTES) { setError('Choose a SpendWise backup smaller than 5 MB.'); return; }
    await run(async (signal) => {
      const text = await file.text();
      if (!signal.aborted) select(parseBackup(text), file.name);
    });
  }
  function exportData(type) {
    run(async (signal) => {
      setSnapshot(null);
      const workspace = await api.export(signal);
      if (signal.aborted) return;
      if (type === 'json') downloadText(createBackup(workspace), `spendwise-account-backup-${today}.json`, 'application/json;charset=utf-8');
      else downloadText(createTransactionsCsv(workspace.transactions), `spendwise-account-transactions-${today}.csv`, 'text/csv;charset=utf-8');
      setSnapshot(workspaceCounts(workspace)); setMessage('Complete account export downloaded. Keep this file somewhere private.');
    });
  }
  function validateImport() {
    run(async (signal) => { setPreview(null); const data = await api.preview(candidate.workspace, signal); if (!signal.aborted) { setPreview(data); setMessage('Server validation complete. Review the account and counts before importing.'); } });
  }
  function commitImport() {
    run(async (signal) => {
      try {
        const result = await api.import(candidate.workspace, candidate.requestId, signal);
        if (signal.aborted) return;
        setSnapshot(result.counts); setCandidate(null); setPreview(null); setConfirming(false); setUncertain(false);
        setMessage(result.replayed ? 'The earlier import was already saved. No duplicate records were created.' : 'Import complete. Account records and payment links were saved together. Your local workspace is unchanged.');
      } catch (failure) {
        if (!signal.aborted && mounted.current) { setConfirming(false); setUncertain(!failure.status || failure.status >= 500); if (failure.status && failure.status < 500) setPreview(null); }
        throw failure;
      }
    });
  }
  return <>
    <h1 className="text-3xl font-semibold tracking-tight">Account data & backups</h1>
    <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">Download all months from your account, or review a first import into an empty account. Signed in as <strong className="break-all text-slate-700">{user.email}</strong>.</p>
    <div role="status" aria-live="polite" className="mt-5 text-sm text-slate-600">{busy ? 'Working with your account…' : message}</div>
    {error && <p role="alert" className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error}</p>}
    <fieldset disabled={busy} aria-busy={busy} className="mt-6 min-w-0"><legend className="sr-only">Account data tools</legend>
      <div className="grid items-start gap-6 xl:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6" aria-labelledby="account-export-heading">
          <h2 id="account-export-heading" className="font-semibold">Download account records</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">A consistent database snapshot includes all transactions, category budgets, schedules, and linked payments. Account and local records are never mixed.</p>
          {snapshot && <p className="mt-4 text-sm leading-6 text-slate-700">Last confirmed snapshot: {summary(snapshot)}</p>}
          <div className="mt-5 flex flex-wrap gap-3"><button type="button" onClick={() => exportData('json')} className={primaryButtonClass}>Download account backup</button><button type="button" onClick={() => exportData('csv')} className={secondaryButtonClass}>Download account CSV</button></div>
          <p className="mt-4 text-xs leading-5 text-slate-500">JSON can be reviewed for an initial import into another empty account or restored in the local workspace. CSV is for spreadsheets. Neither download includes passwords or session tokens.</p>
        </section>
        <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6" aria-labelledby="account-import-heading">
          <h2 id="account-import-heading" className="font-semibold">Review your first account import</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">Import once into an empty account. Existing account records cannot be replaced or merged here. Download a local backup first if you want an extra copy.</p>
          <button type="button" disabled={uncertain} onClick={() => select({ version: 2, transactions, budgets, recurringPayments }, 'Current local workspace')} className={`mt-5 ${secondaryButtonClass}`}>Review local workspace</button>
          <label htmlFor="account-backup-file" className="mb-2 mt-5 block text-sm font-medium">Or choose a SpendWise JSON backup</label>
          <input id="account-backup-file" type="file" accept=".json,application/json" disabled={uncertain} onChange={chooseFile} aria-describedby="account-import-help" className="block w-full min-w-0 rounded-lg border border-slate-300 p-2 text-sm file:mr-3 file:rounded-md file:border-0 file:px-3 file:py-2" />
          <p id="account-import-help" className="mt-2 text-xs leading-5 text-slate-500">Maximum 5 MB, 10,000 transactions, 10,000 budgets and 1,000 schedules. Broken payment links and future transaction dates are rejected.</p>
          {candidate && <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <h3 className="break-all text-sm font-medium">{candidate.name}</h3><p className="mt-2 text-sm leading-6">{summary(workspaceCounts(candidate.workspace))}</p>
            <p className="mt-2 text-xs leading-5 text-slate-500">Validate sends these records to your signed-in account’s server for checking. It saves no financial records.</p>
            {!uncertain && <button type="button" onClick={validateImport} className={`mt-4 ${secondaryButtonClass}`}>Validate import with account</button>}
            {preview && <><p className="mt-4 text-sm leading-6">Current account: {summary(preview.current)}</p>{preview.canImport ? !uncertain && <button type="button" onClick={() => setConfirming(true)} className={`mt-4 ${primaryButtonClass}`}>Review and confirm import</button> : <p role="status" className="mt-3 text-sm leading-6 text-amber-900">Import unavailable: this account contains records or already completed its first import. Your data has not been changed.</p>}</>}
            {uncertain && <><p className="mt-4 text-sm leading-6 text-amber-900">The server may already have saved this import. Retry this exact request to confirm the result; its request ID prevents duplicates. Do not start a different import.</p><button type="button" onClick={commitImport} className={`mt-4 ${primaryButtonClass}`}>Retry same import safely</button></>}
          </div>}
        </section>
      </div>
    </fieldset>
    <p className="mt-5 text-xs leading-5 text-slate-500">Account backups require the backend and a connected MongoDB replica set or Atlas cluster. Downloads contain private financial records.</p>
    <Link to="/?source=account" className="mt-5 inline-block text-sm font-medium text-indigo-700 underline">Open account overview</Link>
    {confirming && candidate && preview?.canImport && <Modal title="Import into this account?" description={`Save ${summary(preview.counts)} into ${user.email}. IDs will be regenerated and payment links preserved. Your local workspace stays unchanged. This is a one-time initial import; it cannot replace existing account records.`} onClose={() => { if (!busy) setConfirming(false); }}><div className="mt-6 flex flex-wrap justify-end gap-3"><button type="button" autoFocus disabled={busy} onClick={() => setConfirming(false)} className={secondaryButtonClass}>Keep reviewing</button><button type="button" disabled={busy} onClick={commitImport} className={primaryButtonClass}>{busy ? 'Importing…' : 'Import reviewed records'}</button></div></Modal>}
  </>;
}
