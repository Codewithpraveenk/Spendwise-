# Password recovery

This phase implements forgotten-password recovery. Email verification at registration and signed-in password/session-management tools remain separate work.

## Configure real email in VS Code

Gmail SMTP is the initial development sender. A production deployment should use a dedicated transactional-email provider with its own verified sender/domain, delivery monitoring, and suitable quotas. SMTP support is provider-independent.

1. Use a Gmail account you control to send SpendWise reset emails. This sender can differ from your SpendWise login email.
2. Enable Google 2-Step Verification, then open https://myaccount.google.com/apppasswords. Create an App Password named **SpendWise Mail**. If unavailable, consult https://support.google.com/accounts/answer/185833; organization policies or Advanced Protection can prevent App Passwords.
3. Open `C:\Users\Praveen\Documents\Spendwise\server\.env`. At the bottom, uncomment and complete these settings:

```dotenv
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=YOUR_SENDING_GMAIL_ADDRESS
SMTP_PASSWORD=YOUR_16_CHARACTER_GOOGLE_APP_PASSWORD_WITHOUT_SPACES
MAIL_FROM=YOUR_SENDING_GMAIL_ADDRESS
```

Use the same Gmail address for `SMTP_USER` and `MAIL_FROM`. Use a Google App Password, never your normal Google password, MongoDB password, or SpendWise password. These are example placeholders, not working settings. Do not paste credentials into chat.

`APP_ORIGIN=http://localhost:5173` and a private `MAIL_ENCRYPTION_KEY` were prepared in `.env`; keep the generated key private and stable. It encrypts queued email contents so reset URLs are not stored in plaintext in MongoDB. Production needs that same stable key in its secret settings, and `APP_ORIGIN` must be your explicitly allowed HTTPS frontend origin. Losing or changing the key makes existing queued messages unreadable.

4. From the project root in a VS Code terminal:

```powershell
cd C:\Users\Praveen\Documents\Spendwise
npm --prefix server install
npm --prefix server run mail:check
npm --prefix server run db:indexes
```

`mail:check` verifies SMTP connectivity and authentication without sending an email. It does not prove inbox delivery. Stop and restart the backend after environment changes:

```powershell
npm run dev:server
```

In another terminal:

```powershell
npm run dev
```

## Real inbox check

1. Open http://localhost:5173/forgot-password and enter your existing password-based SpendWise account email.
2. Request a reset. Check inbox/spam. The response intentionally does not reveal whether that account exists. SMTP outages are retried; acceptance of a request is not confirmation of delivery.
3. Open the email link. It expires after 15 minutes and can be used once. The URL fragment is read into component memory and removed from the visible address. If you refresh, reopen the original email link.
4. Enter and confirm a new 15–128-character password. Do this yourself; never send passwords to the coding agent.
5. Sign in normally with the new password. Existing finance records and a connected Google identity remain unchanged. All previous sessions are invalidated.
6. Confirm the old password and used reset link fail. A password-change notification should arrive too. No password is included in email.

Google-only accounts are not given a password through this unauthenticated recovery request; they should continue with Google. Accounts that already have a password and connected Google can reset that password.

## Implementation

- `src/pages/RecoveryPage.jsx`: forgot/reset pages, accessible validation, pending/error/success states, password confirmation, and fragment-token handling.
- `src/services/authApi.js`: recovery JSON requests with cookies, same-site header, timeouts, response validation, and no automatic retries.
- `server/src/auth/recovery.js`: generic requests, cryptographically random tokens, SHA-256 token hashes, 15-minute expiry, a one-minute account cooldown, atomic password reset, session revocation, and notification enqueueing.
- `server/src/mail/delivery.js`: authenticated AES-256-GCM queued content, TLS SMTP, durable MongoDB jobs, atomic leases, bounded retries, safe logs, and expired/superseded reset cancellation.
- `server/src/auth/sessions.js`: sessions carry an account authentication version. Reset increments it, so even a late session created by a pre-reset password login cannot restore old access. Legacy sessions/users default to version zero.
- `server/src/models/index.js`: PasswordReset owner/token unique indexes and TTL expiry; MailJob queue/lease and retention indexes.
- `server/src/checkMail.js`: safe SMTP configuration/authentication check.

API: `POST /api/auth/forgot-password` accepts `{ email }`, responds 202 with a generic message, and exposes no token. `POST /api/auth/reset-password` accepts `{ token, password }`, consumes a valid link, revokes sessions, clears the browser session cookie, and returns a notice. It does not automatically log in.

No email is sent synchronously in the request handler. SMTP work is performed by the durable background worker after the database transaction commits, avoiding response timing tied to SMTP delivery. Generic responses have a minimum response floor plus small jitter; this is not a claim of perfect constant-time behavior. Recovery has independent IP throttling even in development, plus the persisted per-account cooldown. Distributed IP throttling remains production hardening work.

Mail jobs use 90-second leases and at most five attempts, with 1/2/4/8-minute retry delays. Delivery is at least once: a crash after SMTP acceptance but before the database acknowledgement can produce a duplicate email with the same message ID/link. A reset can still be consumed only once. Sent/failed/cancelled jobs clear encrypted content; job metadata expires after seven days. Expired/used/superseded reset links are checked before delivery. A message already in flight may still arrive, but its obsolete link cannot reset the account.

There is no development shortcut that prints live reset URLs or exposes tokens through a public API. Without SMTP configuration the app shows an honest configuration error rather than pretending mail was sent.

## Checks

```powershell
npm test
npm run build
npm run test:server
npm --prefix server run test:recovery
npm --prefix server run test:auth
npm --prefix server run test:google
```

Integration fixtures use disposable real MongoDB and an injected fake SMTP transport. These verify queue encryption, delivery processing from a separate database connection, generic responses, cooldown, superseded/expired tokens, atomic rollback, concurrent reset submissions, data/Google identity preservation, stale-session rejection, notification, and delivery retries. They do not prove Gmail inbox delivery; complete the real inbox check after configuring your sender.

Current verification: 100 frontend tests, 26 backend unit/HTTP/model checks, seven recovery integration scenarios, and all existing authentication/Google/finance/workspace/database integration suites passed. The production build passed. Browser checks covered request validation/confirmation, valid link landing, fragment removal on initial and repeated links, missing-link state after refresh, and a 320 px layout. Browser checks did not enter or change a real password.

The user provided Gmail SMTP settings, which were saved privately. SMTP connectivity/authentication succeeded without sending an email, and Atlas indexes were prepared. Real inbox receipt, reset completion, and the change-notification email still require the user's live check.

References: https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html and https://nodemailer.com/smtp
