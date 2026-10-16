# SpendWise: remaining end-to-end and production work

Eight of ten delivery milestones are complete. This counts milestones, not percentage production readiness. Milestone 9 includes several substantial operational/authentication tasks; deployment and release verification are milestone 10.

## Implemented

React/Vite finance pages; INR charts and summaries; local persistence/backups/undo; authenticated Express/Mongoose APIs; owner-scoped transactions/budgets/schedules; atomic recurring expenses; permanent Atlas configuration; cookie sessions; Google sign-in and password-confirmed identity linking; account exports and reviewed initial imports into empty accounts.

The user confirmed finance records survived a backend restart. Google token verification reached the existing-account linking flow, and the user subsequently reached Account. Password recovery now has forms, expiring one-time links, hashed tokens, encrypted durable email jobs, Gmail SMTP configuration, delivery retries, notifications, atomic reset, and session/authentication-version revocation. SMTP connection/authentication passed. The user confirmed the recovery stage; deployment-specific email delivery still needs checking.

## Remaining gates

| Area | Required work / completion evidence |
| --- | --- |
| Recovery in production | Local recovery stage confirmed by user. Repeat the full inbox/reset/session/data checks on the deployed origin. |
| Email verification (deferred by user) | Verify password-registration emails, resend/cooldown, expiring tokens and appropriate access policy; account recovery is not registration verification. |
| Account security controls (deferred by user) | Signed-in password change, Google-only password setup policy, session list/revoke/sign-out-all, and safe Google unlink/recovery rules. |
| Shared abuse controls | Implemented shared Atlas counters with TTL expiry, separate login/recovery namespaces and explicit proxy configuration. Validate the chosen hosting proxy topology. Login throttle bypass is development-only. |
| Database operations | Choose appropriate backup/retention, test restoring an actual backup, protect database users/network access, and define index migrations/rollback. |
| Email operations | Use a dedicated production sender/provider, verify sender domain and SPF/DKIM/DMARC as applicable, monitor queue failures/bounces/quotas, retain stable encryption keys and manage rotation. |
| Hosting | Deploy frontend and API with HTTPS, configure trusted production origins, frontend routing fallback, `/api` routing, Google OAuth origins, cookie behavior and compatible popup headers. |
| Secrets | Put database/SMTP credentials and encryption keys in hosting secret settings; revoke/replace credentials exposed during setup and document rotation. |
| Monitoring | Safe structured logs, health/readiness checks, uptime/error alerts, queue delivery metrics, dependency/security updates and incident/recovery instructions. |
| User data controls | Account/data deletion with explicit confirmation and retention policy; privacy/support information and clear local-versus-account storage behavior. |
| Release audit | Automated real-browser registration/login/Google/recovery/finance/import/export workflows, multi-user isolation, concurrency and failure checks, keyboard/screen-reader/mobile review, and deployed-environment smoke tests. |

Initial import intentionally does not merge into or overwrite populated accounts. A more advanced merge/import conflict workflow is optional additional product scope.

## Optional product extensions

Real bank aggregation, automatic money transfers, push reminders, and AI categorization/anomaly detection are separate integrations. SpendWise can be a complete finance-tracking project without them. Recurring-payment recording currently tracks expenses; it does not pay bills.

## Next action

Follow [full-stack deployment preparation](deployment.md), choose SMTP-compatible hosting, then configure the public URL and verify the deployed release. Email verification and signed-in security controls remain explicitly deferred and must be revisited before public release. Do not label the app production-ready solely because the build and automated fixtures pass.
