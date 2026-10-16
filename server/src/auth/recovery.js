import { randomBytes } from 'node:crypto';
import { HttpError } from '../errors/HttpError.js';
import { exactBody, invalid } from '../services/financeValidation.js';
import { digestToken } from './sessions.js';
import { hashPassword } from './passwords.js';
import { encryptMail } from '../mail/delivery.js';

export const recoveryMessage = 'If an account with a password uses that email, a reset link will be sent. Check your inbox and spam folder. Google-only accounts should continue with Google.';
const invalidLink = () => new HttpError(400, 'RESET_LINK_INVALID', 'This reset link is invalid, expired, or already used. Request a new link.');
export function createRecovery({ config, database }) {
  const { models, connection } = database;
  const requireDelivery = () => { if ((!config.smtp && !config.brevo) || !config.mailKey) throw new HttpError(503, 'EMAIL_NOT_CONFIGURED', 'Password-recovery email is not configured yet. Contact the app owner or use your connected Google sign-in.'); };
  const requireTransactions = () => { if (!database.supportsTransactions) throw new HttpError(503, 'TRANSACTIONS_REQUIRED', 'Account recovery requires a MongoDB replica set or Atlas cluster.'); };
  const mailJob = (owner, kind, email, content, tokenHash) => ({ owner, kind, recipient: email, encrypted: encryptMail(content, config.mailKey), ...(tokenHash ? { tokenHash } : {}), nextAttemptAt: new Date(), expiresAt: new Date(Date.now() + 7 * 86400000) });
  return {
    async request(body) {
      exactBody(body, ['email']);
      if (typeof body.email !== 'string' || body.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim())) invalid('Enter a valid email address.');
      requireDelivery(); requireTransactions();
      const email = body.email.trim().toLowerCase();
      const user = await models.User.findOne({ email }).select('+passwordHash');
      if (!user?.passwordHash) return;
      await connection.transaction(async (session) => {
        const current = await models.User.findOneAndUpdate({ _id: user._id }, { $inc: { __v: 1 } }, { session, returnDocument: 'after' });
        if (!current) return;
        const previous = await models.PasswordReset.findOne({ owner: user._id }).session(session);
        if (previous && Date.now() - previous.requestedAt.getTime() < 60000) return;
        const token = randomBytes(32).toString('hex'); const tokenHash = digestToken(token);
        await models.PasswordReset.findOneAndUpdate({ owner: user._id }, { $set: { tokenHash, expiresAt: new Date(Date.now() + 15 * 60000), requestedAt: new Date(), authVersion: current.authVersion ?? 0 } }, { upsert: true, session });
        await models.MailJob.updateMany({ owner: user._id, kind: 'reset', state: 'pending' }, { $set: { state: 'cancelled' }, $unset: { encrypted: 1 } }, { session });
        const url = `${config.appOrigin}/reset-password#token=${token}`;
        await models.MailJob.create([mailJob(user._id, 'reset', email, { subject: 'Reset your SpendWise password', text: `A password reset was requested for your SpendWise account.\n\nOpen this link to set a new password:\n${url}\n\nThis link expires in 15 minutes and can be used once. If you did not request it, ignore this email; your password has not changed.\n\nSpendWise` }, tokenHash)], { session });
      });
    },
    async reset(body) {
      exactBody(body, ['token', 'password']);
      if (typeof body.token !== 'string' || !/^[a-f0-9]{64}$/.test(body.token)) throw invalidLink();
      if (typeof body.password !== 'string' || body.password.length < 15 || body.password.length > 128) invalid('Use a password of 15–128 characters.');
      requireDelivery(); requireTransactions();
      const tokenHash = digestToken(body.token);
      if (!await models.PasswordReset.exists({ tokenHash, expiresAt: { $gt: new Date() } })) throw invalidLink();
      const passwordHash = await hashPassword(body.password);
      await connection.transaction(async (session) => {
        const reset = await models.PasswordReset.findOneAndDelete({ tokenHash, expiresAt: { $gt: new Date() } }, { session });
        if (!reset) throw invalidLink();
        const user = await models.User.findById(reset.owner).session(session);
        if (!user || (user.authVersion ?? 0) !== reset.authVersion) throw invalidLink();
        await models.User.updateOne({ _id: user._id }, { $set: { passwordHash }, $inc: { authVersion: 1, __v: 1 } }, { session });
        await models.Session.deleteMany({ owner: user._id }, { session });
        await models.PasswordReset.deleteMany({ owner: user._id }, { session });
        await models.MailJob.updateMany({ owner: user._id, kind: 'reset', state: 'pending' }, { $set: { state: 'cancelled' }, $unset: { encrypted: 1 } }, { session });
        await models.MailJob.create([mailJob(user._id, 'password-changed', user.email, { subject: 'Your SpendWise password changed', text: 'Your SpendWise password was changed. Previous account sessions have been signed out. Your finance records and connected Google identity are unchanged.\n\nIf you did not make this change, request a new password reset from SpendWise immediately.\n\nSpendWise' })], { session });
      });
    },
  };
}
