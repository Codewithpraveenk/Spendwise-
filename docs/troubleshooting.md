# Local startup troubleshooting

## Start the complete app

Open C:\Users\Praveen\Documents\Spendwise in VS Code. Stop older SpendWise development terminals with Ctrl+C, then use one terminal:

```powershell
cd C:\Users\Praveen\Documents\Spendwise
npm run dev
```

This starts Express and waits up to 30 seconds for MongoDB readiness before starting Vite at http://localhost:5173. Keep this terminal running. Do not additionally start a second backend. Ctrl+C stops the development command. The VS Code task SpendWise: Start app (API + frontend) runs the same command.

## Cannot reach the account server

Two separate failures were observed: the frontend was running without an API, and a later Google POST was interrupted by a backend watch-mode restart (ECONNRESET). Normal npm run dev now uses a stable backend process without watch mode. A working frontend page alone does not prove the API is running.

In a second terminal:

```powershell
npm run doctor
```

Both API and Frontend API proxy should report ready. If the API fails, inspect the api-prefixed terminal output. Check private server/.env configuration, Atlas network access and your network. Never share the file or credential-bearing connection strings. If you use a custom API port, set SPENDWISE_API_TARGET to its HTTP origin before starting development and before running doctor.

Vite uses port 5173 strictly and keeps localhost on IPv4 so localhost and 127.0.0.1 reach the same server. If the port is occupied, stop the older SpendWise terminal rather than using an unexpected port that Google OAuth does not allow. Use localhost for Google sign-in because that is the configured Google origin.

Backend and frontend can still be started separately for debugging with npm run dev:server and npm run dev:client. Do not mix these with the combined command.

## ENOENT: package.json not found

The terminal is outside the project. Run the cd command above, or open the Spendwise folder in VS Code before creating the terminal.

## Missing authContext.js or stale Vite cache

The provider is src/state/AuthProvider.jsx and the context/hook are src/state/useAuth.js. There should be no imports of authContext.js or AuthContext.jsx. For a cache rebuild only, stop the combined command, then use two debugging terminals: npm run dev:server and npm run dev:client -- --force.

## Database unavailable

/api/health checks whether the process is alive. /api/ready checks database readiness. Financial writes require Atlas or a MongoDB replica set. A wrong-password response is different from a connection failure; do not remove production authentication protections to fix network errors.

## Editing backend code

Normal development keeps the API running without automatic restarts so sign-in requests are not interrupted. After changing backend code, stop and restart npm run dev when no request is in progress. For deliberate backend debugging only, npm run dev:server:watch enables watch mode; saving backend files can interrupt requests. Do not run that together with the combined command. Frontend hot reload stays enabled normally.

## Interrupted Google sign-in

An interrupted Google request is not automatically replayed because its nonce may already have been consumed. Choose your Google account again for a fresh attempt. Anonymous popup focus no longer starts a competing session check; authenticated sessions still recheck when returning to the app. Use http://localhost:5173 for the configured Google origin. Existing records are not deleted or replaced when a request fails.
