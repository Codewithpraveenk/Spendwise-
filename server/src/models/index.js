import mongoose from 'mongoose';

export const categories = Object.freeze({
  income: ['Allowance', 'Part-time work', 'Scholarship', 'Gift', 'Other income'],
  expense: ['Housing', 'Food', 'Transport', 'Education', 'Utilities', 'Subscriptions', 'Health', 'Shopping', 'Entertainment', 'Other expense'],
});

const monthPattern = /^(20\d{2}|2100)-(0[1-9]|1[0-2])$/;
const month = { type: String, required: true, match: monthPattern };
const amount = { type: Number, required: true, min: 1, max: 1_000_000_000, validate: Number.isSafeInteger };
const owner = { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, immutable: true };
const options = {
  timestamps: true, strict: 'throw', bufferCommands: false,
  toJSON: { transform(_doc, value) { delete value.passwordHash; delete value.googleSub; delete value.__v; return value; } },
};

export function isCalendarDate(value) {
  if (!/^(20\d{2}|2100)-(0[1-9]|1[0-2])-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

// Models belong to the supplied connection, keeping tests and app instances isolated.
export function createModels(connection) {
  const rateLimitBucket = new mongoose.Schema({
    _id: { type: String, required: true }, totalHits: { type: Number, required: true }, resetTime: { type: Date, required: true },
  }, { strict: 'throw', bufferCommands: false, versionKey: false });
  rateLimitBucket.index({ resetTime: 1 }, { expireAfterSeconds: 0 });
  const user = new mongoose.Schema({
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254, match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
    passwordHash: { type: String, required: function () { return !this.googleSub; }, select: false, maxlength: 512 },
    googleSub: { type: String, select: false, maxlength: 255, match: /^[a-zA-Z0-9_-]+$/ },
    authVersion: { type: Number, default: 0, min: 0 },
  }, options);
  user.index({ email: 1 }, { unique: true });
  user.index({ googleSub: 1 }, { unique: true, sparse: true });

  const googleChallenge = new mongoose.Schema({
    tokenHash: { type: String, required: true, match: /^[a-f0-9]{64}$/ },
    expiresAt: { type: Date, required: true },
  }, options);
  googleChallenge.index({ tokenHash: 1 }, { unique: true });
  googleChallenge.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

  const session = new mongoose.Schema({
    owner, tokenHash: { type: String, required: true, match: /^[a-f0-9]{64}$/ },
    expiresAt: { type: Date, required: true },
    authVersion: { type: Number, default: 0, min: 0 },
  }, options);
  session.index({ tokenHash: 1 }, { unique: true });
  session.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  session.index({ owner: 1 });

  const passwordReset = new mongoose.Schema({
    owner, tokenHash: { type: String, required: true, match: /^[a-f0-9]{64}$/ },
    expiresAt: { type: Date, required: true }, requestedAt: { type: Date, required: true },
    authVersion: { type: Number, required: true, min: 0 },
  }, options);
  passwordReset.index({ owner: 1 }, { unique: true });
  passwordReset.index({ tokenHash: 1 }, { unique: true });
  passwordReset.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

  const mailJob = new mongoose.Schema({
    owner, kind: { type: String, enum: ['reset', 'password-changed'], required: true },
    recipient: { type: String, required: true }, encrypted: { type: String },
    tokenHash: { type: String }, state: { type: String, enum: ['pending', 'sending', 'sent', 'cancelled', 'failed'], default: 'pending' },
    attempts: { type: Number, default: 0 }, nextAttemptAt: { type: Date, required: true },
    lockedUntil: { type: Date, default: () => new Date(0) }, lockId: String,
    expiresAt: { type: Date, required: true },
  }, options);
  mailJob.index({ state: 1, nextAttemptAt: 1, lockedUntil: 1 });
  mailJob.index({ owner: 1, kind: 1, state: 1 });
  mailJob.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

  const workspaceImport = new mongoose.Schema({
    owner,
    requestId: { type: String, required: true, maxlength: 36 },
    digest: { type: String, required: true, match: /^[a-f0-9]{64}$/ },
    transactions: { type: Number, required: true }, budgets: { type: Number, required: true },
    schedules: { type: Number, required: true }, payments: { type: Number, required: true },
  }, options);
  workspaceImport.index({ owner: 1 }, { unique: true });

  const transaction = new mongoose.Schema({
    owner,
    description: { type: String, required: true, trim: true, maxlength: 100 },
    type: { type: String, required: true, enum: ['income', 'expense'] },
    category: { type: String, required: true, validate: function (value) { return categories[this.type]?.includes(value) ?? false; } },
    amountPaise: amount,
    date: { type: String, required: true, validate: isCalendarDate },
  }, options);
  transaction.index({ owner: 1, date: -1, _id: -1 });

  const budget = new mongoose.Schema({
    owner, month, category: { type: String, required: true, enum: categories.expense }, limitPaise: amount,
  }, options);
  budget.index({ owner: 1, month: 1, category: 1 }, { unique: true });

  const recurring = new mongoose.Schema({
    owner, name: { type: String, required: true, trim: true, maxlength: 100 },
    category: { type: String, required: true, enum: categories.expense }, amountPaise: amount,
    dueDay: { type: Number, required: true, min: 1, max: 31, validate: Number.isInteger },
    startMonth: month,
    endMonth: { type: String, match: monthPattern, validate: function (value) { return value == null || value >= this.startMonth; } },
  }, options);
  recurring.index({ owner: 1, startMonth: 1 });

  // A separate occurrence will be saved atomically with its expense by a later service.
  const payment = new mongoose.Schema({
    owner, schedule: { type: mongoose.Schema.Types.ObjectId, ref: 'RecurringPayment', required: true },
    billMonth: month,
    transaction: { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction', required: true },
  }, options);
  payment.index({ owner: 1, schedule: 1, billMonth: 1 }, { unique: true });
  payment.index({ transaction: 1 }, { unique: true });
  // Support account-scoped cursor pagination without scanning other users' data.
  for (const schema of [transaction, budget, recurring, payment]) schema.index({ owner: 1, _id: -1 });

  return Object.freeze(Object.fromEntries([
    ['User', user], ['Session', session], ['Transaction', transaction], ['Budget', budget],
    ['RecurringPayment', recurring], ['PaymentOccurrence', payment], ['WorkspaceImport', workspaceImport], ['GoogleChallenge', googleChallenge], ['PasswordReset', passwordReset], ['MailJob', mailJob], ['RateLimitBucket', rateLimitBucket],
  ].map(([name, schema]) => [name, connection.models[name] ?? connection.model(name, schema)])));
}
