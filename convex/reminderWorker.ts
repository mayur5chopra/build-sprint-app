import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction, internalMutation } from "./_generated/server";

const internalApi = internal as any;

const deliveryResult = v.object({
  status: v.union(v.literal("sent"), v.literal("failed")),
  providerMessageId: v.optional(v.string()),
  errorCode: v.optional(v.string()),
  retryable: v.boolean(),
  networkStarted: v.boolean(),
});

export const claim = internalMutation({
  args: {
    reminderId: v.id("reminderDemoReminders"),
    version: v.number(),
    attempt: v.number(),
  },
  returns: v.union(
    v.null(),
    v.object({
      attemptId: v.id("reminderDemoDeliveryAttempts"),
      userId: v.id("users"),
      text: v.string(),
      channel: v.union(v.literal("simulator"), v.literal("whatsapp")),
    }),
  ),
  handler: async (ctx, args) => {
    const reminder = await ctx.db.get(args.reminderId);
    if (reminder === null) return null;
    const existing = await ctx.db
      .query("reminderDemoDeliveryAttempts")
      .withIndex("by_reminder_version_attempt", (q) =>
        q.eq("reminderId", args.reminderId)
          .eq("reminderVersion", args.version)
          .eq("attempt", args.attempt),
      )
      .unique();
    if (existing !== null) return null;

    const now = Date.now();
    if (reminder.status !== "scheduled" || reminder.version !== args.version || reminder.dueAt > now + 1_000) {
      await ctx.db.insert("reminderDemoDeliveryAttempts", {
        userId: reminder.userId,
        reminderId: reminder._id,
        reminderVersion: args.version,
        attempt: args.attempt,
        channel: reminder.channel,
        status: "skipped",
        errorCode: "stale_or_not_due",
        createdAt: now,
        updatedAt: now,
      });
      return null;
    }
    const attemptId = await ctx.db.insert("reminderDemoDeliveryAttempts", {
      userId: reminder.userId,
      reminderId: reminder._id,
      reminderVersion: args.version,
      attempt: args.attempt,
      channel: reminder.channel,
      status: "sending",
      createdAt: now,
      updatedAt: now,
    });
    return {
      attemptId,
      userId: reminder.userId,
      text: reminder.text,
      channel: reminder.channel,
    };
  },
});

export const finalize = internalMutation({
  args: {
    attemptId: v.id("reminderDemoDeliveryAttempts"),
    reminderId: v.id("reminderDemoReminders"),
    version: v.number(),
    attempt: v.number(),
    result: deliveryResult,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const attempt = await ctx.db.get(args.attemptId);
    const reminder = await ctx.db.get(args.reminderId);
    if (attempt === null || reminder === null) return null;
    const now = Date.now();
    const stale = reminder.version !== args.version || reminder.status !== "scheduled";
    if (stale) {
      await ctx.db.patch(args.attemptId, {
        status: args.result.networkStarted ? "unknown" : "skipped",
        errorCode: args.result.networkStarted ? "state_changed_after_send_started" : "state_changed_before_delivery",
        updatedAt: now,
      });
      return null;
    }
    if (args.result.status === "sent") {
      await ctx.db.patch(args.attemptId, {
        status: "sent",
        providerMessageId: args.result.providerMessageId,
        updatedAt: now,
      });
      await ctx.db.patch(args.reminderId, { status: "delivered", updatedAt: now });
      if (attempt.channel === "simulator") {
        await ctx.db.insert("reminderDemoMessages", {
          userId: reminder.userId,
          role: "assistant",
          text: `⏰ Reminder: ${reminder.text}`,
          source: "scheduled",
          createdAt: now,
        });
      }
      return null;
    }

    await ctx.db.patch(args.attemptId, {
      status: "failed",
      errorCode: args.result.errorCode ?? "delivery_failed",
      updatedAt: now,
    });
    if (args.result.retryable && args.attempt < 2) {
      await ctx.scheduler.runAfter(1_000, internalApi.reminderWorker.deliver, {
        reminderId: args.reminderId,
        version: args.version,
        attempt: args.attempt + 1,
      });
    } else {
      await ctx.db.patch(args.reminderId, { status: "delivery_failed", updatedAt: now });
    }
    return null;
  },
});

export const deliver = internalAction({
  args: {
    reminderId: v.id("reminderDemoReminders"),
    version: v.number(),
    attempt: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const claimed = await ctx.runMutation(internalApi.reminderWorker.claim, args) as null | {
      attemptId: any;
      userId: any;
      text: string;
      channel: "simulator" | "whatsapp";
    };
    if (claimed === null) return null;
    const result = await ctx.runAction(internalApi.deliveryAdapters.deliver, {
      channel: claimed.channel,
      text: claimed.text,
    });
    await ctx.runMutation(internalApi.reminderWorker.finalize, {
      ...args,
      attemptId: claimed.attemptId,
      result,
    });
    return null;
  },
});
