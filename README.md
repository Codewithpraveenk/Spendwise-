# SpendWise

SpendWise is a student finance manager built with the MERN stack. It brings income, expenses, category budgets and recurring payments into one place, with a dashboard for reviewing where money goes each month.

**[Open SpendWise](https://spendwise-praveenk.onrender.com)**

The live app runs on Render's free plan, so the first request after inactivity can take a while. Password-reset email is disabled on this deployment.

![SpendWise sign-in page](docs/live-sign-in-preview.png)

## What you can do

- Create an account and sign in before accessing financial records. New accounts start empty.
- Add, edit and delete income and expense transactions.
- Search and filter transactions, and review monthly totals and category spending.
- Set category budgets and follow their progress.
- Manage recurring payments and record a payment as an expense.
- Review income and expenses through charts, summaries and recent transactions.
- Export account data and preview an initial import into an empty account.

Amounts are stored as integer paise and displayed in Indian rupees. Recording a recurring payment only updates SpendWise records; it does not transfer money or charge a bank account.

## Tech stack

| Part | Technologies |
| --- | --- |
| Frontend | React 19, JavaScript, Vite 7, Tailwind CSS 4 |
| Navigation and charts | React Router 7, Recharts 3 |
| API | Node.js 24, Express 5 |
| Database | MongoDB, Mongoose 9, MongoDB Atlas |
| Authentication | Password hashing, HTTP-only session cookies, Google Identity Services |
| Email support | Nodemailer/SMTP or Brevo's HTTP API |
| Testing | Node.js test runner, jsdom, mongodb-memory-server |
| Deployment | Render, Docker configuration, GitHub Actions |

## How it fits together

During development, React runs on port 5173 and Express runs on port 5000. Vite forwards `/api` requests to Express. In production, Express can serve both the built frontend and the API from the same origin.

```text
Browser: React + React Router + Recharts
                 |
                 | /api requests
                 v
          Express API
                 |
                 v
          MongoDB / Atlas
```

The server checks the signed-in user before accessing account records. Database queries are scoped to that user. Updates include version checks to catch conflicting edits, and recurring-payment recording uses database transactions.

## Run locally

### 1. Install the prerequisites

- Node.js 24 and npm.
- Git.
- A MongoDB Atlas cluster, or a local MongoDB replica set. A standalone MongoDB instance is not enough for the transaction-based flows.

### 2. Clone and install

```bash
git clone https://github.com/Codewithpraveenk/Spendwise-.git
cd Spendwise-
npm ci
npm ci --prefix server
```

Open the cloned folder in VS Code. Run the following commands from the repository root, where the main `package.json` is located.

### 3. Configure the server

In PowerShell, copy the example only if you do not already have a configuration file:

```powershell
if (-not (Test-Path server/.env)) {
  Copy-Item server/.env.example server/.env
}
```

On macOS or Linux:

```bash
test -f server/.env || cp server/.env.example server/.env
```

Edit `server/.env`. For a local setup without Google or email, use:

```dotenv
NODE_ENV=development
HOST=127.0.0.1
PORT=5000
CLIENT_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
APP_ORIGIN=http://localhost:5173
MONGODB_URI=mongodb+srv://YOUR_USER:YOUR_ENCODED_PASSWORD@YOUR_CLUSTER/spendwise?retryWrites=true&w=majority
MAIL_PROVIDER=disabled
```

Replace the database placeholders with your own values. URL-encode special characters in the database password and remove placeholder brackets. In Atlas, create a database user and allow your computer's IP to connect. Your Atlas website login and database user are separate accounts.

Keep credentials in the server environment. Do not put database passwords or email keys in frontend code or `VITE_*` variables. See [account setup](docs/real-account-setup.md) for the longer walkthrough.

### 4. Start the app

```bash
npm run dev
```

This starts the API and waits for database readiness before starting Vite. Keep the terminal running, then open **http://localhost:5173** and create an account.

The normal backend process does not restart on file changes. Restart it after changing server code, or use the optional watch command listed below.

### 5. Check a connection problem

In a second terminal:

```bash
npm run doctor
```

This checks the API and the Vite proxy. An account-server error usually means the API is stopped, the database connection failed, or the frontend cannot reach the API. Check the terminal output before retrying sign-in.

## Optional authentication and email setup

### Google sign-in

Set `GOOGLE_CLIENT_ID` in `server/.env` to a Google OAuth web client ID. Register the exact app origin under **Authorized JavaScript origins** in Google Cloud:

```text
http://localhost:5173
http://localhost
```

If you use another browser origin, register that exact origin too. For a deployment, add its HTTPS origin to the same client. A local origin does not enable sign-in on the hosted domain. Google configuration changes may take time to propagate.

The app uses Google's ID-token flow; it does not need a Google client secret in the frontend. Full instructions are in [Google sign-in setup](docs/google-sign-in.md).

### Password recovery

Recovery is implemented but requires a configured email provider. It uses expiring, single-use reset tokens and revokes existing sessions after a reset. Queued email content is encrypted at rest.

Choose SMTP or Brevo, configure the relevant server environment values, and preserve `MAIL_ENCRYPTION_KEY` across restarts and deployments. Use `MAIL_PROVIDER=disabled` when email is intentionally unavailable.

- [SMTP and password recovery](docs/password-recovery.md)
- [Brevo setup for free hosting](docs/free-hosting-email.md)

## Project structure

```text
Spendwise-/
├── src/
│   ├── components/       Reusable UI, account views and layouts
│   ├── pages/            Overview, transactions, budgets, recurring and auth pages
│   ├── hooks/            Shared React hooks
│   ├── state/            Authentication and client state
│   ├── services/         API clients, backups and browser storage helpers
│   ├── utils/            Finance calculations, formatting and validation
│   └── data/             Category definitions and sample/legacy workspace data
├── server/
│   ├── src/
│   │   ├── auth/         Password, Google and session handling
│   │   ├── config/       Environment configuration
│   │   ├── middleware/   Access checks, rate limits and error handling
│   │   ├── models/       Mongoose models
│   │   ├── routes/       API endpoints
│   │   ├── services/     Finance and workspace operations
│   │   └── mail/         Email delivery
│   ├── test/             Backend unit and integration tests
│   └── .env.example      Configuration template without credentials
├── test/                 UI and route regression tests
├── scripts/              Development startup and diagnostics
├── docs/                 Setup and deployment guides
├── .github/workflows/    Release checks
├── Dockerfile
└── render.yaml
```

Legacy browser storage helpers support reviewed imports. They do not automatically fill a new account with demo records.

## API overview

| Route | Purpose |
| --- | --- |
| `GET /api/health` | Check whether the API process is responding |
| `GET /api/ready` | Check database readiness |
| `GET /api/auth/capabilities` | Report whether password recovery is available |
| `/api/auth` | Registration, login, logout, current user, Google sign-in and recovery |
| `/api/finance/transactions` | Transaction operations |
| `/api/finance/budgets` | Budget operations |
| `/api/finance/recurring` | Recurring-payment operations |
| `POST /api/finance/recurring/:id/payments` | Record a recurring payment |
| `/api/workspace` | Account export, import preview and initial import |

Finance and workspace endpoints require an authenticated session. Write requests are validated on the server; the frontend is not the access-control boundary.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the API and frontend together |
| `npm run doctor` | Check local API and proxy connectivity |
| `npm run dev:client` | Run Vite separately |
| `npm run dev:server` | Start the API without file watching |
| `npm run dev:server:watch` | Start the API with Node's watch mode |
| `npm test` | Run frontend calculation, state and service tests |
| `npm run test:ui` | Run UI regression tests |
| `npm run test:server` | Run backend unit tests |
| `npm run test:integration` | Run the seven MongoDB integration suites |
| `npm run build` | Build the React app into `dist/` |
| `npm run check:release` | Run checks, the frontend build and integration suites |
| `npm --prefix server run db:indexes` | Prepare declared database indexes |
| `npm start` | Start the Express server |

Integration tests use disposable MongoDB instances rather than your configured Atlas account. The first run downloads a MongoDB test binary. These tests do not establish whether your live Google client or email provider is configured correctly.

The GitHub Actions workflow runs release checks and builds the Docker image. Check the repository's Actions tab for the status of a particular commit.

## Deployment

The current deployment serves the frontend and API from one Render Node service, backed by MongoDB Atlas.

Build command:

```bash
npm ci --include=dev && npm ci --prefix server --omit=dev && npm run build
```

Start command:

```bash
npm --prefix server run db:indexes && npm start
```

Set `NODE_ENV=production`, `HOST=0.0.0.0`, `SERVE_FRONTEND=true` and the private database configuration on the host. Use `/api/ready` as the readiness endpoint. Configure the exact public origin for the app, CORS and Google sign-in. Render's assigned URL can supply the app origin when explicit origins are absent.

Use HTTPS for production sessions. Set `TRUST_PROXY` according to the actual proxy path; do not enable proxy trust without checking how requests reach the server. Allow the host's outbound network in Atlas and prepare indexes before serving traffic.

See [deployment details](docs/deployment.md), [production environment example](server/production.env.example) and [Render configuration](render.yaml). A multi-stage [Dockerfile](Dockerfile) is also included.

## Current limitations

- The live preview has password-reset email disabled. SMTP and Brevo support need valid provider configuration to deliver recovery emails.
- Google sign-in requires a correctly configured OAuth client. End-to-end sign-in on the public deployment still needs final verification.
- Recurring payments are records and reminders, not automatic bank debits.
- There is no bank connection, transaction-sync service or AI categorisation service.
- Email verification, signed-in password/session management, account deletion and a wider browser/accessibility audit remain unfinished.
- A free hosting preview is not a substitute for monitoring, database backups and a tested restore procedure.

SpendWise is a deployed student project. The remaining release work is tracked in [production readiness](docs/production-readiness.md).

## Author

**Praveenkanth K** — B.Tech Artificial Intelligence and Data Science, Chennai Institute of Technology.

[GitHub](https://github.com/Codewithpraveenk) · [LinkedIn](https://www.linkedin.com/in/praveenkanth-k-4a9925342/)
