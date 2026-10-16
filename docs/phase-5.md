# Phase 5: budgets and recurring payments

All code is saved in this project and editable in VS Code. No additional
dependencies are needed. This remains a frontend-only demo.

## Run

In the VS Code terminal, from the Spendwise folder:

```powershell
npm run dev
```

Open the Local URL printed by Vite. If it is already running, save a file or
refresh the browser to see the changes.

To run automated checks:

```powershell
npm test
npm run build
```

## What changed

The overview now includes budget progress and payments due. The Budgets and
Recurring Payments routes render complete browsing pages instead of placeholders.
Both pages use a month selector, retain selections on refresh, and handle empty
months. Recurring payments also support status filtering.

## Files and responsibilities

| File | Responsibility |
| --- | --- |
| `src/data/budgets.js` | Fictional limits for September and October; positive integer paise |
| `src/data/recurringPayments.js` | Monthly schedules, start months, transaction links, and fixed demo date |
| `src/utils/planning.js` | Pure budget and payment occurrence calculations |
| `src/components/budgets/BudgetList.jsx` | Reusable category progress, status labels, and accessible progress values |
| `src/components/recurring/PaymentList.jsx` | Reusable due dates, amounts, paid details, and status badges |
| `src/components/dashboard/PlanningOverview.jsx` | Top three categories by usage and first three unpaid bills by due date |
| `src/components/ui/MonthSelect.jsx` | Shared labelled month control with unique IDs |
| `src/hooks/useMonthQuery.js` | Validated month selection in React Router URL parameters |
| `src/pages/BudgetsPage.jsx` | Budget totals, complete category list, and unbudgeted spending notice |
| `src/pages/RecurringPaymentsPage.jsx` | Schedule totals, status filter, and payment list |
| `src/utils/planning.test.js` | Budget reconciliation, status boundaries, invalid links, and month-end tests |

`src/App.jsx` connects the new routes. `src/pages/OverviewPage.jsx` includes the
new dashboard sections. `package.json` includes the planning tests in `npm test`.

## How budget progress works

1. The selected month filters the category plans and expense records.
2. Expenses are grouped by category using the existing spending calculations.
3. Each category compares spent paise against its limit.
4. The UI formats the results as INR only at display time.

Statuses: below 80% is within budget; 80% through below 100% is near limit;
exactly 100% is at limit; above 100% is over budget. Bars stop at their container
edge, while text and accessibility descriptions retain the true usage percentage.

The overall remaining amount does not hide overspending in individual categories.
Expenses in categories without limits appear separately and are excluded from
planned-category totals. Income never counts toward spending.

## How recurring payments work

Schedules define a positive paise amount and a due day from 1 through 31. Each
selected month gets one occurrence per active schedule. A due day beyond the end
of a month uses that month's final day, including leap-year February.

The fixed demo reference date is **16 October 2026**, visibly labelled in the UI.
Unpaid dates before it are overdue, dates matching it are due today, and later
dates are upcoming. A valid linked expense on or before that reference date marks
the occurrence paid. Missing, income, wrong-month, and future links do not.

Paid links refer to the original transaction IDs. Calculating occurrences never
creates transactions or increases dashboard expense totals. Scheduled amounts
describe expected bills; the transaction list describes recorded expenses.

All lists are read-only in this phase. There is no payment processing, reminder
service, backend, or local persistence. Add/edit forms and payment recording are
the next functional phase. Loading and network errors are not simulated for
synchronous local data.

## Checks to try

- October budgets: planned INR 10,000.00; spent INR 9,038.00; remaining INR 962.00.
- Education: INR 1,250.00 of INR 1,000.00; 125% used; INR 250.00 over.
- September: overall remaining -INR 6,100.00.
- August: no plan and no scheduled payments; use the recovery controls.
- October payments: scheduled INR 7,206.00; unpaid INR 1,348.00; overdue INR 700.00.
- Campus gym is overdue, Cloud storage is due today, Wi-Fi share is upcoming.
- Filter to Due today: only Cloud storage appears. Summary cards still show full-month totals.
- Refresh: month and status filters remain selected.
- Use the dashboard View budgets / View payments links to carry its selected month.
- Edit a sample limit or schedule in VS Code and save to inspect the result.

## Verification performed

- All 14 Node tests passed.
- Production build passed.
- Browser checked October budget totals, overspending labels, August empty state,
  and the View October plan action.
- Browser checked recurring statuses, Due today filter, refresh persistence,
  empty month, Show all statuses action, and dashboard payment link.
- Dashboard and recurring page were checked at 390px with no page-level horizontal
  overflow. Desktop payment schedule was visually inspected at 1280px.
- Preview saved at `docs/payments-preview.png`.
