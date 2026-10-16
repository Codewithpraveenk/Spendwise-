# Backend step 2 — MongoDB foundation

This step adds persistence building blocks. The frontend still uses local browser
storage. No account or financial API routes are exposed yet, and existing browser
data is not migrated or seeded into MongoDB.

## Architecture and files

- `server/src/database.js`: opens an isolated Mongoose connection, checks readiness,
  and closes it. Connections time out rather than waiting indefinitely.
- `server/src/models/index.js`: defines User, Transaction, Budget,
  RecurringPayment, and PaymentOccurrence. All financial records require an owner.
- `server/src/config/env.js`: validates database configuration; production requires
  MONGODB_URI. Never commit a real connection string.
- `server/src/app.js`: `/api/health` checks the running process; `/api/ready`
  returns 200 only when a database ping succeeds, otherwise 503.
- `server/src/server.js`: connects before listening when a URI is provided,
  sanitizes connection failures, and closes MongoDB during normal shutdown.
- `server/src/ensureIndexes.js`: explicitly creates production indexes without
  dropping existing ones.
- `server/test/models.test.js`: validates records without needing MongoDB.
- `server/test/database.integration.js`: uses a disposable real MongoDB process
  to test persistence and unique indexes. It never reads your MONGODB_URI.

Money is a positive integer in paise: INR 125.00 is stored as 12500. Calendar dates
remain YYYY-MM-DD strings to avoid timezone shifts. Budgets are unique for an
owner, month, and category. A recurring payment occurrence links one schedule and
billing month to one transaction, with unique indexes to prevent duplicates.
Schedules allow due days 1–31; the later payment service will clamp them to the
last day of shorter months, matching the frontend.

Mongoose references do not prove another record exists or belongs to the owner.
Authentication, owner-scoped queries, cross-record checks, strict request
validation, and atomic payment writes must be implemented in the later API phase.
The passwordHash field is hidden from normal queries and JSON; password hashing
and login are not implemented here. Do not use placeholder hashes for accounts.
Document validators are intended for validated document saves; future update
routes must not bypass them using arbitrary query updates.

## Run it in VS Code

Open `C:\Users\Praveen\Documents\Spendwise` in VS Code. In its terminal:

```powershell
cd C:\Users\Praveen\Documents\Spendwise\server
npm ci
if (!(Test-Path .env)) { Copy-Item .env.example .env }
code .env
```

Choose your own local MongoDB installation or Atlas database. For an already
running local MongoDB, uncomment this line in `server/.env`:

```dotenv
MONGODB_URI=mongodb://127.0.0.1:27017/spendwise
```

For Atlas, use its generated application connection string with a database name,
a database user, and permitted network access. Keep credentials in `.env`, never
in frontend VITE variables. This phase does not install a permanent database or
create a cloud account for you. The disposable test database is not app storage.

```powershell
npm run dev
```

In another terminal:

```powershell
Invoke-RestMethod http://127.0.0.1:5000/api/health
Invoke-RestMethod http://127.0.0.1:5000/api/ready
```

Expect `ok` and `ready` with MongoDB connected. Without MONGODB_URI in development,
the server starts but readiness returns 503. With an unreachable URI, startup
fails. Development builds indexes automatically; before starting production:

```powershell
npm run db:indexes
npm start
```

The index command can fail if existing records violate uniqueness. Resolve those
records deliberately; the command does not delete them.

## Verification commands

From the `server` folder:

```powershell
npm test
npm run test:db
```

The second command downloads an official MongoDB binary on first use and starts
an ephemeral local process. It needs network access initially and permission to
open local ports. Tests check saved money values, duplicate email/budget/payment
rejection, independent owners, hidden password hashes, and readiness after close.

From the project root, `npm test` and `npm run build` verify the frontend.

Verified in this workspace: 15 backend tests passed, the real MongoDB integration
test passed, all 48 frontend tests passed, and the frontend production build passed.
An ongoing local/Atlas application database has not been configured. The database
integration test used only disposable storage, which was closed after testing.

Dependency documentation: [Mongoose connections](https://mongoosejs.com/docs/connections.html)
and [validation and unique indexes](https://mongoosejs.com/docs/validation.html).

Next checkpoint: implement authentication and owner-scoped financial APIs before
switching the frontend from browser storage to the server.
