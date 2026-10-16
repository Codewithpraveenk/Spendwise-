import { useEffect, useRef, useState } from 'react';
import { useTransactions } from '../state/TransactionsContext';
import { createBackup, createTransactionsCsv, describeBackup, MAX_BACKUP_BYTES, parseBackup } from '../services/workspaceBackup';
import { downloadText } from '../utils/download';
import Modal from '../components/ui/Modal';
import { primaryButtonClass, secondaryButtonClass } from '../components/ui/FormField';
import StorageView from '../components/layout/StorageView';
import AccountData from '../components/data/AccountData';

export default function DataPage() {
  return <StorageView local={LocalDataPage} account={AccountData} />;
}

function LocalDataPage() {
  const { transactions, budgets, recurringPayments, today, storageError, restoreBackup } = useTransactions();
  const workspace = { version: 2, transactions, budgets, recurringPayments };
  const [pending, setPending] = useState(null);
  const [pendingName, setPendingName] = useState('');
  const [reading, setReading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [confirming, setConfirming] = useState(false);
  const readToken = useRef(0);
  useEffect(() => () => { readToken.current += 1; }, []);

  function exportData(type) {
    setError('');
    setMessage('');
    try {
      if (type === 'json') downloadText(createBackup(workspace), `spendwise-backup-${today}.json`, 'application/json;charset=utf-8');
      else downloadText(createTransactionsCsv(transactions), `spendwise-transactions-${today}.csv`, 'text/csv;charset=utf-8');
      setMessage(type === 'json' ? 'Workspace backup download started.' : 'Transaction CSV download started.');
    } catch (failure) { setError(failure.message || 'The download could not start. Please try again.'); }
  }

  async function chooseFile(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const token = ++readToken.current;
    setPending(null);
    setPendingName('');
    setError('');
    setMessage('');
    if (file.size > MAX_BACKUP_BYTES) { setError('Choose a backup smaller than 5 MB.'); return; }
    setReading(true);
    try {
      let text;
      try { text = await file.text(); }
      catch { throw new Error('The file could not be read. Check that it is still on your device and choose it again.'); }
      if (token !== readToken.current) return;
      const parsed = parseBackup(text);
      setPending(parsed);
      setPendingName(file.name);
      setMessage('Backup validated. Review the counts below before restoring.');
    } catch (failure) {
      if (token !== readToken.current) return;
      setError(failure.message || 'The file could not be read. Choose it again.');
    } finally { if (token === readToken.current) setReading(false); }
  }

  function confirmRestore() {
    const result = restoreBackup(pending);
    if (result.error) { setError(result.error); setConfirming(false); return; }
    setPending(null);
    setPendingName('');
    setConfirming(false);
    setMessage('Backup restored. Review your updated workspace or use Undo restore above.');
  }

  const counts = pending ? describeBackup(pending) : null;
  return (
    <>
      <h1 className="text-3xl font-semibold tracking-tight">Data & backups</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Keep a copy of your workspace or move it to another browser. Downloads contain your records; store them somewhere you trust.</p>
      <div role="status" aria-live="polite" className="mt-5 text-sm text-slate-600">{message}</div>
      {error && <p id="backup-error" role="alert" className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm leading-6 text-rose-800">{error}</p>}
      <div className="mt-6 grid items-start gap-6 xl:grid-cols-2">
        <section aria-labelledby="export-heading" className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
          <h2 id="export-heading" className="font-semibold">Download your data</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">The JSON backup includes transactions, category budgets, and recurring schedules with their payment links.</p>
          <dl className="mt-5 grid grid-cols-3 gap-3 text-sm"><div><dt className="text-xs text-slate-500">Transactions</dt><dd className="mt-1 text-xl font-semibold tabular-nums">{transactions.length}</dd></div><div><dt className="text-xs text-slate-500">Budgets</dt><dd className="mt-1 text-xl font-semibold tabular-nums">{budgets.length}</dd></div><div><dt className="text-xs text-slate-500">Schedules</dt><dd className="mt-1 text-xl font-semibold tabular-nums">{recurringPayments.length}</dd></div></dl>
          <button type="button" onClick={() => exportData('json')} className={`mt-6 ${primaryButtonClass}`}>Download workspace backup</button>
          <div className="mt-6 border-t border-slate-100 pt-5"><h3 className="text-sm font-medium">Transactions for a spreadsheet</h3><p className="mt-2 text-sm leading-6 text-slate-500">CSV exports all transactions in INR, newest first. CSV files cannot restore a workspace.</p><button type="button" onClick={() => exportData('csv')} className={`mt-4 ${secondaryButtonClass}`}>Download transaction CSV</button></div>
          {storageError && <p className="mt-4 text-xs leading-5 text-amber-800">This download uses the records currently shown, including changes that could not be saved in browser storage.</p>}
        </section>
        <section aria-labelledby="restore-heading" aria-busy={reading} className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
          <h2 id="restore-heading" className="font-semibold">Restore a workspace</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">Choose a SpendWise JSON backup. Nothing changes until you review and confirm the replacement.</p>
          <label htmlFor="workspace-backup" className="mb-2 mt-5 block text-sm font-medium text-slate-700">Backup file</label>
          <input id="workspace-backup" type="file" accept=".json,application/json" disabled={reading} onChange={chooseFile} aria-describedby={`backup-help${error ? ' backup-error' : ''}`} className="block w-full min-w-0 rounded-lg border border-slate-300 p-2 text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:font-medium file:text-slate-700" />
          <p id="backup-help" className="mt-2 text-xs leading-5 text-slate-500">Maximum 5 MB. Restore replaces all three collections; it does not merge them.</p>
          {reading && <p role="status" className="mt-4 text-sm text-slate-500">Reading and validating backup…</p>}
          {counts && <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4"><h3 className="text-sm font-medium">Backup contents</h3><p className="mt-1 break-all text-xs text-slate-500">{pendingName}</p><p className="mt-2 text-sm leading-6 text-slate-600">{counts.transactions} transactions · {counts.budgets} budgets · {counts.schedules} schedules</p>{counts.missingLinks > 0 && <p className="mt-2 text-xs leading-5 text-amber-900">{counts.missingLinks} payment links have no matching expense. Those bills will appear unpaid.</p>}<button type="button" onClick={() => setConfirming(true)} className={`mt-4 ${secondaryButtonClass}`}>Review restore</button></div>}
        </section>
      </div>
      <p className="mt-5 max-w-3xl text-xs leading-5 text-slate-500">Local records are stored in this browser profile and website address. Clearing browser data removes them. Local restore replaces only this browser workspace. Choose Account data above for account exports and reviewed initial imports.</p>
      {confirming && counts && <Modal title="Replace this workspace?" description={`Replace your current ${transactions.length} transactions, ${budgets.length} budgets, and ${recurringPayments.length} schedules with the backup's ${counts.transactions} transactions, ${counts.budgets} budgets, and ${counts.schedules} schedules. Undo restore will be available until your next change or refresh.`} onClose={() => setConfirming(false)}><div className="mt-6 flex flex-wrap justify-end gap-3"><button type="button" autoFocus onClick={() => setConfirming(false)} className={secondaryButtonClass}>Keep current workspace</button><button type="button" onClick={confirmRestore} className={primaryButtonClass}>Replace workspace</button></div></Modal>}
    </>
  );
}
