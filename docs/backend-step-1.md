# Backend step 1: Express foundation

## Frontend assessment

The frontend is a solid first release for its local-first scope. Its core
workflows, storage/backup logic, production build, and targeted keyboard/mobile
checks passed. No issue found in this review blocks backend integration.

Before calling the full product production-ready, we still need authenticated
ownership, server validation, account storage, awaited API actions with pending/
retry/conflict states, and broader screen-reader/browser/device testing.

## What this step implements

- Express 5 app separated from HTTP startup.
- Environment configuration validated before listening.
- GET /api/health, exact browser-origin allowlist, security headers, 100 KB JSON limit.
- Request IDs and logs excluding queries, bodies, cookies, and authorization.
- JSON 404/400/403/413/500 errors without private stack details.
- SIGINT/SIGTERM shutdown handling with a forced-shutdown timeout.
- Real HTTP and configuration tests using Node's built-in test runner.

The health endpoint checks the HTTP process only. It does not imply database
readiness. The frontend still uses browser storage and is not connected to the API.

## Exact commands in VS Code

Open `C:\Users\Praveen\Documents\Spendwise` so src and server are visible in
Explorer. Use Node.js 24.

Terminal 1 — frontend:

```powershell
cd C:\Users\Praveen\Documents\Spendwise
npm run dev
```

Terminal 2 — backend:

```powershell
cd C:\Users\Praveen\Documents\Spendwise
npm run dev:server
```

Dependencies are installed already. On a fresh checkout install both lockfiles:

```powershell
npm ci
npm --prefix server ci
```

To customize configuration, create server/.env if it does not already exist:

```powershell
Copy-Item server/.env.example server/.env
```

Node's --env-file-if-exists flag loads the file; no dotenv package is needed.
An absent .env message is expected when using defaults. npm runs server scripts
with server/ as the working directory. Stop with Ctrl+C.

## Structure and file responsibilities

```text
server/
  src/
    config/env.js                 # environment validation
    errors/HttpError.js            # explicit public HTTP errors
    middleware/requestContext.js   # request IDs and safe metadata logs
    middleware/errorHandler.js     # unknown routes and consistent JSON errors
    routes/health.js               # health response with no-store caching
    app.js                         # middleware/routes, no listener side effects
    server.js                      # listener, timeouts, startup/shutdown handling
  test/app.test.js                 # loopback HTTP tests
  test/config.test.js              # valid/invalid configuration tests
  .env.example
  package.json
  package-lock.json
```

The frontend keeps its original root package.json and lockfile. The server has
its own dependencies: Express, cors, and helmet. No MongoDB package is needed yet.

## Configuration

| Variable | Development default | Purpose |
| --- | --- | --- |
| NODE_ENV | development | development, test, or production |
| HOST | 127.0.0.1 | Loopback-only development listener |
| PORT | 5000 | Integer from 1 through 65535 |
| CLIENT_ORIGINS | http://localhost:5173,http://127.0.0.1:5173 | Allowed frontend origins |

Production defaults to host 0.0.0.0 unless HOST is set. A future deployment must
set its actual frontend origin. If Vite chooses a different port, update
CLIENT_ORIGINS and restart. Origins must not include a path or trailing slash.

CORS is not authentication. Requests without an Origin header are allowed so
command-line clients and health checks work. Cookie credentials are not enabled;
the authentication phase will define that policy.

## Verify it yourself

Open [the health endpoint](http://127.0.0.1:5000/api/health), or run in another terminal:

```powershell
Invoke-RestMethod -Uri http://127.0.0.1:5000/api/health
npm run test:server
npm test
```

The response contains status "ok", service "spendwise-api", and an ISO timestamp.
Unknown URLs return JSON errors with a request ID, also present in the
X-Request-Id response header and request log.

Request flow: request ID → security headers → origin policy → JSON parser → route
→ response, or the not-found/error handler.

## Verification performed

- Server dependency install reported 0 vulnerabilities.
- All 9 backend tests passed against temporary loopback HTTP listeners.
- All 48 existing frontend tests passed again.
- The actual npm start entry point ran on 127.0.0.1:5000, and a direct HTTP request
  returned the expected health JSON. The verification server was then stopped.
- Signal shutdown is implemented; graceful draining under load was not tested.
- Database, authentication, financial APIs, and frontend API integration remain
  future work.

## Next checkpoint

Run this step and confirm the health response. Next is MongoDB setup and model
validation, then authentication/ownership before connecting account data.
Database credentials and hosting choices are not assumed here.

References: [Express 5 setup](https://expressjs.com/en/guide/migrating-5/),
[error handling](https://expressjs.com/en/5x/guide/error-handling/),
[CORS middleware](https://expressjs.com/en/resources/middleware/cors/),
[Node environment-file flags](https://nodejs.org/api/cli.html).
