import { HttpError } from '../errors/HttpError.js';
import { checkDate, isMonth, invalid } from './financeValidation.js';

export const financeModels = { transactions: 'Transaction', budgets: 'Budget', recurring: 'RecurringPayment', payments: 'PaymentOccurrence' };
export function publicRecord(document) {
  const value = document.toObject();
  const result = { ...value, id: value._id.toString(), version: value.__v };
  delete result._id; delete result.owner; delete result.__v;
  if (result.schedule) result.schedule = result.schedule.toString();
  if (result.transaction) result.transaction = result.transaction.toString();
  return result;
}
const missing = () => { throw new HttpError(404, 'RECORD_NOT_FOUND', 'Record not found.'); };
const conflict = (message) => { throw new HttpError(409, 'CONFLICT', message); };

export function createFinanceService(database) {
  const models = database.models;
  const atomic = async (owner, work) => {
    if (database.supportsTransactions === false) throw new HttpError(503, 'TRANSACTIONS_REQUIRED', 'Financial writes require a MongoDB replica set or Atlas cluster.');
    try { return await database.connection.transaction(async (session) => {
      // Serialize account writes with initial workspace imports, including empty-account checks.
      await models.User.updateOne({ _id: owner }, { $inc: { __v: 1 } }, { session });
      return work(session);
    }, { readPreference: 'primary', maxCommitTimeMS: 5000 }); }
    catch (error) {
      if (error.code === 11000) conflict('This category budget or recurring bill already exists. Refresh before trying again.');
      if (error.code === 20 || error.codeName === 'IllegalOperation') throw new HttpError(503, 'TRANSACTIONS_REQUIRED', 'Financial writes require a MongoDB replica set or Atlas cluster.');
      throw error;
    }
  };
  async function owned(Model, owner, id, session) {
    const record = await Model.findOne({ _id: id, owner }).session(session);
    if (!record) missing();
    return record;
  }
  function versionMatches(record, version) {
    if (record.__v !== version) conflict('This record changed. Reload it before saving again.');
  }
  async function unlinked(kind, owner, id, session) {
    if (kind === 'transactions' && await models.PaymentOccurrence.exists({ owner, transaction: id }).session(session)) conflict('This expense is linked to a bill. Remove the payment record first.');
    if (kind === 'recurring' && await models.PaymentOccurrence.exists({ owner, schedule: id }).session(session)) conflict('This schedule has payment history. Remove its payment records before changing or deleting it.');
  }
  return {
    async list(kind, owner, { month, limit, cursor }) {
      const filter = { owner, ...(cursor ? { _id: { $lt: cursor } } : {}) };
      if (month) {
        if (kind === 'transactions') filter.date = { $gte: `${month}-01`, $lte: `${month}-31` };
        if (kind === 'budgets') filter.month = month;
        if (kind === 'payments') filter.billMonth = month;
        if (kind === 'recurring') Object.assign(filter, { startMonth: { $lte: month }, $or: [{ endMonth: null }, { endMonth: { $gte: month } }] });
      }
      const records = await models[financeModels[kind]].find(filter).sort({ _id: -1 }).limit(limit + 1);
      const selected = records.slice(0, limit);
      const items = selected.map(publicRecord);
      if (kind === 'payments' && selected.length) {
        const expenses = await models.Transaction.find({ owner, _id: { $in: selected.map((record) => record.transaction) } });
        const byId = new Map(expenses.map((record) => [record._id.toString(), publicRecord(record)]));
        for (const item of items) item.expense = byId.get(item.transaction) ?? null;
      }
      if (kind === 'recurring' && selected.length) {
        const history = await models.PaymentOccurrence.distinct('schedule', { owner, schedule: { $in: selected.map((record) => record._id) } });
        const protectedIds = new Set(history.map(String));
        for (const item of items) item.hasPaymentHistory = protectedIds.has(item.id);
      }
      return { items, nextCursor: records.length > limit ? records[limit - 1]._id.toString() : null };
    },
    async get(kind, owner, id) { return publicRecord(await owned(models[financeModels[kind]], owner, id, null)); },
    create(kind, owner, values) {
      return atomic(owner, async (session) => {
        const record = new models[financeModels[kind]]({ ...values, owner });
        await record.save({ session });
        return publicRecord(record);
      });
    },
    update(kind, owner, id, version, values) {
      return atomic(owner, async (session) => {
        const Model = models[financeModels[kind]];
        const record = await owned(Model, owner, id, session);
        versionMatches(record, version);
        if (kind === 'recurring') {
          const latestPayment = await models.PaymentOccurrence.findOne({ owner, schedule: id }).sort({ billMonth: -1 }).session(session);
          if (latestPayment) {
            if (['name', 'category', 'amountPaise', 'dueDay', 'startMonth'].some((field) => record[field] !== values[field])) conflict('Payment history protects this schedule. Only its final month can be changed.');
            if (values.endMonth && values.endMonth < latestPayment.billMonth) conflict('The final month must include every recorded bill.');
          }
        } else await unlinked(kind, owner, id, session);
        record.set(values);
        await record.validate();
        // The version predicate also makes concurrent saves conflict safely.
        const updated = await Model.findOneAndUpdate({ _id: id, owner, __v: version }, { $set: values, $inc: { __v: 1 } }, { session, returnDocument: 'after' });
        if (!updated) conflict('This record changed. Reload it before saving again.');
        return publicRecord(updated);
      });
    },
    remove(kind, owner, id, version) {
      return atomic(owner, async (session) => {
        const record = await owned(models[financeModels[kind]], owner, id, session);
        versionMatches(record, version);
        await unlinked(kind, owner, id, session);
        if (kind === 'payments') {
          // Serialize with schedule edits and new recordings while removing both records.
          await models.RecurringPayment.updateOne({ _id: record.schedule, owner }, { $inc: { __v: 1 } }, { session });
          await models.Transaction.deleteOne({ _id: record.transaction, owner }, { session });
        }
        await models[financeModels[kind]].deleteOne({ _id: id, owner, __v: version }, { session });
      });
    },
    recordPayment(owner, id, { billMonth, date, version }) {
      if (!isMonth(billMonth)) invalid('Use a valid YYYY-MM billing month.');
      checkDate(date);
      return atomic(owner, async (session) => {
        // A write lock on the schedule prevents concurrent edit/delete races.
        const schedule = await models.RecurringPayment.findOneAndUpdate({ _id: id, owner }, { $inc: { __v: 1 } }, { session, returnDocument: 'after' });
        if (!schedule) missing();
        if (schedule.__v !== version + 1) conflict('This schedule changed. Reload it before recording a payment.');
        if (billMonth < schedule.startMonth || (schedule.endMonth && billMonth > schedule.endMonth)) invalid('The bill month is outside this schedule.');
        if (await models.PaymentOccurrence.exists({ owner, schedule: id, billMonth }).session(session)) conflict('This recurring bill is already recorded.');
        const expense = new models.Transaction({ owner, description: schedule.name, category: schedule.category, type: 'expense', amountPaise: schedule.amountPaise, date });
        await expense.save({ session });
        const payment = new models.PaymentOccurrence({ owner, schedule: id, billMonth, transaction: expense._id });
        await payment.save({ session });
        return { payment: publicRecord(payment), transaction: publicRecord(expense), schedule: publicRecord(schedule) };
      });
    },
  };
}
