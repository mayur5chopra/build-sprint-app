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
  reminderDemoSettings: defineTable({
    userId: v.id("users"),
    timezone: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),
  reminderDemoChannelIdentities: defineTable({
    userId: v.id("users"),
    provider: v.literal("whatsapp"),
    externalUserId: v.string(),
    createdAt: v.number(),
  })
    .index("by_user_provider", ["userId", "provider"])
    .index("by_provider_external", ["provider", "externalUserId"]),
  reminderDemoNotes: defineTable({
    userId: v.id("users"),
    body: v.string(),
    searchText: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user_created", ["userId", "createdAt"])
    .searchIndex("search_body", {
      searchField: "searchText",
      filterFields: ["userId"],
    }),
  reminderDemoTasks: defineTable({
    userId: v.id("users"),
    title: v.string(),
    status: v.union(v.literal("open"), v.literal("completed")),
    createdAt: v.number(),
    updatedAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index("by_user_created", ["userId", "createdAt"])
    .index("by_user_status_created", ["userId", "status", "createdAt"]),
  reminderDemoReminders: defineTable({
    userId: v.id("users"),
    text: v.string(),
    dueAt: v.number(),
    timezone: v.string(),
    channel: v.union(v.literal("simulator"), v.literal("whatsapp")),
    status: v.union(
      v.literal("scheduled"),
      v.literal("delivered"),
      v.literal("delivery_failed"),
      v.literal("completed"),
      v.literal("cancelled"),
    ),
    version: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
    completedAt: v.optional(v.number()),
    cancelledAt: v.optional(v.number()),
  })
    .index("by_user_created", ["userId", "createdAt"])
    .index("by_user_status_due", ["userId", "status", "dueAt"]),
  reminderDemoInboundMessages: defineTable({
    userId: v.id("users"),
    provider: v.union(v.literal("simulator"), v.literal("whatsapp")),
    externalMessageId: v.string(),
    text: v.string(),
    receivedAt: v.number(),
    processedAt: v.number(),
    responseText: v.string(),
  })
    .index("by_provider_message", ["provider", "externalMessageId"])
    .index("by_user_received", ["userId", "receivedAt"]),
  reminderDemoMessages: defineTable({
    userId: v.id("users"),
    role: v.union(v.literal("user"), v.literal("assistant")),
    text: v.string(),
    source: v.union(
      v.literal("simulator"),
      v.literal("whatsapp"),
      v.literal("scheduled"),
    ),
    createdAt: v.number(),
  }).index("by_user_created", ["userId", "createdAt"]),
  reminderDemoDeliveryAttempts: defineTable({
    userId: v.id("users"),
    reminderId: v.id("reminderDemoReminders"),
    reminderVersion: v.number(),
    attempt: v.number(),
    channel: v.union(v.literal("simulator"), v.literal("whatsapp")),
    status: v.union(
      v.literal("sending"),
      v.literal("sent"),
      v.literal("failed"),
      v.literal("skipped"),
      v.literal("unknown"),
    ),
    errorCode: v.optional(v.string()),
    providerMessageId: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_reminder_version_attempt", ["reminderId", "reminderVersion", "attempt"])
    .index("by_user_created", ["userId", "createdAt"]),
});
