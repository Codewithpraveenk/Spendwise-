import { Link } from 'react-router';
import { useTransactions } from '../../state/TransactionsContext';

export default function WorkspaceNotice() {
  const { storageError, notice, canUndo, undoDelete, retrySave, canUndoRestore, undoRestore } = useTransactions();
  return (
    <div className="space-y-3 empty:hidden">
      {storageError && <div role="alert" className="mb-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
        <p>{storageError === 'read' ? 'The saved workspace could not be read. Sample data is shown, and changes are only in memory. Existing storage will not be overwritten automatically.' : 'Changes could not be saved in this browser. They are available until you refresh or close the page.'}</p>
        {storageError === 'read' ? <Link to="/transactions" className="mt-2 inline-block font-medium underline">Open Transactions to restore sample data</Link> : <button type="button" onClick={retrySave} className="mt-2 rounded-md font-medium underline">Retry saving</button>}
      </div>}
      <div role="status" aria-live="polite" aria-atomic="true">
        {notice && <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"><span>{notice}</span>{canUndo && <button type="button" onClick={undoDelete} className="rounded-md px-2 py-1 font-medium text-indigo-700 hover:bg-indigo-50">Undo deletion</button>}{canUndoRestore && <button type="button" onClick={undoRestore} className="rounded-md px-2 py-1 font-medium text-indigo-700 hover:bg-indigo-50">Undo restore</button>}</div>}
      </div>
    </div>
  );
}
