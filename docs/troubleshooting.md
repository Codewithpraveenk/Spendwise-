# Local startup troubleshooting

## Start the complete app

Open C:\Users\Praveen\Documents\Spendwise in VS Code. Stop older SpendWise development terminals with Ctrl+C, then use one terminal:

```powershell
cd C:\Users\Praveen\Documents\Spendwise
npm run dev
```

This starts Express and waits up to 30 seconds for MongoDB readiness before starting Vite at http://localhost:5173. Keep this terminal running. Do not additionally start a second backend. Ctrl+C stops the development command. The VS Code task SpendWise: Start app (API + frontend) runs the same command.

## Cannot reach the account server

The original incident was caused by running the frontend while backend port 5000 had no listener. A working frontend page does not prove the API is running.

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
