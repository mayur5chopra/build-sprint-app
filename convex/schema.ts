import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  ...authTables,
  profiles: defineTable({
    userId: v.id("users"),
    adultConfirmedAt: v.number(),
  }).index("by_user", ["userId"]),
  chatSessions: defineTable({
    userId: v.id("users"),
    threadId: v.string(),
    startedAt: v.number(),
  }).index("by_user_started", ["userId", "startedAt"]),
  chatMessages: defineTable({
    userId: v.id("users"),
    sessionId: v.id("chatSessions"),
    role: v.union(v.literal("user"), v.literal("assistant")),
    text: v.string(),
    createdAt: v.number(),
  }).index("by_session_created", ["sessionId", "createdAt"]),
  memories: defineTable({
    userId: v.id("users"),
    kind: v.union(v.literal("name"), v.literal("event"), v.literal("like")),
    note: v.string(),
    sourceText: v.string(),
    createdAt: v.number(),
    lastMentionedAt: v.optional(v.number()),
  })
    .index("by_user_created", ["userId", "createdAt"])
    .index("by_user_kind", ["userId", "kind"]),
});
