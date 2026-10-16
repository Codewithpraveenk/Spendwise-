import { isValidWorkspace, normalizeWorkspace } from '../utils/workspaceValidation.js';
import { selectTransactions } from '../utils/transactions.js';

export const MAX_BACKUP_BYTES = 5 * 1024 * 1024;

export function createBackup(workspace, exportedAt = new Date().toISOString()) {
  if (!isValidWorkspace(workspace)) throw new Error('The workspace is invalid and could not be exported.');
  const text = JSON.stringify({ app: 'SpendWise', formatVersion: 1, exportedAt, workspace: normalizeWorkspace(workspace) }, null, 2);
  if (new TextEncoder().encode(text).byteLength > MAX_BACKUP_BYTES) throw new Error('This workspace exceeds the 5 MB backup limit. Export the transaction CSV and reduce the workspace size before creating a full backup.');
  return text;
}

export function parseBackup(text) {
  if (new TextEncoder().encode(text).byteLength > MAX_BACKUP_BYTES) throw new Error('Choose a backup smaller than 5 MB.');
  let data;
  try { data = JSON.parse(text.replace(/^\uFEFF/, '')); }
  catch { throw new Error('This file is not valid JSON. Choose a SpendWise backup.'); }
  if (data?.app !== 'SpendWise' || data.formatVersion !== 1) throw new Error('This is not a supported SpendWise backup.');
  if (!isValidWorkspace(data.workspace)) throw new Error('This backup contains invalid or duplicate records. Your workspace has not been changed.');
  return normalizeWorkspace(data.workspace);
}

function csvText(value) {
  // Prevent user-entered strings from being interpreted as spreadsheet formulas.
  const safe = /^[\s]*[=+\-@]/.test(value) || /^[\t\r\n]/.test(value) ? `'${value}` : value;
  return `"${safe.replaceAll('"', '""')}"`;
}

export function createTransactionsCsv(records) {
  const rows = [['Date', 'Description', 'Type', 'Category', 'Amount (INR)'].map(csvText).join(',')];
  for (const record of selectTransactions(records)) {
    rows.push([csvText(record.date), csvText(record.description), csvText(record.type), csvText(record.category), (record.amountPaise / 100).toFixed(2)].join(','));
  }
  return `\uFEFF${rows.join('\r\n')}\r\n`;
}

export function describeBackup(workspace) {
  const transactionIds = new Set(workspace.transactions.map((record) => record.id));
  const missingLinks = workspace.recurringPayments.reduce((count, schedule) => count + Object.values(schedule.paidTransactions).filter((id) => !transactionIds.has(id)).length, 0);
  return { transactions: workspace.transactions.length, budgets: workspace.budgets.length, schedules: workspace.recurringPayments.length, missingLinks };
}
