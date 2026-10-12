# Smriti V1 Scope

## The first user

Mayur uses WhatsApp to capture work tasks with a date and time, then copies important but not urgent tasks into Google Sheets so they are not forgotten.

## The job

Send Smriti one English or Hinglish WhatsApp message and have the task safely tracked, classified, and followed up until it is completed.

## Core flow

1. Mayur sends a work task to Smriti's dedicated WhatsApp number.
2. Smriti extracts the task, date, time, repeat rule, urgency, and importance.
3. If the date or time is missing, Smriti asks one short follow-up question before saving.
4. Smriti confirms with a short reply such as `Saved: Submit report — Friday, 4 PM`.
5. Smriti sends the task reminder when due.
6. If the task remains open, it appears in the 8:00 AM India-time summary once per day.
7. Mayur completes a task by replying `done` to that task's WhatsApp reminder.

## V1 actions

- Create one-time tasks.
- Create repeating tasks.
- List pending tasks.
- Change a task.
- Cancel a task.
- Complete a task by replying to its reminder.
- Automatically classify tasks as urgent or not urgent and important or not important.
- Allow the classification to be corrected in chat.
- Send one 8:00 AM Asia/Kolkata summary of pending and overdue tasks.
- Avoid a separate overdue follow-up on a day when the morning summary includes the task.
- Keep completed tasks for 15 days, then delete them automatically.
- Delete all user data only after an explicit confirmation.

## Messaging rules

- Text only in V1.
- English and Hinglish are supported.
- Normal reminder hours are 8:00 AM to 9:00 PM India time.
- An explicitly requested time outside normal hours is honored.
- Missing dates or times are never guessed.
- Every saved task gets a short confirmation showing the interpreted task and time.

## V1 exclusions

- Voice notes.
- Images and files.
- Google Calendar.
- Google Sheets.
- A user dashboard.
- Payments.
- Friend-to-friend reminders.
- Telegram and email.

## Rollout

1. Mayur tests Smriti first.
2. Two family members test next.
3. Five friends test after the private family test.

## Technical boundaries

- WhatsApp is the product interface through Meta's official WhatsApp Cloud API.
- Convex owns the database, backend functions, scheduling, authentication, webhook, and static website hosting.
- Sarvam converts English and Hinglish messages into validated structured task instructions.
- No other hosting, database, authentication, queue, or scheduling service is added.
- The existing Kamini data remains untouched while Smriti is built and tested.

## Main risks

- Meta may delay or reject outbound reminder templates.
- The AI may misunderstand a date, time, repeat rule, or classification.
- A webhook may be delivered more than once.
- A reminder may fail to send.
- Messaging a separate WhatsApp number may not become a natural habit.

Smriti must show the interpreted date and time, reject incomplete instructions, deduplicate incoming messages, record delivery results, and be tested as a real WhatsApp conversation before V1 is called complete.
