import { createCipheriv, createDecipheriv, randomBytes, randomUUID } from 'node:crypto';
import nodemailer from 'nodemailer';
import { createBrevoMailer } from './brevo.js';

export function encryptMail(value, key) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', Buffer.from(key, 'hex'), iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), ciphertext].map((part) => part.toString('base64url')).join('.');
}
export function decryptMail(value, key) {
  const [iv, tag, ciphertext] = value.split('.').map((part) => Buffer.from(part, 'base64url'));
  const cipher = createDecipheriv('aes-256-gcm', Buffer.from(key, 'hex'), iv);
  cipher.setAuthTag(tag);
  return JSON.parse(Buffer.concat([cipher.update(ciphertext), cipher.final()]).toString('utf8'));
}
export function createMailer(config) {
  if (config.brevo) return createBrevoMailer(config.brevo);
  if (!config.smtp) return null;
  return nodemailer.createTransport({ host: config.smtp.host, port: config.smtp.port, secure: config.smtp.secure,
    requireTLS: !config.smtp.secure, auth: { user: config.smtp.user, pass: config.smtp.password },
    connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 10000,
    disableFileAccess: true, disableUrlAccess: true,
  });
}
export async function deliverOne({ config, database, mailer, logger }) {
  const now = new Date(); const lockId = randomUUID();
  await database.models.MailJob.updateMany({ state: 'sending', attempts: { $gte: 5 }, lockedUntil: { $lte: now } }, { $set: { state: 'failed' }, $unset: { encrypted: 1, lockId: 1 } });
  const job = await database.models.MailJob.findOneAndUpdate({ state: { $in: ['pending', 'sending'] }, attempts: { $lt: 5 }, nextAttemptAt: { $lte: now }, lockedUntil: { $lte: now }, expiresAt: { $gt: now } }, { $set: { state: 'sending', lockId, lockedUntil: new Date(Date.now() + 90000) }, $inc: { attempts: 1 } }, { sort: { nextAttemptAt: 1 }, returnDocument: 'after' });
  if (!job) return false;
  const filter = { _id: job._id, lockId };
  try {
    if (job.kind === 'reset' && !await database.models.PasswordReset.exists({ owner: job.owner, tokenHash: job.tokenHash, expiresAt: { $gt: new Date() } })) {
      await database.models.MailJob.updateOne(filter, { $set: { state: 'cancelled' }, $unset: { encrypted: 1, lockId: 1 } }); return true;
    }
    const content = decryptMail(job.encrypted, config.mailKey);
    const from = config.brevo?.from ?? config.smtp.from;
    const outcome = await mailer.sendMail({ from, to: job.recipient, subject: content.subject, text: content.text, messageId: `<spendwise-${job._id}@${from.split('@')[1]}>` });
    if (outcome.rejected?.length || !outcome.accepted?.length) throw new Error('SMTP did not accept the message.');
    await database.models.MailJob.updateOne(filter, { $set: { state: 'sent' }, $unset: { encrypted: 1, lockId: 1 } });
  } catch {
    const failed = job.attempts >= 5;
    await database.models.MailJob.updateOne(filter, { $set: { state: failed ? 'failed' : 'pending', nextAttemptAt: new Date(Date.now() + Math.min(8, 2 ** (job.attempts - 1)) * 60000), lockedUntil: new Date(0) }, ...(failed ? { $unset: { encrypted: 1, lockId: 1 } } : { $unset: { lockId: 1 } }) });
    logger.error({ event: 'mail_delivery_failed', kind: job.kind, attempt: job.attempts });
  }
  return true;
}
export function startMailWorker({ config, database, logger }) {
  const mailer = createMailer(config);
  if (!mailer || !database) return () => {};
  let busy = false; let stopped = false;
  async function tick() {
    if (busy || stopped) return;
    busy = true;
    try { for (let i = 0; i < 5 && !stopped; i++) if (!await deliverOne({ config, database, mailer, logger })) break; }
    catch { logger.error({ event: 'mail_worker_failed' }); }
    finally { busy = false; }
  }
  const timer = setInterval(tick, 5000); timer.unref(); tick();
  return () => { stopped = true; clearInterval(timer); mailer.close(); };
}
