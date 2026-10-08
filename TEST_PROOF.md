# V1 test proof

Tested on October 8, 2026.

## Automated memory test

Command:

```text
npm run test:memory
```

Raw output:

```json
{
  "session1": {
    "user": "kal meri presentation hai",
    "savedMemory": {
      "kind": "event",
      "note": "kal: presentation"
    }
  },
  "session2": {
    "companion": "Kal wali presentation ke liye tayyari kaisi chal rahi hai?"
  }
}
```

## Browser test

Verified in Chrome against the local app and the connected Convex development deployment:

1. Signed in with a disposable test account.
2. Confirmed the 18+ gate and the clear AI disclosure.
3. Started session 1 and sent `kal meri presentation hai`.
4. Started session 2.
5. Saw the companion ask: `Kal wali presentation ke liye tayyari kaisi chal rahi hai?`

## AI connection status

The Convex AI gateway returned `AiGatewayDisabled` because this team is not on a paid Convex plan. The app handles this without losing the user's message or memory and clearly reports that live AI replies need the gateway or a provider key. The memory feature and session follow-up work now; live model-generated replies require one of those two connections.

## Seven-day AI cost estimate

Model planned: `gpt-5.6-luna`.

- 50 user messages per day for 7 days = 350 model replies.
- Estimate per reply: 500 input tokens and 80 output tokens. The app limits conversation context to the latest 12 messages.
- Weekly input: 175,000 tokens × $0.20 per 1M = $0.035.
- Weekly output: 28,000 tokens × $1.20 per 1M = $0.0336.
- Estimated total: **$0.0686, or about $0.07 per user per week**.
- Practical range: **$0.04–$0.12**, depending on message length and reply length.

This is the OpenAI model cost only. It does not include any Convex plan cost.

Official pricing source: https://developers.openai.com/api/docs/models/gpt-5.6-luna
