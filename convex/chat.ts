import { getAuthUserId } from "@convex-dev/auth/server";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { extractMemory } from "../shared/memory.js";
import {
  internalMutation,
  internalQuery,
  query,
} from "./_generated/server";

const memoryKind = v.union(v.literal("name"), v.literal("event"), v.literal("like"));

export const latestSession = query({
  args: {},
  returns: v.union(v.null(), v.object({ _id: v.id("chatSessions"), startedAt: v.number() })),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const session = await ctx.db
      .query("chatSessions")
      .withIndex("by_user_started", (q) => q.eq("userId", userId))
      .order("desc")
      .first();
    return session === null ? null : { _id: session._id, startedAt: session.startedAt };
  },
});

export const listMessages = query({
  args: { sessionId: v.id("chatSessions"), paginationOpts: paginationOptsValidator },
  returns: v.object({
    page: v.array(v.object({
      _id: v.id("chatMessages"),
      role: v.union(v.literal("user"), v.literal("assistant")),
      text: v.string(),
      createdAt: v.number(),
    })),
    isDone: v.boolean(),
    continueCursor: v.string(),
    splitCursor: v.optional(v.union(v.string(), v.null())),
    pageStatus: v.optional(v.union(v.literal("SplitRecommended"), v.literal("SplitRequired"), v.null())),
  }),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Sign in required");
    const session = await ctx.db.get(args.sessionId);
    if (session === null || session.userId !== userId) throw new Error("Session not found");
    const result = await ctx.db
      .query("chatMessages")
      .withIndex("by_session_created", (q) => q.eq("sessionId", args.sessionId))
      .paginate(args.paginationOpts);
    return {
      ...result,
      page: result.page.map((message) => ({
        _id: message._id,
        role: message.role,
        text: message.text,
        createdAt: message.createdAt,
      })),
    };
  },
});

export const getUserState = internalQuery({
  args: { userId: v.id("users") },
  returns: v.object({
    adultConfirmed: v.boolean(),
    memories: v.array(v.object({ _id: v.id("memories"), kind: memoryKind, note: v.string() })),
  }),
  handler: async (ctx, args) => {
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();
    const memories = await ctx.db
      .query("memories")
      .withIndex("by_user_created", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(12);
    return {
      adultConfirmed: profile !== null,
      memories: memories.map((memory) => ({ _id: memory._id, kind: memory.kind, note: memory.note })),
    };
  },
});

export const getSession = internalQuery({
  args: { sessionId: v.id("chatSessions") },
  returns: v.union(v.null(), v.object({ userId: v.id("users"), threadId: v.string() })),
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    return session === null ? null : { userId: session.userId, threadId: session.threadId };
  },
});

export const createSession = internalMutation({
  args: { userId: v.id("users"), threadId: v.string(), greeting: v.string(), mentionedMemoryId: v.optional(v.id("memories")) },
  returns: v.id("chatSessions"),
  handler: async (ctx, args) => {
    const now = Date.now();
    const sessionId = await ctx.db.insert("chatSessions", { userId: args.userId, threadId: args.threadId, startedAt: now });
    await ctx.db.insert("chatMessages", { userId: args.userId, sessionId, role: "assistant", text: args.greeting, createdAt: now });
    if (args.mentionedMemoryId !== undefined) {
      await ctx.db.patch(args.mentionedMemoryId, { lastMentionedAt: now });
    }
    return sessionId;
  },
});

export const recordUserMessage = internalMutation({
  args: { userId: v.id("users"), sessionId: v.id("chatSessions"), text: v.string() },
  returns: v.union(v.null(), v.object({ kind: memoryKind, note: v.string() })),
  handler: async (ctx, args) => {
    await ctx.db.insert("chatMessages", { ...args, role: "user", createdAt: Date.now() });
    const memory = extractMemory(args.text);
    if (memory === null) return null;
    await ctx.db.insert("memories", { userId: args.userId, ...memory, sourceText: args.text, createdAt: Date.now() });
    return memory;
  },
});

export const recordAssistantMessage = internalMutation({
  args: { userId: v.id("users"), sessionId: v.id("chatSessions"), text: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.insert("chatMessages", { ...args, role: "assistant", createdAt: Date.now() });
    return null;
  },
});
