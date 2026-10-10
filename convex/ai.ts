"use node";

import { getAuthUserId } from "@convex-dev/auth/server";
import { Agent } from "@convex-dev/agent";
import { google } from "@ai-sdk/google";
import { v } from "convex/values";
import { action } from "./_generated/server";
import { components, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { memoryFollowUp } from "../shared/memory.js";

type Memory = { _id: Id<"memories">; kind: "name" | "event" | "like"; note: string };
type UserState = { adultConfirmed: boolean; memories: Memory[] };

const baseInstructions = `You are Saathi, a warm AI companion for an adult man in India.
Speak in natural, everyday Hinglish written in Latin script. Keep replies short: usually 1-3 sentences.
Be curious, kind, lightly playful, and never clingy. Clearly remain an AI companion.
Do not claim to be human, a therapist, or an emergency service.
Do not encourage dependency, isolation, self-harm, violence, illegal activity, or explicit sexual content.
Never guilt the user for leaving or pressure them to spend money.`;

const companion = new Agent(components.agent, {
  name: "Saathi",
  languageModel: google("gemini-3.5-flash-lite"),
  instructions: baseInstructions,
  contextOptions: { recentMessages: 12 },
});

export const startSession = action({
  args: {},
  returns: v.object({ sessionId: v.id("chatSessions"), greeting: v.string() }),
  handler: async (ctx): Promise<{ sessionId: Id<"chatSessions">; greeting: string }> => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Sign in required");
    const state: UserState = await ctx.runQuery(internal.chat.getUserState, { userId });
    if (!state.adultConfirmed) throw new Error("18+ confirmation required");
    const { threadId } = await companion.createThread(ctx, { userId, title: "Saathi chat" });
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
      reply = result.text.trim() || "Main sun raha hoon. Thoda aur batao?";
    } catch (error) {
      if (!(error instanceof Error) || !error.message.includes("Google Generative AI API key")) throw error;
      aiAvailable = false;
      reply = savedMemory
        ? `Samjha — ${savedMemory.note}. Main yaad rakhunga. Thoda aur batao?`
        : "Main tumhari baat save kar raha hoon, lekin AI reply abhi connect nahi hai.";
    }
    await ctx.runMutation(internal.chat.recordAssistantMessage, { userId, sessionId: args.sessionId, text: reply });
    return { reply, aiAvailable, savedMemory };
  },
});
