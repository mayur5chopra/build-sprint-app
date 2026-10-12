# Reminder Demo

Reminder Demo is a neutral, multi-user prototype for notes, tasks, and reminders. Its main screen looks like a WhatsApp conversation, but the current build does not connect to WhatsApp or send real messages.

## Implemented

- Existing Convex email/password authentication.
- Per-user notes with full-text search.
- Per-user tasks with listing and completion.
- Per-user reminders with scheduling, editing, snoozing, cancellation, completion, and recorded delivery state.
- Deterministic chat commands with no AI dependency.
- Inbound message-ID deduplication.
- Server-side ownership checks on every new public read and write.
- Reminder version checks that skip stale work after edits, snoozes, cancellations, or completion.
- Meta webhook signature verification in a standalone tested helper.
- A development-only offline visual preview at `/?offline-preview=1` that does not create a Convex client.

## Simulated or disabled

- Browser messages use generated simulator message IDs.
- Simulated reminder deliveries are written back into the browser conversation.
- The Meta delivery adapter has no network call and always returns `demo_network_disabled`.
- WhatsApp template sending is explicitly unimplemented.
- Unknown WhatsApp users are not attached to any Convex account.
- Hermes, QR login, and Baileys are not used.

## Supported chat commands

```text
note: passport is in the blue drawer
notes
find notes passport
task: buy milk
tasks
complete task 1
remind me in 10 minutes to call Mum
reminders
snooze reminder 1 for 5 minutes
complete reminder 1
cancel reminder 1
help
```

Ambiguous reminder dates are rejected rather than guessed. Relative seconds are supported for fast local demonstrations.

## Local checks

```bash
npm run test:reminder-demo
npm run test:memory
npm run build
npx tsc --noEmit -p convex/tsconfig.json
```

Do not use `npm run deploy` for this demo without a separate release decision.

## Development deployment handoff

One `npx convex dev --once` command previously synchronized the new Reminder Demo functions and indexes to the configured Convex **development** deployment `mayur5chopra:build-sprint-app:dev/mayur5chopra` at `valiant-guineapig-831.convex.cloud`. It did not update production and did not push Git.

Mayur explicitly decided on October 13, 2026 to retain that development update. Do not roll it back. This is not permission to run another remote Convex command, deploy, change credentials, or contact Meta or WhatsApp.

The retained development deployment has not been remotely rechecked. Production behavior, real Meta webhook traffic, real WhatsApp delivery, template delivery, commercial eligibility, India pricing, and compliance remain unverified.
