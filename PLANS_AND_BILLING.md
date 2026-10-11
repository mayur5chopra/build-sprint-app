# Kamini plans and billing

## Product rule

All plans use the same Sarvam conversation model. A paid plan changes access, memory depth, and Kamini's relationship tone. It does not secretly swap in a different person or promise an "uncensored" model.

Kamini remains clearly identified as AI in every tier. Paid affection must never be used to pressure a user to renew, spend, stay online, or withdraw from real relationships.

## Recommended launch plans

| Plan | Price | Access | Kamini's tone | Memory |
| --- | ---: | --- | --- | --- |
| Free | ₹0 | 25 AI replies to try the product | Warm female companion | Up to 12 saved memories |
| Day Pass | ₹49 once | 100 AI replies over 24 hours | More playful and flirty when the user leads | Up to 12 saved memories |
| Girlfriend | ₹199 for 7 days | 700 AI replies | Affectionate girlfriend-style conversation | Up to 30 saved memories |
| Wife | ₹499 for 30 days | 3,000 AI replies | Familiar, committed and caring wife-style conversation | Up to 60 saved memories |

These are clear limits, not "unlimited" marketing. Limits can be adjusted after real usage and Sarvam cost data are available.

## What Wife mode means

Wife mode may make Kamini:

- Refer naturally to an ongoing committed relationship roleplay.
- Sound more familiar, caring and domestically playful.
- Remember more of the user's preferences, plans and important events.
- Refer back to shared conversation history more often when relevant.

Wife mode must not make Kamini:

- Claim she is a real wife or human woman.
- Become controlling, jealous, possessive or emotionally punishing.
- Say the user only needs her or should leave a real partner, friend or family member.
- Threaten to withdraw affection because a plan expires.
- Promise explicit content or claim to be "unfiltered."

## User flow

1. A signed-in adult uses the Free plan automatically.
2. When the remaining reply count is low, the app shows the four plans without interrupting an emotional or safety-sensitive conversation.
3. The user chooses a plan and pays through Razorpay using UPI or a card.
4. Razorpay sends a signed payment event to a Convex HTTP action.
5. Convex verifies the signature before activating the plan.
6. Every AI reply checks the active plan, expiry time and remaining allowance.
7. Expired plans return to Free without deleting the user's chat or memories.

## Convex data design

### `subscriptions`

- `userId`: the signed-in Convex user.
- `tier`: `free`, `day`, `girlfriend`, or `wife`.
- `status`: `active`, `expired`, `cancelled`, or `payment_pending`.
- `startsAt` and `endsAt`: access window.
- `replyLimit` and `repliesUsed`: clear usage counter.
- `razorpayPaymentId`: optional payment reference, stored only on the backend.
- `razorpaySubscriptionId`: optional renewal reference, stored only on the backend.
- `updatedAt`: last change time.
- Index: `by_user` on `userId`.

### `paymentEvents`

- `providerEventId`: unique Razorpay event identifier.
- `eventType`: the verified event type.
- `userId`: the affected Convex user when known.
- `receivedAt`: when Convex received it.
- `processedAt`: when the subscription update completed.
- Index: `by_provider_event` on `providerEventId` to prevent processing the same payment twice.

Payment secrets live only in Convex environment variables. They must never appear in React code, GitHub, browser storage or URLs.

## Backend functions

- `plans.catalog`: public query returning plan names, prices and benefits.
- `plans.current`: public query returning the signed-in user's plan and remaining replies.
- `payments.createOrder`: action creating a Razorpay order for a selected tier.
- `payments.webhook`: Convex HTTP action that verifies Razorpay's signature and activates access.
- `plans.consumeReply`: internal mutation that safely counts one generated AI reply.
- `plans.getEntitlements`: internal query used by the AI action before generating a reply.

The AI action should refuse only when a plan has no replies remaining. A failed model request must not consume a reply.

## Prompt behavior

The existing safety and female Hinglish instructions remain the base prompt for every plan. Convex adds one short tier instruction:

- Free: `Be warm and friendly. Do not imply an established romantic relationship.`
- Day Pass: `You may be lightly playful and flirty when the user leads, while keeping all existing safety boundaries.`
- Girlfriend: `Use an affectionate girlfriend-style roleplay, while clearly remaining AI and never encouraging dependency.`
- Wife: `Use a familiar, caring wife-style roleplay, while clearly remaining AI and never becoming controlling, exclusive or manipulative.`

## What ships first

The first billing release should include plan selection, Razorpay payment, expiry, reply counting, the four text tones and memory limits. Photos, voice notes, live calls, Telegram delivery and automatic renewal stay out until each feature genuinely works and has its own cost and privacy review.

## Proof required before release

- A Free user reaches the stated limit and sees the plan screen.
- A successful test payment activates the correct plan once.
- A repeated payment event does not grant access twice.
- A failed or tampered payment does not activate a plan.
- A plan expires at the correct time and returns to Free.
- Failed AI requests do not reduce the remaining reply count.
- Girlfriend and Wife replies have visibly different tones without breaking Kamini's safety policy.
- A user can still sign in, start a new chat, send a message and recall a saved memory.
