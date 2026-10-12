# Smriti V1 Verification

Verified on 13 October 2026 in Asia/Kolkata.

## Automated checks

Command: `npm test`

Result:

```text
Test Files  3 passed (3)
Tests       20 passed (20)
```

Covered behavior includes:

- Missing dates and times are not guessed.
- Daily, weekly, and monthly recurrence advances correctly.
- The 8 AM India summary time is calculated correctly.
- Completed tasks receive a 15-day deletion time.
- Exact relative durations such as `in 10 minutes` are complete timing instructions.
- Meta webhook signatures and payload extraction are checked.
- Incoming message IDs are deduplicated.
- A `done` reply targets the exact reminder message.
- Completing a repeating task schedules its next occurrence.
- Deleting Smriti data does not delete Kamini memory data.

Command: `npm run build`

Result: TypeScript and the Vite production build passed.

Command: `npx convex dev --once`

Result: Smriti's schema, functions, indexes, cron jobs, and webhook deployed to the Convex development deployment without validation errors.

## Development browser check

Observed in the running browser simulator:

- `Remind me tomorrow at 5 PM to test the timezone fix`
- Reply: `Saved: Test the timezone fix — Wed, 14 Oct, 5:00 pm.`
- `Remind me tomorrow to review the meeting notes`
- Follow-up: `What time should I remind you?`
- `At 3 PM`
- Reply: `Saved: Review the meeting notes — Wed, 14 Oct, 3:00 pm.`
- `Every Monday at 10 AM remind me to review the project plan`
- Reply confirmed Monday, 19 October at 10 AM and weekly recurrence.
- `tasks` returned the pending-task list with times and classifications.

The browser check caught and fixed two problems before release:

- `tomorrow` initially used the UTC date instead of the India calendar date.
- A relative time in a multi-message follow-up initially checked only the latest message instead of the combined conversation.

## Production check

Live app: `https://outstanding-zebra-774.convex.site`

Observed in the live browser:

- `10 minutes from now`
- Reply: `Saved: verify the live Smriti deployment — Tue, 13 Oct, 1:27 am.`
- `Remind me in 1 minute to confirm scheduled delivery`
- Reply: `Saved: Confirm scheduled delivery — Tue, 13 Oct, 1:19 am.`
- At the scheduled time, Smriti displayed `Reminder: Confirm scheduled delivery` and the task changed from `scheduled` to `delivered`.

HTTP checks:

```text
root_http=200
privacy_http=200
webhook_unsigned_http=401
```

The HTTP 401 result is expected: the live Meta webhook correctly rejected a request without Meta's signature.

## Not yet verified

Real WhatsApp sending is not live because production does not yet have the Meta access token, phone-number ID, webhook secret, verification token, or approved reminder templates. The code fails closed with `meta_not_configured` when those settings are absent.

The 8 AM summary, Meta template delivery, Meta delivery receipts, reply-to-WhatsApp completion, and dedicated-number onboarding must be verified on the real WhatsApp Cloud API before calling the full WhatsApp V1 complete.
