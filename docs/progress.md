# SpendWise progress — deployment preparation checkpoint

This plan measures ten equally counted delivery milestones for the core product.
Eight are complete (80% by milestone count). This is not a time estimate or a
production-readiness score: permanent storage, authentication completion, recovery, and deployment still
contain substantial work. Optional AI is outside these ten milestones.

| # | Milestone | Status |
| --- | --- | --- |
| 1 | Responsive finance pages, INR summaries, charts, filters, and local CRUD | Complete |
| 2 | Browser persistence, validation, backup/restore, CSV, and undo | Complete |
| 3 | Express foundation, configuration, health, errors, and request logging | Complete |
| 4 | MongoDB connection layer, financial models, and database indexes | Complete |
| 5 | Authentication API, password hashing, cookie sessions, expiry, and logout | Complete |
| 6 | Protected financial APIs, ownership, version conflicts, atomic payments | Complete |
| 7 | Frontend registration/login, session restoration, account page, logout | Complete |
| 8 | Connect financial pages to APIs and safely migrate local data | Complete: account views, exports and reviewed initial import into empty accounts |
| 9 | Permanent database, Google sign-in, recovery/verification, shared abuse controls, operational hardening | In progress: Atlas connected, persistence confirmed by user; Google and recovery implemented; SMTP authenticated; recovery confirmed by user; shared production counters implemented; email verification and account controls deferred |
| 10 | Deploy, verify production routing/cookies, broader accessibility and end-to-end release audit | In progress: combined server, environment template, container and release checks prepared; public deployment pending |

## Concrete inventory

- Ten feature pages: Overview, Transactions, Budgets, Recurring payments,
  Data & backups, Account, Sign in, Create account, Forgot password, Reset password, plus a not-found route.
- Three editable finance collections with owner-scoped server CRUD.
- Nineteen financial HTTP method/path operations, three workspace operations, eight authentication operations,
  and two health/readiness operations. This counts methods separately, not URLs.
- Eleven MongoDB models: User, Transaction, Budget, RecurringPayment, PaymentOccurrence,
  Session, WorkspaceImport, GoogleChallenge, PasswordReset, MailJob, and RateLimitBucket.
- One hundred frontend tests and thirty backend unit/HTTP/model tests pass.
- Seven real MongoDB integration suites have passed:
  authentication (eight lifecycle subtests), finance (twelve ownership/integrity
  subtests), workspace backup/import (nine subtests), Google authentication (seven subtests), recovery (eight subtests), database persistence/index checks, and shared production counter checks. Integration suite containers
  are not counted as extra feature scenarios here.
- Frontend production build passes. Nothing has been publicly deployed.

## Current storage behavior

Account screens and Account data views for Overview, Transactions, Budgets, and Recurring payments call
the real Express API. Data & backups has separate local/account exports and
a reviewed one-time initial import into empty accounts. Local views continue
using browser storage.
Signing in does not import or upload local transactions. Server transactions are
private to their account. Signing out does not erase the local workspace. On a shared device,
the local workspace remains visible to its users; account authentication does not
protect local browser data. Account details are held in React memory, while the
session token stays in an HttpOnly cookie.

A permanent Atlas database is configured. Connectivity, transaction support, and indexes were verified; the user confirmed account records remain after restarting the backend. Automated integration fixtures still use disposable MongoDB. Google login code and client configuration are implemented. A real Google credential passed backend verification and reached the existing-account linking screen; user password proof and a completed Google-backed session remain pending.

## Next delivery

The user confirmed completion of the recovery stage. Registration email verification and signed-in security controls are explicitly deferred, not completed. Deployment preparation now provides one Node service for React/API routing, production headers, shared Atlas rate counters, an environment template, a container definition and release checks. Next choose compatible hosting, configure the public URL and verify the deployed release. See [production readiness](production-readiness.md) and [password recovery](password-recovery.md). Milestone 9 remains incomplete.



## Free-hosting choice

The user selected free hosting. Brevo HTTPS delivery, transport configuration validation, mocked provider checks and a disposable-database queue delivery scenario are implemented. Private Brevo account/sender/API-key setup and actual delivery remain pending. A free Render blueprint is prepared; it is not deployed. See free-hosting-email.md.


## GitHub preparation checkpoint

Brevo account setup is deferred at the user's request. Added a GitHub Actions workflow for release checks/container building, stronger publish exclusions and a GitHub upload guide. Gitignore behavior was checked in an isolated disposable repository: private env/log/runtime files are ignored; env templates and the workflow remain publishable. The actual project has not been initialized, committed, pushed or deployed by the agent. Remote CI and Docker validation are pending.
