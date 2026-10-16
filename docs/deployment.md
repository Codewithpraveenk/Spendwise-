# Full-stack deployment preparation

Nothing is publicly deployed yet. Email verification and signed-in password/session controls remain deferred at the user's request.

## Architecture

One Node 24 service serves the built React app and /api behind HTTPS. Atlas stores finance records, accounts, sessions, encrypted mail jobs and shared production rate counters. The mail worker runs in the Node process. Vite remains the development/build tool.

Client routes support refresh; unknown API routes return JSON errors. Hashed assets receive long cache lifetimes, HTML uses no-store, and Google popup/CSP headers are configured.

## Run checks in VS Code

Open C:\Users\Praveen\Documents\Spendwise as your VS Code folder, then:

```powershell
cd C:\Users\Praveen\Documents\Spendwise
npm ci
npm ci --prefix server
npm run check:release
```

This runs frontend/backend checks, builds React and runs seven disposable MongoDB integration suites. It does not read real account records or send real emails. The initial run may download a MongoDB test binary. Normal development now uses one terminal: npm run dev starts both services and waits for database readiness. npm run doctor verifies the API and frontend proxy.

## Hosting decision

The user selected free hosting with HTTPS email delivery. A free Render blueprint is supplied in render.yaml; use the Brevo setup in docs/free-hosting-email.md. Hosting still needs Node 24, HTTPS, Atlas connectivity and private environment secrets. An always-running process supports queued mail/retries reliably.

Render free services block SMTP ports 25, 465 and 587 and sleep after inactivity. The current Gmail transport cannot work there. The Brevo HTTPS adapter is now implemented; live provider configuration is pending. Do not purchase hosting before choosing a budget. See [official free-service limitations](https://render.com/docs/free).

The old Netlify/Vercel static configurations do not run this Express API or mail worker. They are not the full-stack deployment path.

## Production environment

Use server/production.env.example as the configuration checklist. Put actual values in hosting secrets or ignored server/production.env, never in source or VITE_* variables.

- NODE_ENV=production, HOST=0.0.0.0, SERVE_FRONTEND=true; use the host's assigned PORT.
- APP_ORIGIN and CLIENT_ORIGINS must match the exact public HTTPS origin, without a trailing slash.
- Configure a production Atlas database, restricted database user/network access and backups.
- Set GOOGLE_CLIENT_ID and add the public origin to Google's Authorized JavaScript origins.
- Set MAIL_PROVIDER=brevo, BREVO_API_KEY and the verified MAIL_FROM sender. Preserve MAIL_ENCRYPTION_KEY so queued email remains readable.
- TRUST_PROXY=false by default. Set 1 only when every inbound request traverses exactly one trusted proxy and direct access is blocked; use loopback for a trusted local reverse proxy. Incorrect trust allows spoofed client addresses.
- Replace database/SMTP credentials previously shared in chat before public deployment. Keep replacements private.

## Build and start

Hosting build commands from the repository root:

```powershell
npm ci
npm ci --prefix server
npm run build
```

With production variables supplied, prepare declared indexes before routing traffic:

```powershell
npm --prefix server run db:indexes
npm start
```

Index preparation adds declared indexes without dropping existing ones. Production disables automatic index creation. Resolve index errors before release, including TTL cleanup for shared counters.

If using a private local configuration file instead:

```powershell
cd C:\Users\Praveen\Documents\Spendwise\server
node --env-file=production.env src/ensureIndexes.js
node --env-file=production.env src/server.js
```

Production cookies require HTTPS. A plain HTTP local production run is not an authentication acceptance test. The combined server fails startup if the frontend build is missing.

## Optional Docker

The multi-stage Dockerfile builds React and runs Node as an unprivileged user. Private env files and local dependencies are excluded from its build context. Docker is not installed on this workstation, so the image has not been built or validated here.

```powershell
docker build -t spendwise .
docker run --rm --env-file server/production.env spendwise node server/src/ensureIndexes.js
docker run --rm --name spendwise --env-file server/production.env -p 5000:5000 spendwise
```

Put an HTTPS reverse proxy in front of the container. Liveness uses /api/health; configure readiness against /api/ready as well. Liveness alone does not establish database availability.

## Release acceptance

Verify health/readiness, nested-route refresh and API JSON errors. Test real registration, logout, Google/password login, secure cookies, email recovery, finance persistence after restart, user isolation, recurring payments and import/export. Inspect browser CSP errors, mobile layout and keyboard access.

Production login/recovery counters persist in Atlas across instances/restarts. Login throttle bypass remains development-only. Complete the deferred authentication controls, backup restore exercise, monitoring, account deletion/privacy controls and wider browser audit in docs/production-readiness.md before public release.

Keep the previous build/image for application rollback. Do not roll back by deleting user records or indexes; database restore needs a separate reviewed recovery procedure.

## Free Render blueprint

After creating a GitHub repository and pushing the source, create a Render Blueprint from that repository using render.yaml. Review the Free plan and enter the requested private environment values. APP_ORIGIN and CLIENT_ORIGINS need the actual assigned HTTPS address. Add that address to Google origins too. This file has not been deployed or validated by Render yet.

The start command prepares indexes before starting the app because free services do not provide a separate pre-deploy job. A failed index step prevents startup. TRUST_PROXY remains conservative until the actual proxy path is verified; this may group users under one proxy IP and must be checked before release.
