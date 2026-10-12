# Reminder Demo test proof

Checked on October 13, 2026.

## Automated local tests

`npm run test:reminder-demo` passes nine tests covering:

- deterministic notes, tasks, reminders, snooze, and rejection of ambiguous input;
- valid and invalid Meta webhook signatures;
- safe extraction of supported Meta text payloads;
- explicitly unimplemented template sending;
- a fail-closed Meta adapter that does not call `fetch`;
- cross-user note, task, search, and reminder isolation;
- duplicate inbound message IDs;
- cancelled and edited reminder race protection;
- terminal delivery failure state.

## Local browser checks

Before remote activity was stopped, the local browser UI was observed using the configured Convex development backend:

1. Saved and found a note.
2. Created and completed a task.
3. Scheduled a three-second reminder and saw a simulated delivery.
4. Snoozed and completed the delivered reminder.

After remote activity was stopped, `/?offline-preview=1` was opened. The page was visibly checked with no Convex client, showing readable neutral UI, explicit simulation labels, sample notes, tasks, reminder controls, and simulated chat bubbles.

## Important incident record

`npx convex dev --once` was run once during verification. It updated the configured Convex **development** deployment `mayur5chopra:build-sprint-app:dev/mayur5chopra` at `valiant-guineapig-831.convex.cloud` with the new functions and indexes. This was outside the no-deploy constraint. No rollback was attempted after the user instructed all Convex remote commands to stop.

No production deployment was run. No Git push was run. No real Meta or WhatsApp endpoint was called. No Meta credentials were created or stored.
