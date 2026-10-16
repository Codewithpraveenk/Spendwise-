# Google sign-in

Password recovery has since been implemented and Gmail SMTP authenticated; see [password recovery](password-recovery.md) for the current checkpoint and pending real inbox check. The verification notes below record the earlier Google phase.

Google Identity Services is implemented using the official browser button and Google's official `google-auth-library` backend dependency. The supplied public client ID is configured in `server/.env` as `GOOGLE_CLIENT_ID`. No client secret is needed for this ID-token flow, and no database credential belongs in frontend code.

## Run in VS Code

```powershell
cd C:\Users\Praveen\Documents\Spendwise
npm --prefix server install
npm --prefix server run db:indexes
```

Run in one terminal:

```powershell
npm run dev:server
```

Run in another terminal:

```powershell
npm run dev
```

Restart the backend after changing `server/.env`; Node watch does not reliably reload environment-file changes. Restart Vite if its configuration changes. Use http://localhost:5173/login consistently for the Google check. Other ports and `127.0.0.1` are different origins and browser workspaces.

## First real login

1. In Google Cloud → Google Auth Platform → Clients, open the **Web application** client whose ID matches `GOOGLE_CLIENT_ID`.
2. Add both `http://localhost` and `http://localhost:5173` under **Authorized JavaScript origins**, then Save. Google's setup guide specifies both for local development. These are not redirect URIs. Allow time for Google's configuration change to propagate.
3. If the OAuth project is in testing mode, add the Google email you intend to use under the audience's test users.
4. Open SpendWise sign-in. If already signed in, sign out first.
5. Click the initial **Continue with Google** control to load Google's official button, then click that button and choose your account in Google.
6. For a new Google identity/email, SpendWise creates a persistent user and its normal HttpOnly cookie session.
7. If the email already belongs to a password account, enter that existing **SpendWise password** in the linking form and select **Connect Google and sign in**. This preserves its user ID, transactions, budgets, and schedules. Never enter your Google password into SpendWise.
8. Confirm the account page shows the expected email and account records. Refresh, sign out, and use Google again to verify the returning-account flow. A Google-only account has no SpendWise password until a future password-management flow is implemented.

Google account selection and any Google password/MFA prompts must be completed by the user. Automated fixture tests do not prove a live Google account login works. The first browser check reported an unauthorized-origin error; after the user saved both localhost origins, a real Google credential passed server verification and reached `GOOGLE_LINK_REQUIRED` for an existing SpendWise password account. The user must enter their existing SpendWise password to complete linking. A completed Google-backed SpendWise session is not yet confirmed.

## How the code works

- `src/components/auth/GoogleSignIn.jsx`: lazy SDK loading, official button, explicit linking form, pending/error/retry states. Google credentials and linking passwords stay only in component memory and are never placed in localStorage or URLs.
- `src/services/googleIdentity.js`: loads only `https://accounts.google.com/gsi/client`, with a bounded timeout and retry option if blocked.
- `src/services/authApi.js` / `src/state/AuthProvider.jsx`: existing session lifecycle extended with Google login. The client obtains its public client ID from the backend challenge, avoiding duplicated frontend configuration.
- `server/src/auth/google.js`: short-lived random nonce challenge, hashed challenge persistence, Google signature/audience/issuer/expiry verification, verified-email and nonce checks, and identity lookup by stable Google `sub`.
- `server/src/models/index.js`: sparse unique Google identity index on User; password hash remains required for password accounts. Google-only accounts do not receive a fabricated password. GoogleChallenge has a unique token-hash index and expiry TTL index; expiry is checked during requests, independent of TTL cleanup timing.
- `server/src/routes/auth.js`: `GET /api/auth/google/challenge` and `POST /api/auth/google`; normal account JSON/header/CSRF protections and rate limits apply.

Successful Google login consumes the nonce atomically with user creation/linking, clears its challenge cookie, and issues the same opaque SpendWise session used by password login. Tokens are not accepted based on client-supplied profile data. Existing password accounts cannot be linked solely because an email matches. A Google identity already linked elsewhere cannot replace an account's identity. Provider email changes do not move a returning Google identity to another SpendWise account.

## Troubleshooting

- **Origin is not allowed:** verify the exact client ID and both `http://localhost` and `http://localhost:5173` JavaScript origins in Google Cloud. Save, allow propagation, reload SpendWise, and start Google sign-in again. Merely adding a redirect URI will not authorize the browser origin.
- **Access blocked / testing audience:** add the intended Google email as a test user or correct the OAuth audience configuration.
- **Google sign-in could not load:** check browser/network blocking of the Google SDK. Email/password sign-in remains available.
- **Could not be verified:** start again using **Choose Google account again**; the challenge expires after five minutes and cannot be replayed after success.
- **Too many attempts:** production and test environments limit account attempts to 10 per 15 minutes, shared with password routes. Local development skips this limiter to allow repeated setup and debugging. Restart the development backend to clear any previous in-memory lockout after this update. Password proof for linking remains required; rate-limit changes do not recover a forgotten password.
- **Google is not configured:** check `GOOGLE_CLIENT_ID` in the backend environment and restart the backend.

Vite's development server sets `Cross-Origin-Opener-Policy: same-origin-allow-popups` and an appropriate development referrer policy. The eventual production frontend host must configure compatible popup/security headers too; API headers alone do not configure frontend HTML hosting. Production OAuth origins must be HTTPS and explicitly authorized in Google Cloud.

## Verification

```powershell
npm test
npm run build
npm run test:server
npm --prefix server run test:google
npm --prefix server run test:auth
```

Google unit tests verify claims and locally signed JWTs using Google's official verifier, including bad signature, audience, issuer, and expiry rejection. The real MongoDB Google integration suite uses a test-only injected token verifier to check challenges, account creation, existing-password proof, identity stability, conflicting identities, session cookies, replay prevention, expiry, and logout. That injection is never selected through an HTTP request or environment variable.

Verified totals for this phase: 95 frontend tests, 24 backend unit/HTTP/model tests, seven Google integration scenarios, eight password-auth scenarios, twelve finance scenarios, nine workspace scenarios, the database persistence/index test, and the production build passed. The official browser button loaded and resized to fit a 320 px page without horizontal overflow. After both origin changes, a real Google token passed backend verification and reached the password-confirmed linking screen. No completed Google-backed SpendWise session has been claimed.

Official references:
- https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid
- https://developers.google.com/identity/gsi/web/guides/verify-google-id-token
- https://developers.google.com/identity/gsi/web/reference/js-reference

Still pending: user completion of linking and verification of the resulting Google-backed SpendWise session, email verification/password recovery, password changes and session management, production abuse controls, deployment, and the release audit.
