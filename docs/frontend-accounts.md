# Frontend phase — account screens and session integration

This phase adds real registration/login forms, session restoration, account
details, and logout. It keeps the existing finance workspace local until a later
integration phase. The UI states that distinction explicitly.

## Files and architecture

- `src/services/authApi.js`: relative `/api/auth` requests, credentials included,
  JSON/custom headers on writes, bounded timeouts, cancellation, safe errors, and
  response mapping. Passwords and session tokens are never put in localStorage.
- `src/state/useAuth.js`: stable context and consumer hook in their own module.
- `src/state/AuthProvider.jsx`: provider owns loading, anonymous, authenticated,
  submitting, and error state. It checks `/me` on startup and window focus,
  cancels stale requests, and avoids interrupting an active submission on focus.
  Splitting the hook/context from the component avoids React Fast Refresh context
  replacement errors while editing the provider in VS Code.
- `src/pages/AuthPage.jsx`: shared sign-in/register form with explicit labels,
  autofill hints, field validation, confirmation, visibility toggle, disabled
  submission state, and server errors. Form passwords clear after failed requests
  and stay only in the form's memory while it is mounted.
- `src/pages/AccountPage.jsx`: session details, signed-out state, connection retry,
  sign-out errors, and a clear explanation of current storage behavior.
- `src/components/layout/AppLayout.jsx`: account navigation, header links, route
  titles, and existing focus/skip-to-content handling.
- `src/main.jsx`: mounts AuthProvider above all app routes.
- `src/App.jsx`: adds `/login`, `/register`, and `/account`. Finance routes remain
  accessible locally without login. Signed-in users visiting either form go to
  the account page.
- `vite.config.js`: proxies `/api` to `http://127.0.0.1:5000` during development.
  An optional SPENDWISE_API_TARGET environment variable changes this server target;
  it is a dev-server setting, not a client credential.
- `src/services/authApi.test.js`: eight tests for request configuration, errors,
  timeout/cancellation, logout, response shape, and account form validation.

No new frontend dependency is required.

## Run and edit in VS Code

```powershell
cd C:\Users\Praveen\Documents\Spendwise
code .
npm run dev
```

In a second VS Code terminal, with your MongoDB URI configured in `server/.env`:

```powershell
cd C:\Users\Praveen\Documents\Spendwise
npm run dev:server
```

Visit `http://127.0.0.1:5173/account`, then choose Create account or Sign in.
Backend configuration is described in steps 2–4. Accounts require a working
MongoDB connection. Financial writes additionally require Atlas or a replica set.
Without the backend, the local dashboard still works and account screens report
the connection problem. Do not put MongoDB credentials in frontend environment
variables. The temporary database used for browser testing is stopped after QA;
its test account is not a permanent user account.

## Manual checks to try

1. Submit an empty registration form: errors appear and the first invalid input
   receives focus. Enter a valid email and a 15–128-character passphrase, then
   confirm it. A mismatch must prevent registration.
2. Register a fictional account. The account page shows only its name and email.
3. Refresh: `/me` restores the server session without saving account details in
   browser storage. Opening a form while signed in returns to Account.
4. Sign out, then sign in with an incorrect password: the server error appears
   and the password field clears. Retry with the correct password.
5. Stop the backend: account requests show a connection error while local finance
   pages remain available. Restart it, then use Retry connection on Account.
6. On a narrow viewport, inputs and buttons remain within the page. Navigation
   retains its own horizontal scrolling area on phones.

Automated checks from the project root:

```powershell
npm test
npm run build
```

Backend regressions are `npm run test:server`. Integration commands in `server`
remain `npm run test:auth`, `npm run test:db`, and `npm run test:finance`.

## Verification completed

- All 56 frontend tests passed; production build passed.
- Real browser + Express + disposable MongoDB: registration, invalid form focus,
  sign-in, incorrect password feedback, refresh persistence, logout, and recovery
  from the backend initially being offline.
- Account and registration layouts checked at 320px; registration also at 768px.
  Document width did not overflow. The default viewport was restored after testing.
- A Fast Refresh/context issue and Windows case-insensitive module-resolution
  cache issue were found during development and fixed with separate, distinctly
  named modules plus a Vite restart. A fresh reload loads the final app correctly.

This is targeted browser QA, not a full screen-reader, device, or security audit.
Production hosting needs same-origin `/api` forwarding to Express before the SPA
fallback, HTTPS cookies, and a permanent database. Vite's dev proxy is not part of
the static production build; the existing frontend-only hosting configuration
must be extended before deploying integrated accounts.

See [quantified progress](progress.md) and [backend account details](backend-step-3.md).
