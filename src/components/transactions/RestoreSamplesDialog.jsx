import Modal from '../ui/Modal';
import { useTransactions } from '../../state/TransactionsContext';

export default function RestoreSamplesDialog({ onConfirm, onClose }) {
  const { readBlocked } = useTransactions();
  return (
    <Modal title={readBlocked ? 'Restore sample workspace?' : 'Restore sample transactions?'} description={readBlocked ? 'The saved workspace could not be read. This replaces it with the sample transactions, budgets, and schedules currently shown. Unsaved in-memory changes will be removed.' : 'This replaces your transaction list in this browser with the original 14 fictional records. Your additions, edits, and most recent deletion undo will be removed. Your current budget limits and recurring schedules stay the same.'} onClose={onClose}>
      <div className="mt-6 flex flex-wrap justify-end gap-3">
        <button type="button" autoFocus onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium hover:bg-slate-50">Keep my transactions</button>
        <button type="button" onClick={() => { onConfirm(); onClose(); }} className="rounded-lg bg-rose-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-rose-800">Restore sample transactions</button>
      </div>
    </Modal>
  );
}
