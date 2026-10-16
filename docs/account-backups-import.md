# Account backups and reviewed initial import

## Run from VS Code

```powershell
cd C:\Users\Praveen\Documents\Spendwise
code .
npm install
npm --prefix server install
```

Configure `server/.env` with your own MongoDB Atlas or replica-set URI. Then use two VS Code terminals:

```powershell
npm run dev
```

```powershell
npm run dev:server
```

Open http://127.0.0.1:5173/data?source=account and sign in. Account storage needs a connected permanent database for everyday use. The browser checks for this phase used a disposable local test database, not permanent infrastructure.

## Use it

1. **Download account backup** reads a consistent snapshot of every account month, including payment links. It generates a portable SpendWise JSON file with no passwords or session tokens.
2. **Download account CSV** exports all account transactions in INR with spreadsheet formula protection.
3. **Review local workspace** creates a draft in browser memory. Alternatively, choose a SpendWise JSON file. Choosing a source does not upload it.
4. **Validate import with account** sends the draft to the authenticated server for validation and compares its counts with the current account. It saves no financial records.
5. **Review and confirm import** shows the destination email and counts. Confirming atomically creates new account IDs and remaps payment links.
6. If the response is lost, **Retry same import safely** reuses its request UUID. The persisted import receipt prevents duplicates. A refreshed page cannot start a second initial import in that account.

Initial import is available once, only for an empty account. This phase does not merge into a populated account or replace account data. Local restore remains a separate browser-only operation with its existing confirmation and undo behavior. Restoring an account backup into another empty account is supported.

Import is limited to 5 MB per request, 10,000 transactions, 10,000 budgets, 1,000 schedules, and 10,000 linked occurrences. Invalid/future transaction dates, duplicate category budgets, unknown fields, and missing, shared, or mismatched payment links are rejected. A file that passes local backup parsing can still fail stricter server import checks. No partial import or partial account backup is returned.

## Architecture and file map

- `src/components/data/AccountData.jsx`: explicit review/confirmation, exports, errors, pending requests, safe retries, and cancellation when leaving the page.
- `src/services/accountWorkspaceApi.js`: authenticated requests, bounded requests/timeouts, response validation, and stripping server metadata from portable backups.
- `src/pages/DataPage.jsx`: separate Local workspace and Account data views; existing local backup behavior is retained.
- `server/src/routes/workspace.js`: authenticated, CSRF-protected `GET /api/workspace`, `POST /api/workspace/preview`, and `POST /api/workspace/import`. Only these import routes accept up to 5 MB; normal API routes retain their 100 KB limit.
- `server/src/services/workspace.js`: independent server validation, snapshot exports, atomic import, ID remapping, and persisted retry receipts.
- `server/src/models/index.js`: adds the owner-unique `WorkspaceImport` receipt model. Run the existing index command when updating a production database.
- `server/src/services/finance.js`: serializes account financial writes with imports using a transaction write on the owner record. This closes a race between an empty-account check and a normal transaction being added.

MongoDB transaction operations are sequential. Exports use snapshot read concern. Imports commit all collections and their receipt together or roll everything back. A database outage or standalone MongoDB deployment does not silently fall back to browser storage.

## Verification

```powershell
npm test
npm run build
npm run test:server
npm --prefix server run test:workspace
npm --prefix server run test:finance
```

The new workspace integration suite covers authentication, CSRF, non-mutating preview, invalid links, concurrent idempotent retries, owner isolation, exports, round-trip restore, large preview bodies, refusal to overwrite accounts, concurrent normal writes, and rollback after a simulated database failure.

Browser checks imported the existing fictional local sample into a disposable test account: 14 transactions, 12 budgets, six schedules, and four links. The downloaded JSON parsed successfully with zero missing links and no password/session hashes. Local records were left unchanged. Account page width was checked at 320 px with no horizontal page overflow.

Verification totals: 92 frontend tests, 20 backend unit/HTTP/model checks, nine workspace integration scenarios, twelve finance integration scenarios, eight authentication integration scenarios, and the database persistence/index test passed. The production frontend build also passed. Integration parent containers are excluded from these scenario counts.

Next: follow `real-account-setup.md` for permanent database setup, then implement Google sign-in. Credentials alone do not implement Google login.
