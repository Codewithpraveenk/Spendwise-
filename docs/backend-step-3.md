# Backend step 3 — registration and session authentication

This phase implements account APIs. The dashboard remains available with its
existing local data; login screens and server-backed finance data come later.
All code is editable in `C:\Users\Praveen\Documents\Spendwise` in VS Code.

## Workflow

1. Register with name, email, and password. The API normalizes the email, hashes
   the password, saves the user, and issues a session cookie.
2. Login verifies the password and replaces the session presented by that browser.
3. A protected request resolves the session to a user on the server. Future finance
   queries will use this user's ID, never an owner supplied by the client.
4. Logout deletes the current session and clears its cookie. Other devices remain
   signed in. Sessions expire after seven days without sliding renewal.

| Method | Path | Result |
| --- | --- | --- |
| POST | /api/auth/register | 201, public user and session cookie |
| POST | /api/auth/login | 200, public user and new session cookie |
| GET | /api/auth/me | 200, current public user; 401 if signed out |
| POST | /api/auth/logout | 204, current session revoked |

User responses contain only `id`, `name`, and `email`. Errors use the existing
`error.code`, `error.message`, and `error.requestId` envelope. Auth responses use
Cache-Control: no-store. Account storage being unavailable returns 503.

## Important files

- `server/src/auth/passwords.js`: asynchronous Node scrypt hashing, random 16-byte
  salts, constant-time key comparison, versioned hashes, and at most two concurrent
  expensive derivations. Busy requests return 503 and can be retried.
- `server/src/auth/sessions.js`: cryptographically random 32-byte tokens; MongoDB
  stores only SHA-256 token hashes. Cookie issuance, revocation, and requireUser
  middleware live here. The session cookie is HttpOnly and SameSite=Lax. Production
  uses a Secure, host-only `__Host-` cookie and requires HTTPS.
- `server/src/routes/auth.js`: strict account inputs, public response mapping,
  registration/login/me/logout handlers, cross-site write protection, and a shared
  10-attempt registration/login limit per IP over 15 minutes.
- `server/src/models/index.js`: Session model with unique token hash and an expiry
  TTL index. Middleware checks expiry immediately; it does not wait for TTL cleanup.
- `server/src/app.js`: mounts auth routes and enables credentialed CORS only for
  explicitly permitted origins.
- `server/test/auth.test.js`: password and production cookie checks.
- `server/test/auth.integration.js`: full HTTP account lifecycle against disposable
  real MongoDB, including database values, errors, expiry, revocation, and limits.

Dependencies added: `cookie` for cookie parsing/serialization and
`express-rate-limit` for request throttling. Password hashing uses Node's built-in
crypto module. Reference: [Node crypto documentation](https://nodejs.org/api/crypto.html)
and [express-rate-limit](https://github.com/express-rate-limit/express-rate-limit).

## Run in VS Code

Use the MongoDB configuration from [step 2](backend-step-2.md). In a terminal:

```powershell
cd C:\Users\Praveen\Documents\Spendwise\server
npm ci
npm run dev
```

If your database is not configured, health works but account routes return 503.
No permanent MongoDB instance is installed by these commands. Production also
needs `npm run db:indexes` before startup so the new session indexes exist.

With a configured, running database, use a second PowerShell terminal for a
fictional test account. Change the example email if you already registered it:

```powershell
$apiUrl = 'http://127.0.0.1:5000/api/auth'
$accountHeaders = @{ 'X-Spendwise-Request' = '1' }
$registrationBody = @{
  name = 'Test Student'
  email = 'test.student@example.com'
  password = 'fictional test passphrase 123'
} | ConvertTo-Json

Invoke-RestMethod -Uri "$apiUrl/register" -Method Post -ContentType 'application/json' -Headers $accountHeaders -Body $registrationBody -SessionVariable spendwiseSession
Invoke-RestMethod -Uri "$apiUrl/me" -WebSession $spendwiseSession
Invoke-RestMethod -Uri "$apiUrl/logout" -Method Post -ContentType 'application/json' -Headers $accountHeaders -Body '{}' -WebSession $spendwiseSession

$loginBody = @{
  email = 'test.student@example.com'
  password = 'fictional test passphrase 123'
} | ConvertTo-Json
Invoke-RestMethod -Uri "$apiUrl/login" -Method Post -ContentType 'application/json' -Headers $accountHeaders -Body $loginBody -WebSession $spendwiseSession
Invoke-RestMethod -Uri "$apiUrl/me" -WebSession $spendwiseSession
```

Registration requires a nonempty name up to 80 characters, valid email up to 254
characters, and a password of 15–128 JavaScript string code units. Passwords are
not trimmed or silently truncated. Unknown fields and object-valued credentials
are rejected. Repeated registration returns 409; failed login uses the same 401
message for unknown emails and incorrect passwords.

Later browser requests must use `credentials: 'include'`; all writes must send
JSON and `X-Spendwise-Request: 1`. Use the same hostname for client and API locally
(for example, 127.0.0.1 for both). The API rejects cross-site writes, so production
must keep frontend and API on the same site, preferably behind a single origin.
An independently hosted cross-site frontend needs a deliberate session/CSRF design
change; do not simply remove the request checks.

## Verification

```powershell
npm test
npm run test:auth
npm run test:db
```

The integration commands use disposable MongoDB and never your MONGODB_URI.
Verified this phase: 18 backend unit/HTTP/model checks; the auth integration suite
with eight lifecycle subtests; and the database persistence/index integration test.
The auth suite checks that passwords and cookies are absent from request logs.
No browser login flow is claimed tested because login UI is not implemented yet.

## Remaining before public accounts

The IP limiter is in memory and assumes one server process with direct connections.
Before multiple instances, add a shared limiter store; behind a proxy, explicitly
configure trusted proxy hops for that deployment. Do not enable blanket trust proxy.
Add email verification, password reset/change with session invalidation, account
recovery, abuse monitoring, and deployment security review before public launch.
Registration's duplicate response can reveal that an email is registered; a future
email-verification flow should use a generic acceptance response.

Finance routes and owner isolation tests are the next backend phase. Frontend
login forms, loading/errors, and controlled migration from browser data follow
after those routes exist. No AI service is added in this phase.
