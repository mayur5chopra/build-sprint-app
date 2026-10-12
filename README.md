# Smriti

Smriti is a private-first WhatsApp task assistant for English and Hinglish work reminders. Send one message with a task, date, and time; Smriti tracks it, classifies it, reminds you, and keeps it in the 8 AM summary until it is done.

The approved first-version scope is in [IDEA_SCOPE.md](./IDEA_SCOPE.md).

## Current status

- The browser simulator works with Convex development data.
- One-time and daily, weekly, or monthly repeating tasks are supported.
- Missing dates or times produce one follow-up question instead of a guess.
- Tasks are classified by urgency and importance.
- Convex schedules task reminders and the 8 AM India-time summary.
- Reply-to-message handling identifies the exact task for `done`, `cancel`, rescheduling, or classification changes.
- Completed tasks are deleted after 15 days.
- `delete my data` requires confirmation before Smriti data is removed.
- The Meta webhook verifies its signature, deduplicates incoming messages, and records delivery updates.
- Real WhatsApp sending requires the dedicated Meta number, production token, and approved templates listed below.

Kamini's older tables and code remain in the repository so its existing chats and memories are not deleted by the Smriti build.

## Stack

- Meta WhatsApp Cloud API for the user interface
- Convex for the database, functions, scheduling, webhook, authentication, and static hosting
- Sarvam for structured English and Hinglish task extraction
- React and Vite for the private browser simulator and privacy page
- GitHub for source control

No separate host, database, login service, or scheduler is used.

## Run locally

Install packages:

```bash
npm install
```

Connect the Convex development deployment:

```bash
npx convex dev
```

Start the browser simulator in a second Terminal window:

```bash
npm run dev
```

Never add secrets to source files or commit `.env.local`.

## Required Convex environment variables

Sarvam task extraction:

- `SARVAM_API_KEY`

Meta webhook verification and signing:

- `META_WEBHOOK_VERIFY_TOKEN`
- `META_APP_SECRET`

Meta message sending:

- `META_ACCESS_TOKEN`
- `META_PHONE_NUMBER_ID`
- `META_TASK_REMINDER_TEMPLATE`
- `META_DAILY_SUMMARY_TEMPLATE`
- `META_TEMPLATE_LANGUAGE` (normally `en`)
- `META_GRAPH_API_VERSION` (optional so Meta's version can be changed without editing code)

Store values through `npx convex env set VARIABLE_NAME`; do not put the value directly in a saved command or document.

## Meta configuration

Use this callback after deploying:

```text
https://YOUR-CONVEX-SITE.convex.site/webhooks/meta
```

Subscribe the WhatsApp account to message and message-status webhooks. Create and approve these utility templates before live reminder testing:

- `smriti_task_due` with two body variables: task title and due time
- `smriti_daily_summary` with one body variable: pending-task summary

The privacy policy is available at `/privacy` on the deployed site.

## Verification

Run the automated behavior checks:

```bash
npm test
```

Run TypeScript and the production frontend build:

```bash
npm run build
```

Push backend functions to the connected development deployment:

```bash
npx convex dev --once
```

Deploy the backend and static website together:

```bash
npm run deploy
```

A GitHub push does not deploy the Convex site.

## Project map

- `src/ReminderDemoApp.tsx` — private browser simulator for the Smriti conversation
- `src/PrivacyPage.tsx` — public privacy policy required for the WhatsApp setup
- `convex/smriti.ts` — task conversation, completion, edits, deletion, and simulator actions
- `convex/smritiAi.ts` — structured Sarvam task extraction
- `convex/smritiWorker.ts` — scheduled reminder delivery and retries
- `convex/smritiDaily.ts` — 8 AM summary and 15-day cleanup
- `convex/smritiDeliveryAdapter.ts` — Meta Cloud API sender
- `convex/metaWebhook.ts` — verified incoming Meta webhook
- `shared/smritiRules.ts` — date, repetition, summary, and retention rules
- `tests/smriti-rules.test.ts` — pure scheduling-rule checks
- `tests/smriti-backend.test.ts` — database isolation, completion, recurrence, and deletion checks

## License

ISC
