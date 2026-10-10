# Kamini

Kamini is a female Hinglish AI companion for adult Indian men. She listens, remembers useful details, and continues the conversation across sessions while clearly identifying herself as AI.

**Live app:** [outstanding-zebra-774.convex.site](https://outstanding-zebra-774.convex.site)

> Kamini is a female AI companion, not a real person, therapist, or emergency service. The app is for adults aged 18 and older.

## What works

- Email and password sign-up and sign-in
- An 18+ confirmation gate
- Short, natural Hinglish replies from Sarvam AI
- Consistent feminine Hindi and Hinglish self-references
- Saved chat sessions and messages
- Memory for names, events, and likes
- Memory recall when a new session begins
- Clear AI disclosure and safety boundaries
- Frontend, backend, database, authentication, and hosting on Convex

The live model is `sarvam-105b-conversations`, which is designed for natural multi-turn conversation and Indian languages.

## Try the main flow

1. Open the [live app](https://outstanding-zebra-774.convex.site).
2. Create an account with an email and a password of at least eight characters.
3. Confirm that you are 18 or older.
4. Tell Kamini something worth remembering, such as `kal meri presentation hai`.
5. Start a new session and see whether Kamini follows up on it.

Use test information when trying the public demo. Do not enter passwords, bank details, government identification, intimate images, or information you would not want stored.

## Run it locally

Requirements:

- Node.js and npm
- A Convex account
- A Sarvam AI API key with available credits

Install the packages:

```bash
npm install
```

Connect the project to a Convex development deployment:

```bash
npx convex dev
```

Keep that command running. Open a second Terminal window for the remaining local commands.

Store the Sarvam key securely in Convex. The command asks for the value without requiring it in the command itself:

```bash
npx convex env set SARVAM_API_KEY
```

Start the frontend:

```bash
npm run dev
```

Do not add API keys to source files or commit `.env.local`. That file is already ignored by Git.

## Check the app

Run the memory proof:

```bash
npm run test:memory
```

Run the production build and TypeScript checks:

```bash
npm run build
npx tsc --noEmit -p convex/tsconfig.json
```

The latest manual and automated evidence is recorded in [TEST_PROOF.md](./TEST_PROOF.md).

## Deploy

First, store the Sarvam key in the Convex production environment:

```bash
npx convex env set SARVAM_API_KEY --prod
```

Then deploy the backend and static frontend together:

```bash
npm run deploy
```

A GitHub push does not deploy the app automatically.

## Project map

- `src/App.tsx` — sign-in, adult confirmation, chat, and memory notices
- `src/styles.css` — interface styling
- `convex/ai.ts` — Kamini instructions and Sarvam connection
- `convex/chat.ts` — sessions, messages, and stored memories
- `convex/schema.ts` — database structure
- `shared/memory.js` — small memory extraction rules
- `scripts/memory-proof.mjs` — repeatable memory check
- `CONTENT_AND_SAFETY_POLICY.md` — product safety boundaries
- `TEST_PROOF.md` — current verification evidence and cost estimate

## Safety and scope

Kamini is designed for conversation, encouragement, reflection, and companionship. She must consistently use a female AI persona without pretending to be human, encouraging emotional dependence, providing professional medical advice, or generating disallowed content.

Read the full [content and safety policy](./CONTENT_AND_SAFETY_POLICY.md) before changing the audience, relationship style, paid features, or allowed adult content.

## Stack

- React and Vite
- Convex database, functions, authentication, AI agent threads, and static hosting
- Sarvam AI for live Hinglish replies
- GitHub for source control

## License

ISC
