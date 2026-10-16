import { loadConfig } from './config/env.js';
import { createMailer } from './mail/delivery.js';

let mailer;
try {
  mailer = createMailer(loadConfig());
  if (!mailer) throw new Error('not configured');
  await mailer.verify();
  console.log('Email provider connection and authentication succeeded. No email was sent; sender approval and inbox delivery need a separate check.');
} catch {
  console.error('Email provider is not ready. Check the selected provider settings and network access in server/.env. Credentials are hidden.');
  process.exitCode = 1;
} finally { mailer?.close(); }
