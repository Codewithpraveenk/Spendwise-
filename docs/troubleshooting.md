# Local startup troubleshooting

## Missing authContext.js / blank page

The account provider is now `src/state/AuthProvider.jsx`; the stable context and
hook are in `src/state/useAuth.js`. There should be no imports of authContext.js
or AuthContext.jsx. The earlier similarly named files confused Windows/Vite's
cached module resolution during development.

Stop the running Vite process with Ctrl+C before entering commands. Typing another
npm command while Vite is running does not start a fresh terminal command.

```powershell
cd C:\Users\Praveen\Documents\Spendwise
npm run dev -- --force
```

Refresh the browser after Vite prints its local URL. The force flag rebuilds Vite's
dependency cache; it does not erase saved finance data. Future starts can use
`npm run dev` normally.

## ENOENT looking for C:\Users\Praveen\package.json

The terminal is outside the project. Use the cd command above first, or open the
Spendwise folder in VS Code and create a new integrated terminal.

## Account API / connection refused / database unavailable

The frontend can run independently. Registration and login additionally require
Express and a working MongoDB URI in `server/.env`. In a separate terminal:

```powershell
cd C:\Users\Praveen\Documents\Spendwise
npm run dev:server
```

The backend deliberately reports account storage unavailable if MongoDB is not
configured. A health response does not prove database readiness. See
[database setup](backend-step-2.md) and [account instructions](frontend-accounts.md).
Financial writes need Atlas or a replica set as explained in backend step 4.
