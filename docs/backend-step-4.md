> Current contract update: payment recording requires `version` alongside `billMonth` and `date`. Paid schedules allow final-month edits that preserve recorded bills. See [account recurring payments](frontend-account-recurring.md) for the current behavior.

# Backend step 4 — protected financial APIs

The backend can now create, read, update, and delete account-owned transactions,
budgets, and recurring schedules. It can record and remove recurring bill payments
atomically. The current frontend still uses browser storage; this phase does not
migrate or overwrite that data. All files remain editable in the VS Code project.

## Architecture

The request flow is:

`Express → CORS/body parser → accountAccess → session user → route validation → finance service → MongoDB`

- `server/src/middleware/accountAccess.js` shares the no-cache, JSON/custom-header,
  cross-site-write, and database availability guards with authentication routes.
- `server/src/services/financeValidation.js` checks exact input fields, integer
  paise, compatible categories, real date-only values, India-local future dates,
  IDs, versions, month ranges, and bounded pagination. Numeric strings are rejected.
- `server/src/services/finance.js` owns database queries and transactional writes.
  Every record lookup includes the authenticated owner. Public records expose
  `id` and `version`, hiding MongoDB's `_id`, `__v`, and the owner field.
- `server/src/routes/finance.js` maps HTTP methods to validated service calls.
- `server/src/database.js` detects replica-set/sharded topology support for writes.
- `server/test/finance.integration.js` tests real HTTP requests against a disposable
  one-node MongoDB replica set, including two separate accounts and concurrent calls.

There are no new runtime dependencies in this phase. Transactions follow the
[Mongoose transaction API](https://mongoosejs.com/docs/transactions.html).

## Endpoint contract

All paths below begin with `/api/finance`. The caller must be signed in. Write
requests require JSON and `X-Spendwise-Request: 1`, including DELETE requests.
Browser calls need `credentials: 'include'` and the same-site host setup from step 3.

| Methods | Path | Behavior |
| --- | --- | --- |
| GET, POST | /transactions | List or create transactions |
| GET, PUT, DELETE | /transactions/:id | Read, replace, or delete a transaction |
| GET, POST | /budgets | List or create category budgets |
| GET, PUT, DELETE | /budgets/:id | Read, replace, or delete a budget |
| GET, POST | /recurring | List or create schedules |
| GET, PUT, DELETE | /recurring/:id | Read, replace, or delete a schedule |
| POST | /recurring/:id/payments | Record one billing month's payment |
| GET | /payments | List payment occurrences |
| GET, DELETE | /payments/:id | Read or remove a payment and its expense |

Single-record responses use `{ item: ... }`; creation returns 201, and deletion
returns 204. Payment creation returns `{ payment, transaction, schedule }`.
Responses include record timestamps. Empty lists return `items: []`.

All lists accept `month=YYYY-MM`, `limit=1..100` (default 50), and `cursor=ID`.
They return `{ items, nextCursor }` in descending ID order. Pass nextCursor back
to fetch the next page. Month filters use actual transaction date, budget month,
active schedule range, or billMonth, respectively. Billing month and actual
payment date may differ. Pagination is not a cross-request database snapshot;
refresh a list after writes. Display sorting remains a client integration task.

Create transaction:

```json
{"description":"Lunch","type":"expense","category":"Food","amountPaise":12500,"date":"2000-01-01"}
```

Create budget:

```json
{"month":"2026-10","category":"Food","limitPaise":400000}
```

Create recurring schedule:

```json
{"name":"Internet","category":"Utilities","amountPaise":59900,"dueDay":31,"startMonth":"2026-10","endMonth":null}
```

Dates in examples are fictional. Amounts are positive integer paise; INR 125.00
is 12500. PUT is a full replacement of editable fields, plus the current numeric
`version`; it is not PATCH. Omit or set endMonth to null for no schedule end.
DELETE requires `{ "version": 0 }`, using the actual version from the latest GET.
Unknown fields (including owner and MongoDB update operators) are rejected.

## Integrity and conflicts

- Sessions supply the owner; the client cannot choose or change it. An existing
  record belonging to someone else returns the same 404 as a missing record.
- Unique indexes enforce one category budget per account/month and one payment per
  account/schedule/billing month. Duplicate writes return 409.
- A version mismatch returns 409. Concurrent edits using the same version cannot
  silently overwrite one another. The client must refresh and let the user retry.
- Payment recording locks the schedule by updating its version, then creates the
  expense and payment link in the same transaction. A concurrent duplicate or any
  failed write rolls back the whole operation, including that version change.
- Removing a payment deletes its linked expense in the same transaction. The bill
  can then be recorded again. It is a destructive user action; the later UI must
  explain both deletions before submission.
- Direct edits/deletes of linked expenses return 409. Schedules with payment
  history cannot be edited/deleted in this phase. Remove payment records first.
  A future history-preserving schedule revision feature can relax this restriction.
- All financial writes require transaction-capable MongoDB. A standalone database
  supports account APIs and reads but financial writes return 503 with code
  TRANSACTIONS_REQUIRED. No partial-write fallback is used.

## Run from VS Code

From the project root:

```powershell
cd C:\Users\Praveen\Documents\Spendwise
npm run dev
```

For the backend in a second terminal, configure `server/.env` with an Atlas or
local replica-set MONGODB_URI, then:

```powershell
cd C:\Users\Praveen\Documents\Spendwise\server
npm ci
npm run db:indexes
npm run dev
```

This phase does not create a permanent database. The standalone local URI shown in
step 2 must point to a replica set before using financial writes. Don't change an
existing database's topology casually; use Atlas or configure a dedicated local
development replica set. Never put a MongoDB URI in a frontend VITE variable.

After registration/login using the PowerShell session in step 3, run these
requests in that same terminal so `$spendwiseSession` is still available:

```powershell
$financeUrl = 'http://127.0.0.1:5000/api/finance'
$financeHeaders = @{ 'X-Spendwise-Request' = '1' }
$expenseBody = @{
  description = 'Lunch'
  type = 'expense'
  category = 'Food'
  amountPaise = 12500
  date = '2000-01-01'
} | ConvertTo-Json

$createdExpense = Invoke-RestMethod -Uri "$financeUrl/transactions" -Method Post -ContentType 'application/json' -Headers $financeHeaders -Body $expenseBody -WebSession $spendwiseSession
Invoke-RestMethod -Uri "$financeUrl/transactions?month=2000-01&limit=20" -WebSession $spendwiseSession

$deleteBody = @{ version = $createdExpense.item.version } | ConvertTo-Json
Invoke-RestMethod -Uri "$financeUrl/transactions/$($createdExpense.item.id)" -Method Delete -ContentType 'application/json' -Headers $financeHeaders -Body $deleteBody -WebSession $spendwiseSession
```

PowerShell variables are local to a terminal. Run login and these requests in the
same terminal, or log in again in a new one. The example creates then deletes a
fictional expense in your configured database; automated tests below are isolated.

## Tests

From `server`:

```powershell
npm test
npm run test:auth
npm run test:db
npm run test:finance
```

The finance suite starts and cleans up disposable MongoDB with replica-set support.
It never reads your MONGODB_URI. It tests authentication, cross-site guards, CRUD,
ownership for all collections, strict inputs, cursor/month filters, unique budgets,
stale/concurrent edits, inactive bills, concurrent payments, linked-history guards,
and payment removal/re-recording. A real database validator deliberately rejects a
payment insert to verify that neither the expense nor schedule change survives.
The standalone database suite also verifies unsupported writes return a clear 503
without creating a record.

## Next phase

Build frontend registration/login and account state, then connect one financial
workflow at a time with loading, errors, conflict handling, and explicit storage
mode. Preserve existing local data until a reviewed import flow exists. Ordinary
transaction POSTs do not yet have request-idempotency keys, so do not automatically
retry them after an ambiguous network failure; refresh first. Recurring bill
recording is protected by its unique schedule/month identity.

Public deployment still needs the recovery/verification and operational work
documented in step 3. AI features remain outside this phase.
