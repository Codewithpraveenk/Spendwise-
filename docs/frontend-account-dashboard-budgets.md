# Account integration, step 2 — overview and budgets

Account transaction data now drives dashboard summaries, daily spending, category
breakdown, recent transactions, and budget progress. Monthly category limits can
be created, edited, and removed through the real financial API. Local workspace
data remains separate. Recurring payments and backups still use local storage.

## Run in VS Code

Frontend terminal:

```powershell
cd C:\Users\Praveen\Documents\Spendwise
npm run dev
```

Backend terminal, with a configured Atlas or local replica-set MONGODB_URI in
`server/.env`:

```powershell
cd C:\Users\Praveen\Documents\Spendwise
npm run dev:server
```

Sign in, then choose Account data on Overview or Budgets. Direct routes:

- `http://127.0.0.1:5173/?source=account`
- `http://127.0.0.1:5173/budgets?source=account`

The selected month and account storage mode stay in links among Overview,
Transactions, and Budgets. Choosing Local workspace returns to the browser data.
No data is imported or seeded into an account. No new dependency is needed.

## Architecture and files

- `src/services/financeApi.js`: shared bounded monthly pagination for transactions
  and budgets, validation of money/category/month/version, budget CRUD payloads,
  and the combined account-month read. Budget payloads omit computed progress,
  owner fields, and client IDs. Updates/deletes include the captured version.
- `src/hooks/useAccountMonth.js`: loads all transactions and budgets for the
  selected month before displaying either. Cancels obsolete reads on month,
  account, or page changes. A 401 expires the client session; other failures
  show retry UI rather than empty financial totals.
- `src/components/layout/StorageView.jsx`: reusable local/account selector and
  session gate. The account component is keyed by user ID so rows, limits, and
  drafts cannot carry across accounts. It also supplies shared storage guidance.
- `src/components/layout/AccountMonthStatus.jsx`: common loading/error/retry UI.
- `src/components/dashboard/AccountOverview.jsx`: server-backed summaries,
  Recharts spending, category breakdown, recent records, and top-three budgets.
  It reuses the existing finance calculations and display components.
- `src/components/budgets/AccountBudgets.jsx`: account limits, overspending,
  unbudgeted expenses, asynchronous CRUD, and a versioned removal confirmation.
- `src/components/budgets/BudgetForm.jsx`: now supports awaited account saves and
  existing synchronous local saves. Saving disables controls; stale/uncertain
  writes require a reload before another submission. In account mode, choose the
  month on the page before opening the form; its month is fixed while editing.
- `src/components/dashboard/RecentTransactions.jsx`: account links preserve
  source=account; local links keep their original behavior.
- Overview/Budgets page wrappers and AppLayout connect the new views, labels,
  account-aware navigation, and local-notice suppression.
- `src/services/accountBudgetApi.test.js`: eight new tests for budget requests,
  input/response validation, duplicate limits, versioned writes, read failures,
  and reconciliation across summary/chart/budget calculations.

## Data and error behavior

The UI loads complete selected months, at most 100 records per server page and
10,000 records per collection in the browser. Duplicate or malformed records
reject the load. If transactions succeed but budgets fail (or vice versa), the
overview/budget view shows an error, with no partial totals. There is no shared
account-data cache in localStorage. Changing pages or refreshing fetches current
server data; Reload account month refreshes the currently mounted page.

The two collections are separate HTTP reads, not a database snapshot. Changes
made concurrently by another device can require a reload. No automatic polling
or claims of live bank synchronization are added.

Budget spending comes only from account expenses in the chosen month. Income is
excluded. Spending without a category limit stays visible separately. Removing a
limit keeps every transaction; a confirmed empty plan is distinct from a failed
read. Net balance remains recorded income minus expenses, not a bank balance.

Version conflicts preserve the draft and offer Discard draft and reload. Uncertain
network/server failures block resubmission until reload. No budget POST is retried
automatically. Backend uniqueness additionally enforces one limit per account,
month, and category. Account budget deletion requires confirmation and has no undo.

## Verification commands

```powershell
cd C:\Users\Praveen\Documents\Spendwise
npm test
npm run build
npm run test:server
```

Completed browser checks use a real Express API with a disposable MongoDB replica
set. Fictional records produced INR 1,000 income, INR 175.50 expenses, and INR 824.50
net. Food INR 125.50 against a INR 100 budget showed INR 25.50 over, and Transport
INR 50 stayed unbudgeted. Duplicate limits were rejected in the form. A two-tab
edit kept the newer INR 150 limit and rejected the older tab's INR 200 attempt.
Refresh retained the saved limit. Removal kept all three transactions and made
INR 175.50 unbudgeted. Navigation retained account source and month.

Account overview, account budgets, and the budget dialog were checked at 320px
without horizontal page/dialog overflow; overview was also checked at 1280px.
The original local budget plan remained separate. Automated tests total 73 frontend
checks, including the eight new budget-client scenarios. Build and backend
regression results are recorded in the phase completion report.

All 73 frontend tests, 18 backend unit/HTTP/model checks, and the final production
build passed in this phase. Signing out hid the private dashboard. The shared
local budget editor still saved successfully. With the QA API stopped, the account
dashboard showed Retry account month and removed its summary cards; the local
dashboard retained its original INR 18,000 income and INR 9,038 expenses for October.

The QA database/accounts are temporary and stopped after testing. A permanent
database still needs configuration. This is targeted QA; full accessibility,
cross-device, and production deployment audits remain pending.

## Next step

Connect account recurring schedules, payment recording/removal, and upcoming
payments. Then add account-aware backups and a reviewed local-to-account import.
Milestone 8 remains in progress; permanent database/recovery work and deployment
remain milestones 9 and 10.
