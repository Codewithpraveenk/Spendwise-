# Phase 8: frontend release pass

The core frontend and this release pass are complete. The app remains editable in
VS Code at `C:\Users\Praveen\Documents\Spendwise`. No new packages were required.

## Start and verify

```powershell
npm run dev
```

Open the Local URL printed by Vite. Use the new Data & backups navigation item.

```powershell
npm test
npm run build
npm run preview
```

Use Node.js 24. The tested runtime is Node 24.13.0. On another computer, run
`npm ci` first to install the locked dependencies.

## Backup workflow

1. Download workspace backup to save all transactions, budgets, schedules, and
   payment links as JSON. This is the file used for restoration.
2. Download transaction CSV if you want to inspect all records in a spreadsheet.
   Amounts are positive rupee values with a separate income/expense type column.
   CSV does not contain budgets or schedules and cannot restore a workspace.
3. Choose a SpendWise JSON file under Restore a workspace.
4. The app validates the file before offering a preview. The selected filename,
   record counts, and missing-link notices are shown.
5. Review restore opens a confirmation comparing current and replacement counts.
6. Replace workspace imports all three collections. It replaces rather than merges.
7. Undo restore brings back the previous visible workspace until your next data
   change or refresh. To retain recovery beyond that point, download a backup first.

Backups are limited to 5 MB. Wrong formats, malformed JSON, duplicate IDs/category
plans, invalid amounts/dates, and invalid schedule links are rejected. Unknown
fields are discarded. A missing linked expense is allowed because deleted expenses
are valid app state; the preview warns that its bill will appear unpaid. File reads
show a loading state and errors without replacing existing records.

Spreadsheet text cells are quoted, embedded quotes/newlines are escaped, and
formula-like user strings are neutralized in CSV output. Raw JSON record values
are preserved so a backup round-trip does not alter your records.

## Accessibility and visual improvements

- Each route gets a descriptive browser title.
- Changing pages focuses the main content and returns to the top. Changing a
  query filter does not steal focus.
- The skip-to-content link works from the keyboard.
- Native dialogs retain their background-inert behaviour, support Escape, and
  restore focus to the opener or main content if the opener was removed.
- Buttons, selects, and non-file inputs have a minimum 44px height.
- Reduced-motion CSS disables decorative animation/transitions when requested.
- Long modal text and payment names can wrap.
- Empty overview guidance now supports genuinely empty workspaces instead of
  directing users back to sample months.
- The overview initially opens the current India month; sample records remain
  fictional starter data rather than controlling the app's current date.
- An app-level error boundary provides a reload recovery screen for unexpected
  render failures. Storage errors keep their existing retry/recovery messages.

These were targeted keyboard/layout checks, not a formal WCAG certification or
a screen-reader/device-lab audit. Cross-browser/device testing remains useful
before a public release.

## New and important files

| File | Purpose |
| --- | --- |
| `src/pages/DataPage.jsx` | Export buttons, file-reading state, preview, and restore confirmation |
| `src/services/workspaceBackup.js` | Portable backup format, validation, CSV generation, preview counts |
| `src/utils/workspaceValidation.js` | Shared workspace schema guard and known-field copying |
| `src/utils/download.js` | Local Blob download and object URL cleanup |
| `src/services/workspaceBackup.test.js` | Round-trip, invalid input, CSV, restore, and undo tests |
| `src/components/ui/AppErrorBoundary.jsx` | Unexpected render failure recovery |
| `netlify.toml` | Build/publish settings and SPA route fallback |
| `vercel.json` | Build/output settings and SPA route rewrite |

App routes/navigation, the workspace reducer/provider, notices, modal focus,
overview empty state, and global styles were updated to connect these changes.
The storage validator is shared by storage loading and backup import.

## Verification performed

- All **48 Node tests passed** on the final code.
- Final production build passed.
- Browser downloaded the full JSON backup; the downloaded file parsed correctly
  with 14 transactions, 12 budgets, and 6 schedules.
- Browser downloaded transaction CSV; its contents exactly matched the transaction
  list in the JSON backup.
- Browser rejected malformed JSON without changing workspace data.
- Valid empty backup produced a preview and replacement confirmation; cancellation
  preserved all original collections.
- Actual replacement showed zero records. Navigating to Overview displayed zero
  totals. Undo restored all original collections; they remained after refresh.
- All five pages were inspected for heading/landmark structure, page titles,
  navigation focus, and page-level overflow at 320px, 768px, and 1280px. Each had
  one main landmark and one h1, correct title/focus, and no horizontal page overflow.
  Tables and the mobile navigation intentionally scroll inside their containers.
- Keyboard checked modal Escape/return focus, background isolation, and the
  skip-to-content link. Existing form validation/workflow checks remain documented
  in earlier phases.
- No browser console warnings/errors were reported during the route/layout pass.
- Production preview loaded direct `/transactions` and `/data` routes, recovered
  an unknown URL through the app's 404 page, and loaded the lazy spending chart
  without console warnings/errors.
- Preview saved at `docs/backups-preview.png`. Original workspace data is intact.

## Release scope

Deployment files and instructions are prepared, but the app has not been published.
See [deployment instructions](deployment.md) for the exact commands and host setup.
See [backend handoff](backend-handoff.md) for the next architecture boundary.

This frontend has no backend, authentication, MongoDB, or AI service yet. Its data
is local to the browser profile/origin, with JSON backup for portability. Multiple
open tabs are not synchronized. The next implementation phase can begin backend
work when you choose to move beyond the frontend-only scope.
