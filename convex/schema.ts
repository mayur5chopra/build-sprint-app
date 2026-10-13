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
  smritiUsers: defineTable({
    ownerUserId: v.optional(v.id("users")),
    whatsappId: v.optional(v.string()),
    timezone: v.string(),
    summaryHour: v.number(),
    nextSummaryAt: v.number(),
    lastInboundAt: v.optional(v.number()),
    status: v.union(v.literal("active"), v.literal("deleting")),
    deleteConfirmationRequestedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_owner", ["ownerUserId"])
    .index("by_whatsapp", ["whatsappId"])
    .index("by_status_summary", ["status", "nextSummaryAt"]),
  smritiTasks: defineTable({
    userId: v.id("smritiUsers"),
    title: v.string(),
    dueAt: v.number(),
    timezone: v.string(),
    recurrence: v.union(
      v.object({ kind: v.literal("none") }),
      v.object({
        kind: v.union(v.literal("daily"), v.literal("weekly"), v.literal("monthly")),
        interval: v.number(),
      }),
    ),
    urgent: v.boolean(),
    important: v.boolean(),
    status: v.union(v.literal("open"), v.literal("completed"), v.literal("cancelled")),
    deliveryStatus: v.union(
      v.literal("scheduled"),
      v.literal("delivered"),
      v.literal("delivery_failed"),
    ),
    channel: v.union(v.literal("simulator"), v.literal("whatsapp")),
    version: v.number(),
    lastReminderAt: v.optional(v.number()),
    lastSummaryAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    deleteAfter: v.optional(v.number()),
    cancelledAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user_created", ["userId", "createdAt"])
    .index("by_user_status_due", ["userId", "status", "dueAt"])
    .index("by_status_delete_after", ["status", "deleteAfter"]),
  smritiPendingInputs: defineTable({
    userId: v.id("smritiUsers"),
    kind: v.union(v.literal("task_details"), v.literal("delete_confirmation")),
    rawText: v.string(),
    title: v.optional(v.string()),
    dueAt: v.optional(v.number()),
    hasExplicitDate: v.optional(v.boolean()),
    hasExplicitTime: v.optional(v.boolean()),
    urgent: v.optional(v.boolean()),
    important: v.optional(v.boolean()),
    recurrence: v.optional(v.union(
      v.object({ kind: v.literal("none") }),
      v.object({
        kind: v.union(v.literal("daily"), v.literal("weekly"), v.literal("monthly")),
        interval: v.number(),
      }),
    )),
    createdAt: v.number(),
    expiresAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_expires", ["expiresAt"]),
  smritiInboundMessages: defineTable({
    userId: v.id("smritiUsers"),
    provider: v.union(v.literal("simulator"), v.literal("whatsapp")),
    externalMessageId: v.string(),
    replyToExternalMessageId: v.optional(v.string()),
    text: v.string(),
    status: v.union(v.literal("processing"), v.literal("processed"), v.literal("failed")),
    responseText: v.optional(v.string()),
    receivedAt: v.number(),
    processedAt: v.optional(v.number()),
  })
    .index("by_provider_message", ["provider", "externalMessageId"])
    .index("by_user_received", ["userId", "receivedAt"]),
  smritiMessages: defineTable({
    userId: v.id("smritiUsers"),
    role: v.union(v.literal("user"), v.literal("assistant")),
    text: v.string(),
    source: v.union(v.literal("simulator"), v.literal("whatsapp"), v.literal("scheduled")),
    externalMessageId: v.optional(v.string()),
    taskId: v.optional(v.id("smritiTasks")),
    createdAt: v.number(),
  })
    .index("by_user_created", ["userId", "createdAt"])
    .index("by_external_message", ["externalMessageId"])
    .index("by_task", ["taskId"]),
  smritiDeliveryAttempts: defineTable({
    userId: v.id("smritiUsers"),
    taskId: v.optional(v.id("smritiTasks")),
    taskVersion: v.optional(v.number()),
    attempt: v.number(),
    kind: v.union(v.literal("task_reminder"), v.literal("daily_summary"), v.literal("freeform_reply")),
    channel: v.union(v.literal("simulator"), v.literal("whatsapp")),
    status: v.union(
      v.literal("sending"),
      v.literal("sent"),
      v.literal("delivered"),
      v.literal("read"),
      v.literal("failed"),
      v.literal("skipped"),
      v.literal("unknown"),
    ),
    providerMessageId: v.optional(v.string()),
    errorCode: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_task_version_attempt", ["taskId", "taskVersion", "attempt"])
    .index("by_task", ["taskId"])
    .index("by_provider_message", ["providerMessageId"])
    .index("by_user_created", ["userId", "createdAt"]),
});
