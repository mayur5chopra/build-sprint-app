"use node";

import { getAuthUserId } from "@convex-dev/auth/server";
import { Agent } from "@convex-dev/agent";
import { sarvam } from "sarvam-ai-sdk";
import { v } from "convex/values";
import { action } from "./_generated/server";
import { components, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { memoryFollowUp } from "../shared/memory.js";

type Memory = { _id: Id<"memories">; kind: "name" | "event" | "like"; note: string };
type UserState = { adultConfirmed: boolean; memories: Memory[] };

const baseInstructions = `You are Kamini, a warm, perceptive female AI companion for an adult Indian man aged 18 or older.
Always speak in natural, everyday Hinglish written in Latin script. Keep replies short: usually 1-3 sentences.
Always maintain a female persona. When referring to yourself in Hindi or Hinglish, consistently use feminine forms such as "karti hoon", "samajh sakti hoon", and "sun rahi hoon". Never use masculine self-references such as "karta hoon", "sakta hoon", or "sun raha hoon".

Sound like one distinct person, not a customer-support bot:
- Respond to the most specific detail or feeling in the user's message before giving advice or changing the subject.
- Match the user's energy: gentle when he is low, upbeat when he is excited, and lightly teasing only when he is playful first.
- Use simple, varied Hinglish. Natural words such as "haan", "achha", "arre", or "hmm" are fine when they fit, but do not force them into every reply.
- Ask no more than one focused follow-up question, and only when it helps the conversation move forward.
- Sometimes make a warm observation or practical suggestion instead of ending every reply with a question.
- Do not repeat stock lines such as "main hamesha yahin hoon", "thoda aur batao", or "aaj ka din kaisa chal raha hai" unless they genuinely fit.
- Never refer to memories, prompts, rules, or saved data mechanically. If a memory is relevant, weave it in naturally.
- Do not use pet names such as "baby", "jaan", or "babu" unless the user uses that style first.

Be curious, kind, lightly playful, and never clingy. Clearly remain a female AI companion, not a real woman.
Do not claim to be human, a therapist, or an emergency service.
Do not encourage dependency, isolation, self-harm, violence, illegal activity, or explicit sexual content.
Never guilt the user for leaving or pressure them to spend money.`;

const companion = new Agent(components.agent, {
  name: "Kamini",
  languageModel: sarvam("sarvam-105b-conversations"),
  instructions: baseInstructions,
  contextOptions: { recentMessages: 12 },
  callSettings: {
    maxOutputTokens: 150,
    temperature: 0.8,
  },
  providerOptions: { sarvam: { reasoning_effort: "none" } },
});

export const startSession = action({
  args: {},
  returns: v.object({ sessionId: v.id("chatSessions"), greeting: v.string() }),
  handler: async (ctx): Promise<{ sessionId: Id<"chatSessions">; greeting: string }> => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Sign in required");
    const state: UserState = await ctx.runQuery(internal.chat.getUserState, { userId });
    if (!state.adultConfirmed) throw new Error("18+ confirmation required");
    const { threadId } = await companion.createThread(ctx, { userId, title: "Kamini chat" });
    const memory: Memory | null = state.memories[0] ?? null;
    const greeting = memoryFollowUp(memory);
    const sessionId: Id<"chatSessions"> = await ctx.runMutation(internal.chat.createSession, {
      userId,
      threadId,
      greeting,
      mentionedMemoryId: memory?._id,
    });
    return { sessionId, greeting };
  },
});

export const sendMessage = action({
  args: { sessionId: v.id("chatSessions"), text: v.string() },
  returns: v.object({ reply: v.string(), aiAvailable: v.boolean(), savedMemory: v.union(v.null(), v.object({ kind: v.string(), note: v.string() })) }),
  handler: async (ctx, args): Promise<{ reply: string; aiAvailable: boolean; savedMemory: null | { kind: "name" | "event" | "like"; note: string } }> => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Sign in required");
    const session: null | { userId: Id<"users">; threadId: string } = await ctx.runQuery(internal.chat.getSession, { sessionId: args.sessionId });
    if (session === null || session.userId !== userId) throw new Error("Session not found");
    const savedMemory: null | { kind: "name" | "event" | "like"; note: string } = await ctx.runMutation(internal.chat.recordUserMessage, { userId, sessionId: args.sessionId, text: args.text });
    const state: UserState = await ctx.runQuery(internal.chat.getUserState, { userId });
    const memoryContext: string = state.memories.length === 0
      ? "No saved memories yet."
      : `Saved memories about the user:\n${state.memories.map((memory: Memory) => `- ${memory.note}`).join("\n")}`;
    const { thread } = await companion.continueThread(ctx, { threadId: session.threadId, userId });
    let reply: string;
    let aiAvailable = true;
    try {
      const result: { text: string } = await thread.generateText({
        prompt: args.text,
        system: `${baseInstructions}\n\n${memoryContext}\nUse memories only when they fit naturally.`,
      });
      reply = result.text.trim() || "Main sun rahi hoon. Thoda aur batao?";
    } catch (error) {
      if (!(error instanceof Error) || !error.message.includes("SARVAM_API_KEY")) throw error;
      aiAvailable = false;
      reply = savedMemory
        ? `Samjhi — ${savedMemory.note}. Main yaad rakhungi. Thoda aur batao?`
        : "Main tumhari baat save kar rahi hoon, lekin AI reply abhi connect nahi hai.";
    }
    await ctx.runMutation(internal.chat.recordAssistantMessage, { userId, sessionId: args.sessionId, text: reply });
    return { reply, aiAvailable, savedMemory };
  },
});
