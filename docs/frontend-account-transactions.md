# Account integration, step 1 — transactions

This step connects transaction browsing, creation, editing, and deletion to the
real financial API. It deliberately keeps local and account storage separate.
Overview, budgets, recurring payments, and backup/restore remain local in this step.

## What to run in VS Code

Frontend terminal:

```powershell
cd C:\Users\Praveen\Documents\Spendwise
npm run dev
```

Backend terminal, with `server/.env` configured for Atlas or a MongoDB replica set:

```powershell
cd C:\Users\Praveen\Documents\Spendwise
npm run dev:server
```

Open `http://127.0.0.1:5173/transactions`. Choose Local workspace for the existing
browser data, or Account data for server records. Sign in if requested. You can
also open `/transactions?source=account` or use the link on Account.

No new dependencies are required. No permanent MongoDB instance is installed or
configured by this step. Account writes require transaction-capable MongoDB; see
[backend step 4](backend-step-4.md). A standalone database returns the existing
503 TRANSACTIONS_REQUIRED error. No local-storage fallback is used for account writes.

## Files and workflow

- `src/pages/TransactionsPage.jsx` adds an explicit storage selector. Local
  Transactions retains its previous provider, filters, samples, and undo. Switching
  views does not upload, combine, or copy records.
- `src/components/transactions/AccountTransactions.jsx` owns transient account
  month data and request state. It renders loading, empty, filter-empty, error,
  and signed-out states. Its instance is keyed by user ID; sign-out or account
  changes unmount it and abort pending requests, discarding private rows/drafts.
- `src/services/financeApi.js` handles credentialed JSON requests, timeout and
  cancellation, strict public-record validation, and pagination. Writes send
  whitelisted editable fields; client-generated IDs and owner values are excluded.
- `src/components/transactions/TransactionForm.jsx` now awaits both asynchronous
  account saves and existing synchronous local saves. Fields/actions disable
  while saving. Storage-specific descriptions distinguish server and browser data.
- `src/state/AuthProvider.jsx` provides an expire action. A financial 401 clears
  account state; the account view shows Sign in without exposing local records.
- `src/components/layout/AppLayout.jsx` labels account transaction storage and
  suppresses unrelated local save/undo notices in that view.
- `src/pages/AccountPage.jsx` and `src/pages/AuthPage.jsx` explain the new storage
  behavior and link to account transactions.
- `src/services/financeApi.test.js` adds nine tests for pagination, validation,
  payload/version handling, deletion, authorization errors, cancellation, and
  avoiding automatic mutation retries.

## Monthly data and totals

Choose any month from January 2000 through December 2100. Each request fetches at
most 100 records; the client follows cursors until the month is complete. Only
then are records and totals displayed. Search/type/category/sort work across that
loaded month. A failed or malformed later page rejects the entire load rather
than showing partial financial totals. Months over 10,000 records show an explicit
capacity error. This limit protects browser memory; larger datasets will need
server-side filtering and aggregate endpoints in a later scaling phase.

Cursor pages are not a database snapshot across requests. Concurrent changes from
another device may require Reload account records. No background cache of private
transactions is written to localStorage. Page refresh fetches the server again.

## Saves, conflicts, and deletion

Editing captures the record version. A stale edit returns 409; the draft stays
visible with Discard draft and reload. The version is not silently advanced and
the older values are not resubmitted automatically.

For a network failure, unreadable success response, timeout, or server failure,
the outcome of a write can be uncertain. The UI blocks further mutations in that
account view until you reload and check what was saved. It never retries ordinary
POSTs automatically because the API does not yet support request idempotency keys.

Deleting an account transaction opens a confirmation identifying the record and
amount and explaining that this server deletion has no undo. The request includes
the current version. Linked bill expenses are protected by the server and report
409; payment-management UI integration follows in a later step. Local deletion
continues to use its existing undo behavior.

Navigating away during a submitted request aborts the client request, which cannot
guarantee that the server rolled back. Return to the account view to fetch the
actual saved state before making another attempt. Normal save/delete success also
refetches the complete month rather than claiming optimistic server success.

## Verification

```powershell
cd C:\Users\Praveen\Documents\Spendwise
npm test
npm run build
npm run test:server
```

Backend finance regressions, from `server`: `npm run test:finance`.

Completed checks:

- 65 frontend tests passed, including nine new finance-client scenarios.
- Production frontend build passed.
- Browser tests used the real Express API and a disposable MongoDB replica set.
  An empty account stayed empty; create persisted INR 125.50 correctly, refresh
  retained it, edit changed it to INR 130.75, and a later two-tab edit preserved
  the newer INR 140.25 when the stale tab attempted INR 150.00.
- Confirmed deletion, cancellation of deletion, search/no-match, and clearing
  filters worked. The 14 original local transactions remained in the local view.
- The shared local editor still saved successfully. With the test API stopped,
  an attempted account save showed its uncertain-result warning and required
  reload; the following read showed a retry error instead of stale account rows.
- Sign-out removed access to private rows; a second account had an empty month
  while the first account retained its separate record after signing in again.
- Responsive account view checked at actual 320px and 1280px widths, with no page
  overflow. The table retains its own horizontal scrolling region on narrow screens.
- All 18 backend unit/HTTP/model checks and the financial integration suite with
  ten ownership/integrity subtests passed during this phase.

The browser-test database is disposable and is stopped after QA. Its fictional
accounts/transactions are not permanent app data. No personal database is touched.

## Remaining in milestone 8

Connect account dashboard totals/charts, budgets, recurring schedules, and payment
recording next. Add account-aware backups and an explicit reviewed import flow.
Existing local backups continue to contain only local data. Permanent database
setup, recovery/verification, deployment, and broader release testing remain separate
milestones. The overall milestone count stays at seven complete, with milestone 8
now in progress.
