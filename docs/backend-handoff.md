# Future backend handoff

This document records the frontend handoff and proposed API contract. The
[Express foundation](backend-step-1.md) is now implemented in server/.
Database, authentication, financial endpoints, AI, and frontend API integration
remain future work.

## Existing frontend layers

Pages and reusable components consume `useTransactions()` from
`src/state/TransactionsContext.jsx`. Its historical name is retained, but the
provider now owns the full workspace: transactions, category budgets, and monthly
schedules. `workspaceReducer.js` applies state transitions. `workspaceStorage.js`
is the local persistence adapter. `workspaceBackup.js` handles portable exports.

The frontend uses a version-2 workspace with these collections:

| Collection | Core fields |
| --- | --- |
| Transactions | id, description, date, type, category, amountPaise |
| Budgets | id, month, category, limitPaise |
| Recurring schedules | id, name, category, amountPaise, dueDay, startMonth, optional endMonth, paidTransactions |

Amounts are positive integer paise. A transaction's type determines income versus
expense. Dates are `YYYY-MM-DD`; months are `YYYY-MM`. Payment-date expenses can
settle bills from another month. Schedule links identify the actual transaction.
Do not infer settlement by matching names or amounts.

## Suggested implementation order

1. Build Express validation and MongoDB models that enforce the current field
   constraints and category rules. Add authenticated ownership to every record.
2. Implement transaction read/add/edit/delete, then budgets and schedules.
3. Add an atomic payment-recording operation that writes its expense and bill
   link together and rejects repeated requests for the same schedule/month.
4. Add a repository alongside the local adapter. Keep network state at the
   provider/repository boundary so existing presentation components remain useful.
5. Make action handlers asynchronous and update forms to await saves, prevent
   duplicate submissions, display request failures, and handle retries.
6. Add explicit local-data import into the signed-in account, with ID mapping
   that preserves budget relationships and payment links. Never silently replace
   an existing account workspace with sample data.

## Proposed API responsibilities

These names are proposals, not endpoints currently available:

- `/api/transactions`: list/filter records and create a transaction.
- `/api/transactions/:id`: update or remove an owned record.
- `/api/budgets`: list and save one limit per user/month/category.
- `/api/recurring`: list and maintain owned monthly schedules.
- `/api/recurring/:id/payments`: record one occurrence using a bill month,
  actual payment date, and idempotency key. Resolve scheduled amount and category
  on the server instead of trusting submitted client values.

Server validation and ownership checks must be independent of frontend checks.
Repeated payment submissions and concurrent changes need database-enforced rules;
the current browser guards only cover the local single-tab workflow.

## Current limits to carry forward explicitly

The app currently records a full scheduled amount, with no partial-payment model.
Schedule-definition edits apply across its active months while existing expenses
stay unchanged. Browser storage has no account/cloud or concurrent-tab sync.
Delete undo and restore undo are session-only. Backups contain plain JSON data.

The Python categorization/anomaly service should be a later, separate integration,
after account storage and server-side validation work reliably.
