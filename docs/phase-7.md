# Phase 7: editable budgets and recurring payment recording

The budget and recurring-payment screens now support real frontend state changes.
All three collections—transactions, budgets, and schedules—save together in one
versioned browser workspace. There are no new dependencies.

## Run in VS Code

Open `C:\Users\Praveen\Documents\Spendwise`, then Terminal → New Terminal:

```powershell
npm run dev
```

Open the Local URL printed by Vite. If the server is already running, refresh.

```powershell
npm test
npm run build
```

## Try it step by step

### Budgets

1. Open Budgets and choose a month using the month picker.
2. Select Add category budget, choose an expense category, and enter a limit.
3. Save. Category progress and the dashboard use the new limit immediately.
4. Select Edit limit to change an existing plan.
5. Refresh to confirm the change is stored.
6. Remove a category only when you want its expenses treated as unbudgeted.
   The confirmation explains that recorded expenses are kept.

A category has one limit per month. Duplicate plans, zero/negative limits,
excess decimal places, and invalid months are rejected. New months do not need
sample records: the native month picker supports January 2000–December 2100.

### Recurring payments

1. Open Recurring Payments and select Add monthly schedule.
2. Enter a name, expense category, amount, due day, and starting month.
3. Optionally set a final month. It is inclusive; later months have no occurrences.
4. Save. This creates a schedule, not an expense.
5. On an unpaid bill, select Record payment and choose the actual payment date.
6. Record expense. One expense is added and linked to this bill occurrence.
7. Follow Review linked expense to see that exact record in Transactions.
8. Refresh: both the paid status and the expense remain.

Manage monthly schedules includes schedules outside the selected month. You can
edit them there or remove them after confirmation. Setting a final month preserves
the schedule's history; removing the schedule removes its tracking history but
keeps all recorded expenses.

This action records a payment you made elsewhere. It does not transfer money.
It records the full scheduled amount; partial payments and instalments are not
supported in this phase.

## Important behaviour

- Statuses use the current date in **Asia/Kolkata**, rather than a fixed demo date.
  The date refreshes on window focus, visibility changes, and a minute timer.
- A late payment settles its original bill month, while its expense belongs to
  the actual payment month. Early payments work the same way.
- Due days 29–31 fall on the final day of a shorter month.
- Recording a payment stores its new expense and occurrence link in one reducer
  transition and one localStorage value. Duplicate submissions are rejected.
- A linked record that was changed into income or dated in the future is flagged
  for review. The app does not silently create another expense beside it.
- Deleting a linked expense reopens the bill. Undo restores the original record
  and paid status. If you re-record a deleted payment, its old deletion undo is
  cleared to prevent a duplicate restoration.
- Editing schedule names, expected amounts, or due days updates the definition
  across its active months. Already recorded expense amounts and dates remain
  unchanged; the list shows both scheduled and actual paid amounts.
- You cannot shorten a schedule's date range to exclude a month with a linked
  payment. This preserves the schedule's linked history.
- Category budget deletion never deletes transactions. Schedule deletion also
  leaves the transaction ledger intact. These removals require an app confirmation
  and have no automatic undo; transaction deletion still has its existing undo.

## Storage migration

The new key is `spendwise.workspace.v2`. Its envelope contains:

```text
version: 2
transactions: [...]
budgets: [...]
recurringPayments: [...]
```

When this key is absent, the app reads `spendwise.transactions.v1` and carries
forward its transaction list, including deliberate empty lists and user edits.
It adds the original category plans and schedules, then saves the new workspace.
The legacy key is retained. Once v2 exists it is authoritative; changes to the
old key or seed files do not replace the current workspace.

Corrupt or unavailable storage produces a visible warning without automatically
overwriting existing data. A write failure leaves changes in memory and offers
Retry saving. Normal Restore sample data replaces transactions only, preserving
your current budgets and schedules. Recovery from unreadable storage instead
requires an explicit full sample-workspace replacement confirmation.

Storage remains local to one browser profile and origin. There is no account or
cloud sync, and concurrent tabs are not synchronized. Backend/API persistence
remains a separate future phase.

## Architecture and exact files

| File | Responsibility |
| --- | --- |
| `src/state/TransactionsContext.jsx` | Shared workspace and validated public actions; retains its original hook name for existing screens |
| `src/state/workspaceReducer.js` | Atomic budget/schedule changes and payment-to-expense linking; delegates ordinary transaction actions |
| `src/services/workspaceStorage.js` | Versioned storage, schema checks, legacy migration, one-envelope writes |
| `src/services/transactionStorage.js` | Legacy transaction adapter, kept for migration |
| `src/utils/planningValidation.js` | Month, budget, schedule, date-range, and duplicate-link validation |
| `src/hooks/useToday.js` | Current India date and date-change refresh |
| `src/components/budgets/BudgetForm.jsx` | Accessible add/edit budget form with field errors |
| `src/components/recurring/ScheduleForm.jsx` | Monthly schedule form with final-month support |
| `src/components/recurring/RecordPaymentForm.jsx` | Explains the new expense and captures date paid |
| `src/components/ui/FormField.jsx` | Shared field layout and form styles |
| `src/components/ui/MonthSelect.jsx` | Native month picker supporting months without existing records |
| `src/hooks/useMonthQuery.js` | Validated month URL state, independent of sample months |

BudgetList, PaymentList, BudgetsPage, RecurringPaymentsPage, and PlanningOverview
now use shared workspace actions/data. Payment review links use an exact
transaction ID filter in TransactionsPage; renaming a schedule cannot break the
link. The overview shares the new month picker and month-label formatter.

New tests are in:

- `src/state/workspaceReducer.test.js`
- `src/services/workspaceStorage.test.js`
- `src/utils/planningValidation.test.js`

## Verification performed

- All **41 tests passed**, including migration, budget duplicates, preservation of
  links/history, early/late payments, repeated submissions, re-record/undo safety,
  malformed storage, and existing financial calculations.
- Production build passed.
- Browser: original 14 transactions remained after migration.
- Browser: duplicate Food budget was rejected; a temporary Health budget was
  created, edited, and verified after refresh.
- Browser: invalid due day 32 was rejected; a temporary schedule was created.
- Browser: recording its INR 120.50 payment created one expense, marked it paid,
  removed its Record payment button, and survived refresh.
- Browser: the exact expense link returned one matching transaction.
- Browser: dashboard expense total changed to INR 9,158.50; the temporary Health
  budget showed INR 120.50 spent.
- Browser: editing the expected schedule amount to INR 130.50 retained the
  original INR 120.50 expense and its link.
- Browser: month-picker keyboard navigation opened November, showing upcoming
  payments even though November had no sample transactions.
- Browser: schedule form was inspected at 390px without horizontal overflow.
- Temporary test expense, budget, and schedule were removed through the UI.
  Original records and the original plans/schedules remain.
- Preview saved at `docs/record-payment-preview.png`; the Cloud storage payment
  used for that screenshot was cancelled and was not recorded.

## Next phase

The core frontend workflows are now implemented. Next is frontend release polish:
cross-screen accessibility and responsive review, a data backup/export and restore
workflow, and a clear deployment/backend handoff. No backend or AI is built yet.
