# Account recurring payments

Open this project in VS Code:

```powershell
cd C:\Users\Praveen\Documents\Spendwise
code .
npm install
npm --prefix server install
```

For persistent account storage, configure `server/.env` using `server/.env.example` and your own MongoDB Atlas or replica-set connection. No permanent database has been configured automatically. Never commit `.env`.

Run these in two VS Code terminals from the project directory:

```powershell
npm run dev
```

```powershell
npm run dev:server
```

Open http://127.0.0.1:5173, sign in, visit Recurring payments, and select Account data. Keep the frontend hostname consistent so the session cookie works.

## What changed

- Account schedules support create, edit, and removal before payment history exists.
- Record a payment to atomically create its expense and bill occurrence. This tracks a payment; it does not transfer money or connect a bank.
- Review the linked expense in its actual transaction month, including early and late payments.
- Removing a payment recording requires confirmation and atomically removes its linked expense. Reloaded dashboard and budget totals reflect that removal.
- Once a schedule has payment history, only its inclusive final month can change. Recorded bills must remain within its range. To change its price, finish that schedule and create another.
- Loading, empty, error, expired-session, stale-version, and uncertain-save states prevent misleading totals and automatic write retries.
- Local and account workspaces remain separate. Existing backups still cover local data only.

## Important files

- `src/components/recurring/AccountRecurring.jsx`: account page orchestration, filters, forms, and confirmations.
- `src/services/financeApi.js`: validated API reads and versioned writes; account month data loads together.
- `src/utils/accountRecurring.js`: links schedules to recorded expenses across transaction months.
- `src/hooks/useAccountMutation.js`: pending writes, cancellation, conflicts, session expiry, and reload handling.
- `server/src/services/finance.js`: owner-scoped persistence and MongoDB transactions.
- `src/services/accountRecurringApi.test.js` and `server/test/finance.integration.js`: response validation and financial integrity checks.

API clients must include `version` with `billMonth` and `date` when recording a payment. Schedule listings now include `hasPaymentHistory`; payment listings include the linked `expense`.

## Checks

```powershell
npm test
npm run build
npm run test:server
npm --prefix server run test:finance
```

Integration checks use a disposable real MongoDB replica set. They do not establish permanent application storage. Google sign-in, recovery/verification, account backups, reviewed local imports, and deployment remain pending. See `progress.md` for the milestone count.

Verified this phase: 84 frontend tests, 18 backend unit/HTTP/model checks, 12 finance integration scenarios (13 Node tests including the parent), and the production build passed. Browser checks covered explicit month/date saves, inactive final-month cutoff, paid-history protection, linked expense recording/removal, and a 320px viewport without horizontal page overflow. Browser checks used fictional accounts in disposable MongoDB; that test API has been stopped. Existing local schedules remain available.
