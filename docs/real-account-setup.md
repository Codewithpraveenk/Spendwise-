# Next phase: permanent accounts and Google sign-in

Current checkpoint: permanent Atlas storage is now configured and the user confirmed persistence after restart. Google sign-in code and the public client ID are configured; see [Google sign-in](google-sign-in.md) for the current run instructions, both localhost origins, and the pending live account test. The preparation steps below are retained as a setup reference.

The real Express account/finance APIs exist. Everyday persistence still needs your own MongoDB deployment. Google sign-in is not implemented yet; its credentials are preparation for the next implementation phase.

## First connect permanent MongoDB

1. Use your MongoDB Atlas account and create a database deployment for SpendWise.
2. Create an application database user with read/write access to the `spendwise` database. This is separate from your Atlas website login.
3. Permit your current development IP in the project's network access list. Production will need the backend host's permitted egress addresses.
4. Copy the Node.js application connection string from Atlas. Set its database name to `spendwise`, replace its placeholders, and URL-encode any special characters in username/password components.
5. Edit `C:\Users\Praveen\Documents\Spendwise\server\.env` in VS Code and add your actual URI there:

```dotenv
MONGODB_URI=mongodb+srv://APP_USER:ENCODED_PASSWORD@YOUR_CLUSTER/spendwise?retryWrites=true&w=majority
```

This line is an example, not a working credential. The agent prepared `server/.env` from the example only if it did not already exist. It is excluded by `.gitignore`. Do not put the database URI in a frontend `VITE_` variable or send it in chat.

From the project root:

```powershell
npm --prefix server run db:indexes
npm run dev:server
```

In a second terminal:

```powershell
npm run dev
```

Check readiness without printing credentials:

```powershell
Invoke-RestMethod http://127.0.0.1:5000/api/ready
```

Expected: `status: ready`, `database: connected`. Register a personal SpendWise account through the app, add one fictional record, restart the backend, and sign in again to verify persistence. Keep using the same frontend hostname; `localhost` and `127.0.0.1` have separate browser storage/cookies. Use Atlas or a replica set, because financial writes, exports, and imports depend on transactions.

Official reference: https://www.mongodb.com/docs/atlas/connect-to-database-deployment/

## Prepare Google configuration after database readiness

1. Create/select your own Google Cloud project and configure its OAuth branding/audience.
2. Create an OAuth client of type **Web application**.
3. For the planned Google Identity Services browser flow, authorize `http://localhost:5173` as a JavaScript origin. Use localhost consistently when verifying Google login; additional accepted development origins must exactly match your browser URL and Google's origin rules.
4. Keep the client ID available. A Google client ID is public configuration; database passwords, Google account passwords, client secrets, access tokens, and ID tokens should not be pasted into chat.
5. The next code phase will add frontend/server client-ID configuration, the Google button, server-side ID-token verification, Google identity persistence, safe linking to existing accounts, and ordinary SpendWise cookie sessions. We will specify the exact variable names when implementing them. The planned ID-token verification flow does not need a Google client secret in frontend code.

A configured Google client alone will not make the present app support Google sign-in. After implementation, a real browser login must be tested with your Google account; simulated token tests cannot prove the live provider setup works.

Official reference: https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid

## Still pending afterward

Email verification, forgotten-password recovery, password changes/session revocation, production abuse controls and monitoring, deployment, production cookies/routing, database backup recovery checks, and a broader end-to-end release audit. Bank connections, actual money transfers, and optional AI are separate future scope.
