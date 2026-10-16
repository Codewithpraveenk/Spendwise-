# Phase 6: transaction management and browser persistence

SpendWise now has working transaction management. Fictional records are only the
initial seed; additions and edits become the transaction data used by every screen.
This is the frontend implementation of the app. Account storage, authentication,
and a deployed backend are still future phases.

## Run in VS Code

Open `C:\Users\Praveen\Documents\Spendwise`, then Terminal → New Terminal:

```powershell
npm run dev
```

Open Vite's Local URL and go to Transactions. No new dependencies are required.

```powershell
npm test
npm run build
```

## What you can do

1. Add an income or expense with a description, amount, date, and category.
2. Edit a row using its Edit button. Its stable ID is retained.
3. Delete a row and use Undo deletion to restore the exact record.
4. Refresh and keep the saved changes.
5. Review updated dashboard totals, category charts, recent records, and budgets.
6. Restore the original sample records through an explicit confirmation dialog.

After saving, the table selects the saved record's month and clears other filters
so an old search does not hide the change. Month selectors include months present
in your records as well as the original sample months. The dashboard initially
opens October 2026 to keep the original sample experience reproducible.

## Architecture and files

```text
TransactionForm
    → validation and exact paise parsing
    → TransactionsProvider actions
    → transactionReducer
    → all consuming pages recalculate their views
    → transactionStorage adapter writes the versioned browser record
```

| File | Responsibility |
| --- | --- |
| `src/state/TransactionsContext.jsx` | Owns shared transactions, actions, persistence status, notices, and available months |
| `src/state/transactionReducer.js` | Immutable add, update, delete, undo, and sample restoration |
| `src/services/transactionStorage.js` | Reads and writes versioned local storage; validates restored data |
| `src/utils/transactionValidation.js` | Amount parsing, calendar checks, form validation, and stored-record validation |
| `src/data/categories.js` | Central income/expense categories shared by forms and filters |
| `src/components/ui/Modal.jsx` | Native modal dialog, accessible name/description, Escape handling, and focus restoration |
| `src/components/transactions/TransactionForm.jsx` | Add/edit fields, linked field errors, and submission |
| `src/components/transactions/RestoreSamplesDialog.jsx` | Explains replacement and requests confirmation inside the app |
| `src/components/layout/WorkspaceNotice.jsx` | Save failures, action feedback, and deletion undo |

The main entry now wraps the app in TransactionsProvider. Overview, Transactions,
Budgets, and Recurring Payments read the same context rather than importing a
fixed transaction array. The shared table gains optional Edit/Delete actions;
the recent-transactions version stays compact and read-only.

Budget limits and recurring schedules still come from their existing sample
files. They recalculate against live transaction state, but their own edit forms
are a later phase. Deleting an expense linked to a recurring payment makes that
occurrence unpaid; undo restores the link. A newly added matching expense is not
automatically linked to a schedule: explicit payment recording comes later.

## Validation and accessibility

- Descriptions: 1–100 characters after trimming.
- Amounts: INR 0.01–1,00,00,000, with at most two decimal places. Enter numbers
  without grouping commas. Decimal strings become integer paise without rounding.
- Dates: real calendar dates from 1 January 2000 through today's date in India.
- Categories: must match the selected income/expense type.
- All fields are labelled. Errors are associated with their fields, announced,
  and the first invalid field receives focus.
- The native dialog keeps keyboard focus inside while open. Escape or Cancel
  discards unsaved form changes and returns focus to the opening control when it
  still exists.
- Deletion undo is for the most recent deletion and lasts until refresh, a newer
  deletion, or restoring samples. Deletions themselves are saved immediately.

## Storage behaviour

The storage key is `spendwise.transactions.v1`; its value includes a version and
the transaction list. Valid empty lists stay empty after refresh instead of
silently refilling with sample records. Stored records have schema and duplicate-ID
checks. This workspace caps records at 10,000.

If saved data cannot be read, the UI shows seed records in memory, warns you,
and leaves the unreadable storage untouched. Restore sample data is the explicit
recovery action. A write failure shows Not saved and a Retry saving button.
The storage failure cases are covered by unit tests; browser tests used normal
working storage.

Browser storage is specific to a browser profile and origin, including port.
Opening the app at localhost rather than 127.0.0.1, or another port, uses separate
storage. Clearing browser data removes it. There is no cloud or device sync;
this phase is intended for one active browser tab. Two independent tabs are not
synchronized and later writes can replace earlier ones.

The seed file is now used only when no stored records exist or after restoring
samples. Editing `src/data/transactions.js` in VS Code does not overwrite an
existing saved workspace; use Restore sample data if you intentionally want the
updated seed to replace local changes.

The storage module is separated from the UI to prepare for an Express/MongoDB
repository. Backend work will add asynchronous API requests, authentication,
server validation, and request/error handling at the state/repository boundary.
These are not implemented yet.

## Verification performed

- All 25 tests passed, including reducer transitions, validation, exact paise
  parsing, storage round-trips, invalid data, blocked storage, and existing finance
  calculations.
- Production build passed.
- Browser: submitting blank fields showed errors and focused Description.
- Browser: added a temporary INR 125.50 food expense, edited it to INR 200.25,
  refreshed, and confirmed the saved row remained.
- Browser: dashboard expense became INR 9,238.25; Food budget spending became
  INR 1,530.25, both derived from the edited record.
- Browser: deleting and undoing restored the exact temporary record. Changing
  its type selected a valid income category.
- Browser: restore-sample confirmation opened and cancellation kept the data.
- Browser: native date control responded to keyboard changes; Escape dismissed
  the form and restored focus.
- Browser: 390px form had no internal horizontal overflow; desktop form inspected
  at 1280px. Preview saved at `docs/transaction-form-preview.png`.
- The temporary verification record was deleted and the page refreshed. Original
  records were preserved.

## Next phase

Add budget editing and recurring-payment recording using the shared state/storage
pattern, then complete final accessibility and responsive checks. Backend and AI
remain separate future phases.
