# SpendWise

A student finance manager built with React, Vite, JavaScript, Tailwind CSS, React Router, Recharts, Express and MongoDB. Amounts use integer paise and INR formatting.

## Features

- Responsive overview with income/expense summaries, charts and category breakdowns.
- Searchable transactions, category budgets and recurring-payment tracking.
- Separate browser-local and authenticated account workspaces.
- Owner-scoped APIs, version conflict handling and atomic recurring-payment records.
- Password authentication, HttpOnly cookie sessions and Google sign-in with safe existing-account linking.
- Password recovery with expiring single-use tokens, session revocation and encrypted queued email.
- Account exports and reviewed initial local-data import into empty accounts.

Recurring-payment recording tracks expenses; it does not make bank payments. AI and bank integrations are not implemented.

## Run in VS Code

Open this repository folder in VS Code. Use Node.js 24 and npm.

```powershell
npm ci
npm ci --prefix server
if (-not (Test-Path server/.env)) { Copy-Item server/.env.example server/.env }
```

Only copy the example when server/.env does not already exist. Keep existing private configuration intact. Configure Atlas and Google using [account setup](docs/real-account-setup.md) and [Google sign-in](docs/google-sign-in.md). Never commit real credentials.

Use two VS Code terminals from the repository root:

```powershell
npm run dev:server
```

```powershell
npm run dev
```

Open the URL printed by Vite, normally http://localhost:5173. Local workspace features use browser storage. Account features require the API and MongoDB. Recovery requires a configured email transport.

## Architecture

`src/` contains the React pages, reusable UI, state, API clients and finance calculations. `server/src/` contains Express routes, authentication, validation, Mongoose models and mail delivery. Development uses Vite's API proxy. Production can serve built React and /api from one Node service behind HTTPS.

## Validation

```powershell
npm run check:release
```

This runs frontend/backend checks, builds React and runs seven disposable MongoDB integration suites. It does not use your private Atlas records or send real emails. Initial integration setup downloads a MongoDB test binary.

Most recent local release run: 100 frontend checks, 30 backend checks, all seven integration suites and the production build passed. HTTP smoke checks covered the actual built assets, nested client route and API errors. This is not proof of deployed Google/email behavior or a completed browser release audit.

The GitHub Actions workflow runs release checks and builds the Docker image. Its first remote run and the container build are still pending.

## Status and deployment

Eight of ten core delivery milestones are complete; remaining milestones contain substantial release work. The app is not publicly deployed or declared production-ready. Email verification, signed-in security controls and Brevo account setup are explicitly deferred. Local Gmail SMTP remains configured privately; HTTPS email support is implemented but needs provider credentials for free hosting.

- [Current progress](docs/progress.md)
- [GitHub preparation and upload](docs/github-release.md)
- [Full-stack deployment](docs/deployment.md)
- [Free-hosting email setup](docs/free-hosting-email.md)
- [Remaining production work](docs/production-readiness.md)

Local browser data remains accessible to users of that browser profile. Account sign-in protects server-owned records, not local workspace data. Keep secrets and personal financial exports out of source control.
