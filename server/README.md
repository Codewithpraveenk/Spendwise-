# SpendWise API — MongoDB foundation

Express foundation with `GET /api/health`, validated configuration, CORS, security
headers, request IDs/logging, JSON errors, and shutdown handling. MongoDB connection
handling, readiness, and validated financial models are now included.
Registration/login, protected account lookup, and logout now use hashed passwords
and revocable MongoDB sessions. Protected financial CRUD, version conflicts, and
atomic recurring payment APIs are implemented. Frontend integration comes later.

See [step 4: financial API contract and tests](../docs/backend-step-4.md).
Financial writes require a MongoDB replica set or Atlas; standalone MongoDB returns
503 TRANSACTIONS_REQUIRED. Existing browser data is not migrated by these routes.

See [step 3: authentication walkthrough and API checks](../docs/backend-step-3.md).

See [step 2: configuration, architecture, and tests](../docs/backend-step-2.md).

Use Node.js 24. In this folder's VS Code terminal:

```powershell
npm ci
npm run dev
```

Dependencies are already installed in the current workspace. Optionally copy
.env.example to .env to customize defaults; do not overwrite an existing .env.

Open [the health endpoint](http://127.0.0.1:5000/api/health), or run:

```powershell
Invoke-RestMethod -Uri http://127.0.0.1:5000/api/health
```

`npm start` runs without file watching. `npm test` runs the server tests.
Stop the server with Ctrl+C. If port 5000 is in use, set another PORT in .env.
See [the full walkthrough](../docs/backend-step-1.md).
