import { createHash } from 'node:crypto';
import { HttpError } from '../errors/HttpError.js';
import { exactBody, invalid, isMonth, validateRecord } from './financeValidation.js';

const fields = {
  transactions: ['description', 'type', 'category', 'amountPaise', 'date'],
  budgets: ['month', 'category', 'limitPaise'],
  recurringPayments: ['name', 'category', 'amountPaise', 'dueDay', 'startMonth', 'endMonth'],
};
const modelNames = ['Transaction', 'Budget', 'RecurringPayment', 'PaymentOccurrence'];
const conflict = (message) => { throw new HttpError(409, 'IMPORT_CONFLICT', message); };
const counts = (data) => ({ transactions: data.transactions.length, budgets: data.budgets.length, schedules: data.recurringPayments.length, payments: data.recurringPayments.reduce((sum, item) => sum + Object.keys(item.paidTransactions).length, 0) });

// Validate again on the server: a browser preview is never authority to write data.
export function validateWorkspace(input) {
  exactBody(input, ['version', 'transactions', 'budgets', 'recurringPayments']);
  if (input.version !== 2) invalid('Use a supported SpendWise workspace.');
  const output = { version: 2 };
  for (const [kind, editable] of Object.entries(fields)) {
    const records = input[kind];
    if (!Array.isArray(records) || records.length > (kind === 'recurringPayments' ? 1000 : 10000)) invalid('Workspace collection limits exceeded.');
    const ids = new Set();
    output[kind] = records.map((record) => {
      exactBody(record, ['id', ...editable, ...(kind === 'recurringPayments' ? ['paidTransactions'] : [])]);
      if (typeof record.id !== 'string' || !record.id || record.id.length > 100 || ids.has(record.id)) invalid('Workspace IDs must be unique within each collection.');
      ids.add(record.id);
      const values = Object.fromEntries(editable.filter((key) => Object.hasOwn(record, key)).map((key) => [key, record[key]]));
      const validated = validateRecord(kind === 'recurringPayments' ? 'recurring' : kind, values);
      if (kind !== 'recurringPayments') return { id: record.id, ...validated };
      const links = record.paidTransactions;
      if (!links || typeof links !== 'object' || Array.isArray(links) || Object.keys(links).length > 1212) invalid('Invalid recurring payment links.');
      for (const [month, id] of Object.entries(links)) {
        if (!isMonth(month) || month < validated.startMonth || (validated.endMonth && month > validated.endMonth) || typeof id !== 'string') invalid('Payment links must fall within their schedule.');
      }
      return { id: record.id, ...validated, paidTransactions: Object.fromEntries(Object.entries(links).sort(([a], [b]) => a.localeCompare(b))) };
    }).sort((a, b) => a.id.localeCompare(b.id));
  }
  const budgetKeys = output.budgets.map((item) => `${item.month}:${item.category}`);
  if (new Set(budgetKeys).size !== budgetKeys.length) invalid('A category can have only one budget per month.');
  const transactions = new Map(output.transactions.map((item) => [item.id, item]));
  const linked = new Set();
  for (const schedule of output.recurringPayments) for (const id of Object.values(schedule.paidTransactions)) {
    const expense = transactions.get(id);
    if (!expense || expense.type !== 'expense' || expense.category !== schedule.category || expense.amountPaise !== schedule.amountPaise || linked.has(id)) invalid('Every payment link must reference one matching expense, without duplicates. Repair the backup before importing.');
    linked.add(id);
  }
  if (linked.size > 10000) invalid('Too many payment links.');
  if (!output.transactions.length && !output.budgets.length && !output.recurringPayments.length) invalid('There are no records to import.');
  return output;
}

export function createWorkspaceService(database) {
  const { models, connection } = database;
  async function transaction(work) {
    if (!database.supportsTransactions) throw new HttpError(503, 'TRANSACTIONS_REQUIRED', 'Account backups and imports require a MongoDB replica set or Atlas cluster.');
    return connection.transaction(work, { readPreference: 'primary', readConcern: { level: 'snapshot' }, maxCommitTimeMS: 5000 });
  }
  async function accountCounts(owner, session) {
    const result = [];
    // Keep operations sequential inside a MongoDB transaction.
    for (const name of modelNames) result.push(await models[name].countDocuments({ owner }).session(session));
    return { transactions: result[0], budgets: result[1], schedules: result[2], payments: result[3] };
  }
  return {
    async preview(owner, input) {
      const workspace = validateWorkspace(input);
      return transaction(async (session) => {
        const current = await accountCounts(owner, session);
        const imported = Boolean(await models.WorkspaceImport.exists({ owner }).session(session));
        return { counts: counts(workspace), current, canImport: !imported && Object.values(current).every((value) => value === 0) };
      });
    },
    async export(owner) {
      return transaction(async (session) => {
        const records = [];
        for (const [index, name] of modelNames.entries()) {
          const limit = index === 2 ? 1000 : 10000;
          const items = await models[name].find({ owner }).sort({ _id: 1 }).limit(limit + 1).session(session);
          if (items.length > limit) throw new HttpError(422, 'EXPORT_LIMIT', 'This account exceeds the full-backup record limit. No partial backup was generated.');
          records.push(items);
        }
        const [transactions, budgets, schedules, payments] = records;
        const recurringPayments = schedules.map((item) => ({ id: String(item._id), ...Object.fromEntries(fields.recurringPayments.filter((field) => item[field] != null).map((field) => [field, item[field]])), paidTransactions: {} }));
        const bySchedule = new Map(recurringPayments.map((item) => [item.id, item]));
        const byTransaction = new Map(transactions.map((item) => [String(item._id), item]));
        for (const payment of payments) {
          const schedule = bySchedule.get(String(payment.schedule));
          const expense = byTransaction.get(String(payment.transaction));
          if (!schedule || !expense || expense.type !== 'expense' || expense.category !== schedule.category || expense.amountPaise !== schedule.amountPaise || Object.hasOwn(schedule.paidTransactions, payment.billMonth)) throw new HttpError(409, 'WORKSPACE_INTEGRITY', 'Account payment links need repair before a complete backup can be generated.');
          schedule.paidTransactions[payment.billMonth] = String(payment.transaction);
        }
        const plain = (items, kind) => items.map((item) => ({ id: String(item._id), ...Object.fromEntries(fields[kind].map((field) => [field, item[field]])) }));
        return { version: 2, transactions: plain(transactions, 'transactions'), budgets: plain(budgets, 'budgets'), recurringPayments };
      });
    },
    async import(owner, input, requestId) {
      if (typeof requestId !== 'string' || !/^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(requestId)) invalid('Provide an import request UUID.');
      const workspace = validateWorkspace(input);
      const digest = createHash('sha256').update(JSON.stringify(workspace)).digest('hex');
      const summary = counts(workspace);
      return transaction(async (session) => {
        await models.User.updateOne({ _id: owner }, { $inc: { __v: 1 } }, { session });
        const previous = await models.WorkspaceImport.findOne({ owner }).session(session);
        if (previous) {
          if (previous.requestId === requestId && previous.digest === digest) return { counts: summary, replayed: true };
          conflict('This account already completed its initial import. Existing data has not been replaced.');
        }
        if (Object.values(await accountCounts(owner, session)).some(Boolean)) conflict('Initial import requires an empty account. Existing account records have not been changed.');
        const idMap = new Map();
        for (const [kind, name] of [['transactions', 'Transaction'], ['budgets', 'Budget'], ['recurringPayments', 'RecurringPayment']]) {
          const docs = workspace[kind].map(({ id, paidTransactions, ...values }) => {
            const doc = new models[name]({ ...values, owner });
            idMap.set(`${kind}:${id}`, doc._id);
            return doc;
          });
          if (docs.length) await models[name].insertMany(docs, { session, ordered: true });
        }
        const payments = workspace.recurringPayments.flatMap((schedule) => Object.entries(schedule.paidTransactions).map(([billMonth, id]) => ({ owner, schedule: idMap.get(`recurringPayments:${schedule.id}`), transaction: idMap.get(`transactions:${id}`), billMonth })));
        if (payments.length) await models.PaymentOccurrence.insertMany(payments, { session, ordered: true });
        await models.WorkspaceImport.create([{ owner, requestId, digest, ...summary }], { session });
        return { counts: summary, replayed: false };
      });
    },
  };
}
